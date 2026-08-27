const STRIPE_API = "https://api.stripe.com/v1";

export const STRIPE_PRICES = {
  week: "price_1U8mnb1OYiWwnfPTymLWHtdX",
  month: "price_1U8moZ1OYiWwnfPTqwhQrtjp",
  year: "price_1U8mpO1OYiWwnfPTQQRLzXAl",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
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

  const plan = String(body.plan || "").toLowerCase();
  const price = STRIPE_PRICES[plan];

  if (!price) {
    return json({
      ok: false,
      error: "invalid_plan",
      allowed: Object.keys(STRIPE_PRICES),
    }, 400);
  }

  const origin = new URL(request.url).origin;

  const params = new URLSearchParams();

  params.set("mode", "subscription");

  params.set("line_items[0][price]", price);
  params.set("line_items[0][quantity]", "1");

  params.set("managed_payments[enabled]", "false");

  params.set(
    "success_url",
    `${origin}/premium/success?session_id={CHECKOUT_SESSION_ID}`
  );

  params.set(
    "cancel_url",
    `${origin}/pricing`
  );

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
  if (!signature || !secret) {
    return false;
  }

  const parts = signature.split(",");

  let timestamp = null;
  const signatures = [];

  for (const part of parts) {
    const [key, value] = part.split("=");

    if (key === "t") {
      timestamp = value;
    }

    if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const timestampNumber = Number(timestamp);

  if (!Number.isFinite(timestampNumber)) {
    return false;
  }

  // Prevent replay attacks.
  if (
    Math.abs(
      Math.floor(Date.now() / 1000) - timestampNumber
    ) > 300
  ) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
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
    if (candidate.length !== expected.length) {
      continue;
    }

    let difference = 0;

    for (let i = 0; i < expected.length; i++) {
      difference |=
        expected.charCodeAt(i) ^ candidate.charCodeAt(i);
    }

    if (difference === 0) {
      return true;
    }
  }

  return false;
}


export async function handleStripeWebhook(request, env) {
  if (request.method !== "POST") {
    return json({
      ok: false,
      error: "method_not_allowed",
    }, 405);
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is missing");

    return json({
      ok: false,
      error: "webhook_not_configured",
    }, 500);
  }

  const payload = await request.text();

  const signature =
    request.headers.get("Stripe-Signature");

  const valid = await verifyStripeSignature(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );

  if (!valid) {
    return json({
      ok: false,
      error: "invalid_signature",
    }, 400);
  }

  let event;

  try {
    event = JSON.parse(payload);
  } catch {
    return json({
      ok: false,
      error: "invalid_json",
    }, 400);
  }

  switch (event.type) {

    case "checkout.session.completed":
      console.log(
        "Stripe checkout completed:",
        event.data?.object?.id
      );
      break;

    case "customer.subscription.updated":
      console.log(
        "Stripe subscription updated:",
        event.data?.object?.id
      );
      break;

    case "customer.subscription.deleted":
      console.log(
        "Stripe subscription deleted:",
        event.data?.object?.id
      );
      break;

    default:
      console.log(
        "Unhandled Stripe event:",
        event.type
      );
      break;
  }

  return json({
    received: true,
  });
}с
