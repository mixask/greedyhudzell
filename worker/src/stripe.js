const STRIPE_API = "https://api.stripe.com/v1";

export const STRIPE_PRICES = {
  week: "price_1U8mnb1OYiWwnfPTymLWHtdX",
  month: "price_1U8moZ1OYiWwnfPTqwhQrtjp",
  year: "price_1U8mpO1OYiWwnfPTQQRLzXAl",
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

  // One-time payment (fixed duration key), NOT subscription
  params.set("mode", "payment");
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

async function verifyStripeSignature(payload, signature, secret) {
  if (!signature || !secret) return false;

  const parts = signature.split(",");
  let timestamp = null;
  const signatures = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;

  // Replay window: 5 minutes
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 300) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
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

  return false;
}

/**
 * Provision key once per Stripe checkout session_id.
 * Idempotent: duplicate webhook => no second key.
 */
async function provisionPaidKeyFromSession(env, session) {
  const sessionId = session?.id;
  if (!sessionId) {
    return { ok: false, error: "missing_session_id" };
  }

  // Already processed?
  const existing = await env.DB.prepare(
    `SELECT key, plan, username FROM stripe_payments WHERE session_id = ? LIMIT 1`
  )
    .bind(sessionId)
    .first();

  if (existing) {
    return {
      ok: true,
      already: true,
      key: existing.key,
      plan: existing.plan,
      username: existing.username,
    };
  }

  if (session.payment_status && session.payment_status !== "paid") {
    return { ok: false, error: "not_paid", payment_status: session.payment_status };
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
    typeof session.customer === "string" ? session.customer : session.customer?.id || null;
  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // Insert payment row first (PK = session_id) for idempotency under concurrent webhooks.
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
    // Race: another worker already inserted this session_id
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
    console.error("stripe_payments insert failed", err);
    return { ok: false, error: "db_insert_payment_failed" };
  }

  // Store key (plan column used by existing /validate + admin)
  try {
    await env.DB.prepare(
      `INSERT INTO keys (
        key,
        username,
        session_id,
        created_at,
        expires_at,
        revoked,
        executed,
        last_execution,
        plan
      ) VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?)`
    )
      .bind(key, username, `stripe:${sessionId}`, createdAt, expiresAt, plan)
      .run();
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
  const signature = request.headers.get("Stripe-Signature");

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
 * Does NOT create keys — read-only lookup after webhook provisioning.
 */
export async function handlePremiumStatus(request, env) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const url = new URL(request.url);
  const sessionId = (url.searchParams.get("session_id") || "").trim();

  if (!sessionId || sessionId.length > 200 || !/^cs_/.test(sessionId)) {
    return json({ ok: false, error: "invalid_session_id" }, 400);
  }

  const payment = await env.DB.prepare(
    `SELECT session_id, key, plan, username, created_at
     FROM stripe_payments WHERE session_id = ? LIMIT 1`
  )
    .bind(sessionId)
    .first();

  if (!payment) {
    return json({
      ok: true,
      status: "pending",
      message: "Payment is being processed",
    });
  }

  const keyRow = await env.DB.prepare(
    `SELECT key, username, plan, expires_at, revoked, created_at
     FROM keys WHERE key = ? LIMIT 1`
  )
    .bind(payment.key)
    .first();

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
}
