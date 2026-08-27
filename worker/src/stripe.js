const STRIPE_API = "https://api.stripe.com/v1";

export const STRIPE_PRICES = {
  week: "price_1U96rd1OYiWwnfPTIescm07j",
  month: "price_1U96uE1OYiWwnfPT2CZ5sz6p",
  year: "price_1U96uS1OYiWwnfPTwND7oatG",
};

const PLAN_TTL_SECONDS = {
  week: 7 * 86400,
  month: 30 * 86400,
  year: 365 * 86400,
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function normalizeUsername(value) {
  if (typeof value !== "string") return null;
  const username = value.trim();
  if (username.length < 3 || username.length > 20) return null;
  if (!/^[A-Za-z0-9_]+$/.test(username)) return null;
  return username;
}

function normalizePlan(value) {
  const plan = String(value || "").toLowerCase().trim();
  if (!STRIPE_PRICES[plan]) return null;
  return plan;
}

function randomKeySegment(length = 4) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

/** GH-PAID-WEEK-XXXX-XXXX */
function generatePaidKey(plan) {
  const label = String(plan).toUpperCase();
  return `GH-PAID-${label}-${randomKeySegment(4)}-${randomKeySegment(4)}`;
}

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

export async function createStripeCheckout(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!env.STRIPE_SECRET_KEY) {
    return json({ ok: false, error: "stripe_not_configured" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const plan = normalizePlan(body.plan);
  if (!plan) {
    return json({
      ok: false,
      error: "invalid_plan",
      allowed: Object.keys(STRIPE_PRICES),
    }, 400);
  }

  const username = normalizeUsername(body.username);
  if (!username) {
    return json({
      ok: false,
      error: "invalid_username",
      details: "username must be 3-20 chars: A-Z, a-z, 0-9, _",
    }, 400);
  }

  const price = STRIPE_PRICES[plan];
  const origin = new URL(request.url).origin;

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("managed_payments[enabled]", "false");
  params.set("line_items[0][price]", price);
  params.set("line_items[0][quantity]", "1");
  params.set("metadata[plan]", plan);
  params.set("metadata[username]", username);
  params.set(
    "success_url",
    `${origin}/premium/success?session_id={CHECKOUT_SESSION_ID}`
  );
  params.set("cancel_url", `${origin}/pricing`);
  params.set("allow_promotion_codes", "true");

  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await response.json();

  if (!response.ok) {
    return json({
      ok: false,
      error: "stripe_checkout_failed",
      details: data?.error?.message || "unknown_error",
    }, response.status);
  }

  return json({
    ok: true,
    url: data.url,
    session_id: data.id,
  });
}

/**
 * Stripe webhook signature verification (Cloudflare Workers / Web Crypto).
 * Uses raw body string; compares HMAC-SHA256 hex of `${t}.${payload}` to v1.
 */
async function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!signatureHeader || !secret) {
    console.error("stripe_sig_missing", {
      hasSig: !!signatureHeader,
      hasSecret: !!secret,
    });
    return false;
  }

  // Dashboard paste sometimes includes trailing newline/quotes
  const cleanSecret = String(secret).trim().replace(/^["']|["']$/g, "");

  const parts = signatureHeader.split(",");
  let timestamp = null;
  const signatures = [];

  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) {
    console.error("stripe_sig_parse_failed", { timestamp, sigCount: signatures.length });
    return false;
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) {
    console.error("stripe_sig_bad_timestamp", timestamp);
    return false;
  }

  // 5 minute tolerance (Stripe default)
  const skew = Math.abs(Math.floor(Date.now() / 1000) - timestampNumber);
  if (skew > 300) {
    console.error("stripe_sig_replay_window", { skew });
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(cleanSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signedPayload)
  );

  const expected = [...new Uint8Array(signatureBytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  for (const candidate of signatures) {
    if (candidate.length !== expected.length) continue;
    let difference = 0;
    for (let i = 0; i < expected.length; i++) {
      difference |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
    }
    if (difference === 0) return true;
  }

  console.error("stripe_sig_mismatch", {
    expectedLen: expected.length,
    candidates: signatures.map((s) => s.length),
  });
  return false;
}

async function insertKeyRow(env, { key, username, sessionId, createdAt, expiresAt, plan }) {
  // Prefer with plan; fallback without plan if column missing
  try {
    await env.DB.prepare(
      `INSERT INTO keys (
        key, username, session_id, created_at, expires_at,
        revoked, executed, last_execution, plan
      ) VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?)`
    )
      .bind(key, username, `stripe:${sessionId}`, createdAt, expiresAt, plan)
      .run();
    return { ok: true };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    // Missing plan column
    if (/no such column:\s*plan/i.test(msg)) {
      await env.DB.prepare(
        `INSERT INTO keys (
          key, username, session_id, created_at, expires_at,
          revoked, executed, last_execution
        ) VALUES (?, ?, ?, ?, ?, 0, 0, NULL)`
      )
        .bind(key, username, `stripe:${sessionId}`, createdAt, expiresAt)
        .run();
      return { ok: true, note: "keys.plan column missing — inserted without plan" };
    }
    throw err;
  }
}

/**
 * Provision key once per Stripe checkout session_id.
 * Recover if payment row exists but key row is missing.
 */
async function provisionPaidKeyFromSession(env, session) {
  const sessionId = session?.id;
  if (!sessionId) {
    return { ok: false, error: "missing_session_id" };
  }

  if (session.payment_status && session.payment_status !== "paid") {
    return { ok: false, error: "not_paid", payment_status: session.payment_status };
  }

  let existingPayment;
  try {
    existingPayment = await env.DB.prepare(
      `SELECT key, plan, username FROM stripe_payments WHERE session_id = ? LIMIT 1`
    )
      .bind(sessionId)
      .first();
  } catch (err) {
    console.error("stripe_payments select failed", err);
    return {
      ok: false,
      error: "d1_stripe_payments_unavailable",
      details: String(err && err.message ? err.message : err),
    };
  }

  if (existingPayment) {
    // Ensure key exists (recover partial failure)
    let keyRow = null;
    try {
      keyRow = await env.DB.prepare(
        `SELECT key FROM keys WHERE key = ? LIMIT 1`
      )
        .bind(existingPayment.key)
        .first();
    } catch (err) {
      console.error("keys select during recover failed", err);
      return { ok: false, error: "d1_keys_unavailable" };
    }

    if (keyRow) {
      return {
        ok: true,
        already: true,
        key: existingPayment.key,
        plan: existingPayment.plan,
        username: existingPayment.username,
      };
    }

    // Payment recorded but key missing — finish provisioning
    const plan = normalizePlan(existingPayment.plan);
    const username = normalizeUsername(existingPayment.username);
    if (!plan || !username) {
      return { ok: false, error: "invalid_stored_metadata" };
    }
    const createdAt = nowUnix();
    const expiresAt = createdAt + PLAN_TTL_SECONDS[plan];
    try {
      await insertKeyRow(env, {
        key: existingPayment.key,
        username,
        sessionId,
        createdAt,
        expiresAt,
        plan,
      });
      return {
        ok: true,
        recovered: true,
        key: existingPayment.key,
        plan,
        username,
        expires_at: expiresAt,
      };
    } catch (err) {
      console.error("recover key insert failed", err);
      return { ok: false, error: "db_recover_key_failed" };
    }
  }

  const plan = normalizePlan(session.metadata?.plan);
  const username = normalizeUsername(session.metadata?.username);

  if (!plan || !username) {
    console.error("Stripe session missing/invalid metadata", {
      sessionId,
      plan: session.metadata?.plan,
      username: session.metadata?.username,
    });
    return { ok: false, error: "invalid_metadata" };
  }

  const createdAt = nowUnix();
  const expiresAt = createdAt + PLAN_TTL_SECONDS[plan];
  const key = generatePaidKey(plan);

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || null;
  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // Insert payment first (PK = session_id) for idempotency
  try {
    await env.DB.prepare(
      `INSERT INTO stripe_payments (
        session_id,
        stripe_customer_id,
        stripe_payment_intent_id,
        key,
        plan,
        username,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        sessionId,
        stripeCustomerId,
        stripePaymentIntentId,
        key,
        plan,
        username,
        createdAt
      )
      .run();
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (/no such table:\s*stripe_payments/i.test(msg)) {
      console.error("stripe_payments table missing — run D1 SQL migration");
      return {
        ok: false,
        error: "d1_missing_stripe_payments_table",
        details: msg,
      };
    }
    // Race: another invocation inserted
    try {
      const raced = await env.DB.prepare(
        `SELECT key, plan, username FROM stripe_payments WHERE session_id = ? LIMIT 1`
      )
        .bind(sessionId)
        .first();
      if (raced) {
        return {
          ok: true,
          already: true,
          key: raced.key,
          plan: raced.plan,
          username: raced.username,
        };
      }
    } catch (_) {}
    console.error("stripe_payments insert failed", err);
    return { ok: false, error: "db_insert_payment_failed", details: msg };
  }

  try {
    await insertKeyRow(env, {
      key,
      username,
      sessionId,
      createdAt,
      expiresAt,
      plan,
    });
  } catch (err) {
    console.error("keys insert failed after payment recorded", { sessionId, key, err });
    return { ok: false, error: "db_insert_key_failed", key };
  }

  console.log("Stripe paid key provisioned", { sessionId, key, plan, username, expiresAt });

  return {
    ok: true,
    already: false,
    key,
    plan,
    username,
    expires_at: expiresAt,
  };
}

export async function handleStripeWebhook(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is missing");
    return json({ ok: false, error: "webhook_not_configured" }, 500);
  }

  // Raw body BEFORE JSON.parse — required for signature verification
  const payload = await request.text();
  const signature =
    request.headers.get("Stripe-Signature") ||
    request.headers.get("stripe-signature");

  const valid = await verifyStripeSignature(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );

  if (!valid) {
    return json({ ok: false, error: "invalid_signature" }, 400);
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    try {
      const result = await provisionPaidKeyFromSession(env, session);
      if (!result.ok) {
        console.error("provisionPaidKeyFromSession failed", result);
        // Missing table / D1 errors — return 500 so Stripe retries after migration
        if (
          result.error === "d1_missing_stripe_payments_table" ||
          result.error === "d1_stripe_payments_unavailable" ||
          result.error === "d1_keys_unavailable" ||
          result.error === "db_insert_payment_failed" ||
          result.error === "db_insert_key_failed" ||
          result.error === "db_recover_key_failed"
        ) {
          return json({ ok: false, error: result.error }, 500);
        }
      }
    } catch (err) {
      console.error("webhook provision error", err);
      return json({ ok: false, error: "provision_error" }, 500);
    }
  } else {
    console.log("Unhandled Stripe event:", event.type);
  }

  return json({ received: true });
}

/**
 * GET /api/premium/status?session_id=cs_...
 * Read-only. Never creates keys.
 * D1 errors → JSON, not uncaught Worker exception.
 */
export async function handlePremiumStatus(request, env) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const sessionId = (url.searchParams.get("session_id") || "").trim();

    if (!sessionId || sessionId.length > 200 || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      return json({ ok: false, error: "invalid_session_id" }, 400);
    }

    let payment;
    try {
      payment = await env.DB.prepare(
        `SELECT session_id, key, plan, username, created_at
         FROM stripe_payments WHERE session_id = ? LIMIT 1`
      )
        .bind(sessionId)
        .first();
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      console.error("handlePremiumStatus D1 stripe_payments", msg);
      if (/no such table/i.test(msg)) {
        return json({
          ok: false,
          error: "d1_missing_stripe_payments_table",
          details: "Run SQL migration for stripe_payments in D1 Console",
        }, 503);
      }
      return json({
        ok: false,
        error: "d1_error",
        details: msg,
      }, 500);
    }

    if (!payment) {
      return json({
        ok: true,
        status: "pending",
        message: "Payment is being processed",
      });
    }

    let keyRow;
    try {
      keyRow = await env.DB.prepare(
        `SELECT key, username, plan, expires_at, revoked, created_at
         FROM keys WHERE key = ? LIMIT 1`
      )
        .bind(payment.key)
        .first();
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      console.error("handlePremiumStatus D1 keys", msg);
      return json({
        ok: false,
        error: "d1_error",
        details: msg,
      }, 500);
    }

    if (!keyRow) {
      return json({
        ok: true,
        status: "pending",
        message: "Key provisioning in progress",
      });
    }

    return json({
      ok: true,
      status: "ready",
      key: keyRow.key,
      plan: keyRow.plan || payment.plan,
      username: keyRow.username || payment.username,
      expires_at: keyRow.expires_at,
      created_at: keyRow.created_at,
      revoked: keyRow.revoked === 1,
    });
  } catch (err) {
    console.error("handlePremiumStatus unexpected", err);
    return json({
      ok: false,
      error: "internal_error",
      details: String(err && err.message ? err.message : err),
    }, 500);
  }
}
