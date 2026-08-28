/**
 * greedyhudzell.xyz — unified Worker
 * - Key system (Work.ink + D1)
 * - Admin: generate / renew / revoke / key
 * - Lua proxies + Obfuscator
 *
 * Bindings: DB (D1)
 * Secrets: ADMIN_SECRET, ROTATION_SECRET, LUAOBF_API_KEY (optional)
 * Vars: SITE_NAME
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const SESSION_TTL = 30 * 60;
const KEY_TTL = 24 * 60 * 60;
const PLAN_TTL = {
  day: 24 * 60 * 60,
  week: 7 * 24 * 60 * 60,
  month: 30 * 24 * 60 * 60,
  year: 365 * 24 * 60 * 60,
};
function planTtl(plan) {
  return PLAN_TTL[plan] || PLAN_TTL.day;
}
const GAMEPASS_BY_PLAN = {
  week: "1963350769",
  month: "1965054742",
  year: "1966320456",
};
const GAMEPASS_STORE = {
  week: "https://www.roblox.com/game-pass/1963350769",
  month: "https://www.roblox.com/game-pass/1965054742",
  year: "https://www.roblox.com/game-pass/1966320456",
};
const DISCORD_REDEEM_CHANNEL = "https://discord.com/channels/1422222409846620201/1448630361390055454";
const REDEEM_SUPPORT_HINT =
  "If you bought the Game Pass but could not redeem it, write in Discord: https://discord.com/channels/1422222409846620201/1448630361390055454";

const GH = "https://raw.githubusercontent.com/mixask/GH/main";
const LUAOBF_NEW = "https://luaobfuscator.com/api/obfuscator/newscript";
const LUAOBF_RUN = "https://luaobfuscator.com/api/obfuscator/obfuscate";
const LUAOBF_FALLBACK = "11ad3847-d943-4a76-ee19-f9acab3e85144ea9";
const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...jsonHeaders, ...corsHeaders, ...extraHeaders },
  });
}
function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}
function plain(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      ...corsHeaders,
    },
  });
}
function now() {
  return Math.floor(Date.now() / 1000);
}
function getClientIP(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    ""
  );
}
async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomString(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function generateKey() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  for (const byte of bytes) value += alphabet[byte % alphabet.length];
  return `GH-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
}
function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
/* ===================== WORK.INK ===================== */
async function validateWorkInkToken(token) {
  if (!token || token.length > 500) return { valid: false, reason: "missing_token" };
  try {
    const safeToken = encodeURIComponent(token);
    const response = await fetch(`https://work.ink/_api/v2/token/isValid/${safeToken}`);
    if (!response.ok) return { valid: false, reason: "workink_http_error" };
    const data = await response.json();
    return {
      valid: data.valid === true,
      byIp: data.info?.byIp ?? data.byIp ?? null,
      info: data.info ?? null,
    };
  } catch (error) {
    console.error("Work.ink validation error:", error);
    return { valid: false, reason: "workink_request_failed" };
  }
}
/* ===================== DB / SESSION ===================== */
async function createSession(env, ipHash) {
  const timestamp = now();
  const sessionId = `GH-${randomString(32)}`;
  await env.DB.prepare(
    `INSERT INTO sessions (session_id, ip_hash, step1, step2, created_at, expires_at)
     VALUES (?, ?, 1, 0, ?, ?)`
  )
    .bind(sessionId, ipHash, timestamp, timestamp + SESSION_TTL)
    .run();
  return sessionId;
}
async function getSession(env, sessionId) {
  if (!sessionId) return null;
  return (
    (await env.DB.prepare(`SELECT * FROM sessions WHERE session_id = ? LIMIT 1`).bind(sessionId).first()) ||
    null
  );
}
async function validSession(env, sessionId, ipHash) {
  const session = await getSession(env, sessionId);
  if (!session) return { valid: false, reason: "session_not_found" };
  if (session.expires_at <= now()) return { valid: false, reason: "session_expired" };
  if (session.ip_hash !== ipHash) return { valid: false, reason: "ip_mismatch" };
  return { valid: true, session };
}
/* ===================== HTML SHELL ===================== */
function pageShell(title, content) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#080808;color:#fff;font-family:Arial,sans-serif}
.card{width:min(460px,calc(100% - 32px));background:#111;border:1px solid #292929;border-radius:18px;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.card.wide{width:min(980px,calc(100% - 24px))}
.logo{font-size:25px;font-weight:800;letter-spacing:1px;margin-bottom:24px}
.step{padding:12px 14px;border-radius:10px;background:#181818;margin:8px 0}
.ok{color:#6dff9a}
button{width:100%;padding:13px;margin-top:12px;border:0;border-radius:10px;background:#fff;color:#000;font-weight:700;cursor:pointer}
button.secondary{background:#181818;color:#fff;border:1px solid #333}
button:disabled{opacity:.55;cursor:wait}
input,select,textarea{width:100%;padding:13px;border-radius:10px;border:1px solid #333;background:#080808;color:#fff;outline:none}
textarea{min-height:200px;font-family:ui-monospace,monospace;resize:vertical}
label{display:block;margin:16px 0 7px;font-size:14px;color:#aaa}
.muted{color:#888;font-size:13px;line-height:1.5}
.error{color:#ff6d6d}
.nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.nav a{color:#aaa;text-decoration:none;font-size:13px}
.nav a:hover{color:#fff}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:800px){.grid{grid-template-columns:1fr}}
.chk{display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0;color:#ccc}
.plugins{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px}
@media(max-width:600px){.plugins{grid-template-columns:1fr}}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.actions button{flex:1;min-width:120px}
</style>
</head>
<body>
<div class="card${title.includes("Obfuscator") ? " wide" : ""}">
${content}
</div>
</body>
</html>`;
}
/* ===================== KEY FLOW ===================== */
async function handleGetKeyToken(request, env, token) {
  const work = await validateWorkInkToken(token);
  if (!work.valid) {
    return html(
      pageShell("Failed", `<div class="logo">${env.SITE_NAME}</div><h2>FAILED</h2><p>Invalid or expired Work.ink token.</p>`),
      403
    );
  }
  const currentIP = getClientIP(request);
  if (!currentIP) {
    return html(
      pageShell("Failed", `<div class="logo">${env.SITE_NAME}</div><h2>FAILED</h2><p>Unable to identify your IP address.</p>`),
      403
    );
  }
  const ipHash = await sha256(currentIP);
  const sessionId = await createSession(env, ipHash);
  return html(
    pageShell(
      "Step 1 Complete",
      `<div class="logo">${env.SITE_NAME}</div>
      <div class="step ok">✓ STEP 1 COMPLETE</div>
      <p class="muted">Work.ink token verified successfully.</p>
      <p class="muted">Continue to the second required step.</p>
      <a href="/step2"><button>CONTINUE TO STEP 2</button></a>`
    ),
    200,
    { "Set-Cookie": cookie("GH_SESSION", sessionId, SESSION_TTL) }
  );
}
async function handleStep2(request, env) {
  const sessionId = getCookie(request, "GH_SESSION");
  const currentIP = getClientIP(request);
  const ipHash = await sha256(currentIP);
  const result = await validSession(env, sessionId, ipHash);
  if (!result.valid || result.session.step1 !== 1) {
    return html(
      pageShell("Failed", `<div class="logo">${env.SITE_NAME}</div><h2>FAILED</h2><p>Please complete Step 1 first.</p>`),
      403
    );
  }
  const secondWorkInkLink = "https://work.ink/28wp/greedy-hudzell-12";
  return html(
    pageShell(
      "Step 2",
      `<div class="logo">${env.SITE_NAME}</div>
      <div class="step ok">✓ STEP 1 COMPLETE</div>
      <p class="muted">Complete Work.ink Step 2.</p>
      <a href="${secondWorkInkLink}"><button>CONTINUE TO STEP 2</button></a>`
    )
  );
}
async function handleFinish(request, env, token) {
  const sessionId = getCookie(request, "GH_SESSION");
  const currentIP = getClientIP(request);
  const ipHash = await sha256(currentIP);
  const sessionResult = await validSession(env, sessionId, ipHash);
  if (!sessionResult.valid) {
    return html(
      pageShell("Failed", `<div class="logo">${env.SITE_NAME}</div><h2>FAILED</h2><p>Your session is invalid or expired.</p>`),
      403
    );
  }
  const work = await validateWorkInkToken(token);
  if (!work.valid) {
    return html(
      pageShell("Failed", `<div class="logo">${env.SITE_NAME}</div><h2>FAILED</h2><p>Invalid Work.ink Step 2 token.</p>`),
      403
    );
  }
  await env.DB.prepare(`UPDATE sessions SET step2 = 1 WHERE session_id = ?`).bind(sessionId).run();
  return html(
    pageShell(
      "Key Generator",
      `<div class="logo">${env.SITE_NAME}</div>
      <div class="step ok">✓ STEP 1 COMPLETE</div>
      <div class="step ok">✓ STEP 2 COMPLETE</div>
      <label>Roblox username</label>
      <input id="username" maxlength="20" placeholder="Not displayname!" autocomplete="off">
      <button onclick="generateKey()">GENERATE KEY</button>
      <p id="result" class="muted"></p>
      <script>
      async function generateKey() {
        const username = document.getElementById("username").value.trim();
        const result = document.getElementById("result");
        if (!username) { result.textContent = "Enter your Roblox username."; return; }
        result.textContent = "Generating...";
        try {
          const response = await fetch("/generate-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username })
          });
          const data = await response.json();
          if (!data.success) { result.textContent = data.reason || "Failed to generate key."; return; }
          result.innerHTML = "Your key:<br><br><strong>" + data.key + "</strong>";
        } catch { result.textContent = "Network error."; }
      }
      </script>`
    )
  );
}
async function handleGenerateKey(request, env) {
  const sessionId = getCookie(request, "GH_SESSION");
  const currentIP = getClientIP(request);
  if (!currentIP) return json({ success: false, reason: "ip_unavailable" }, 403);
  const ipHash = await sha256(currentIP);
  const sessionResult = await validSession(env, sessionId, ipHash);
  if (!sessionResult.valid) return json({ success: false, reason: sessionResult.reason }, 403);
  if (sessionResult.session.step1 !== 1 || sessionResult.session.step2 !== 1) {
    return json({ success: false, reason: "steps_not_completed" }, 403);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, reason: "invalid_json" }, 400);
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (username.length < 3 || username.length > 20 || !/^[A-Za-z0-9_]+$/.test(username)) {
    return json({ success: false, reason: "invalid_username" }, 400);
  }
  const existing = await env.DB.prepare(`SELECT key FROM keys WHERE session_id = ? LIMIT 1`).bind(sessionId).first();
  if (existing) return json({ success: true, key: existing.key, already_generated: true });
  const key = generateKey();
  const timestamp = now();
  await env.DB.prepare(
    `INSERT INTO keys (key, username, session_id, created_at, expires_at, revoked, executed, last_execution, plan)
     VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?)`
  )
    .bind(key, username, sessionId, timestamp, timestamp + KEY_TTL, "day")
    .run();
  return json({ success: true, key, expires_at: timestamp + KEY_TTL });
}
async function handleValidate(request, env) {
  if (request.method !== "POST") return json({ valid: false, reason: "method_not_allowed" }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ valid: false, reason: "invalid_json" }, 400);
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!key || !username) return json({ valid: false, reason: "missing_key_or_username" });
  const record = await env.DB.prepare(`SELECT * FROM keys WHERE key = ? LIMIT 1`).bind(key).first();
  if (!record) return json({ valid: false, reason: "invalid_key" });
  if (record.revoked === 1) return json({ valid: false, reason: "revoked" });
  if (record.expires_at <= now()) return json({ valid: false, reason: "expired" });
  if (record.username !== username) {
    const isPending = String(record.username || "").startsWith("pending_");
    if (isPending) {
      await env.DB.prepare(`UPDATE keys SET username = ? WHERE key = ?`).bind(username, key).run();
    } else {
      return json({ valid: false, reason: "username_mismatch" });
    }
  }
  const timestamp = now();
  await env.DB.prepare(`UPDATE keys SET executed = 1, last_execution = ? WHERE key = ?`).bind(timestamp, key).run();
  return json({
    valid: true,
    expires_at: record.expires_at,
    plan: record.plan || "day",
  });
}
/* ===================== ADMIN ===================== */
function adminAuthorized(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return false;
  return auth.slice(7) === env.ADMIN_SECRET;
}
async function createRotationToken(env) {
  const interval = Math.floor(Date.now() / 1000 / 600);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.ROTATION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(interval)));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function handleAdminKeys(request, env, rotation) {
  if (!adminAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
  const expectedRotation = await createRotationToken(env);
  if (rotation !== expectedRotation) return json({ error: "Invalid rotation" }, 403);
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() || "";
  let result;
  if (search) {
    result = await env.DB.prepare(
      `SELECT * FROM keys WHERE key LIKE ? OR username LIKE ? ORDER BY created_at DESC`
    )
      .bind(`%${search}%`, `%${search}%`)
      .all();
  } else {
    result = await env.DB.prepare(`SELECT * FROM keys ORDER BY created_at DESC`).all();
  }
  return json({
    keys: result.results.map((k) => ({
      key: k.key,
      username: k.username,
      plan: k.plan || "day",
      executed: k.executed === 1,
      last_execution: k.last_execution,
      created_at: k.created_at,
      expires_at: k.expires_at,
      revoked: k.revoked === 1,
      status: k.revoked === 1 ? "REVOKED" : k.expires_at <= now() ? "EXPIRED" : "ACTIVE",
    })),
  });
}
async function handleAdminRevoke(request, env) {
  if (!adminAuthorized(request, env)) return json({ success: false, reason: "unauthorized" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, reason: "invalid_json" }, 400);
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) return json({ success: false, reason: "missing_key" }, 400);
  const result = await env.DB.prepare(`UPDATE keys SET revoked = 1 WHERE key = ?`).bind(key).run();
  if (!result.meta.changes) return json({ success: false, reason: "key_not_found" }, 404);
  return json({ success: true });
}
async function handleAdminKey(request, env, key) {
  if (!adminAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
  const record = await env.DB.prepare(`SELECT * FROM keys WHERE key = ? LIMIT 1`).bind(key).first();
  if (!record) return json({ error: "Key not found" }, 404);
  return json({
    key: record.key,
    username: record.username,
    plan: record.plan || "day",
    session_id: record.session_id,
    created_at: record.created_at,
    expires_at: record.expires_at,
    revoked: record.revoked === 1,
    executed: record.executed === 1,
    last_execution: record.last_execution,
    status: record.revoked === 1 ? "REVOKED" : record.expires_at <= now() ? "EXPIRED" : "ACTIVE",
  });
}
/** Discord bot / admin panel: create key with plan week|month|year|day */
async function handleAdminGenerate(request, env) {
  if (!adminAuthorized(request, env)) return json({ success: false, reason: "unauthorized" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, reason: "invalid_json" }, 400);
  }
  const plan = typeof body.plan === "string" ? body.plan.trim().toLowerCase() : "month";
  if (!PLAN_TTL[plan]) return json({ success: false, reason: "invalid_plan", allowed: Object.keys(PLAN_TTL) }, 400);

  let username = typeof body.username === "string" ? body.username.trim() : "";
  if (username) {
    if (username.length < 3 || username.length > 20 || !/^[A-Za-z0-9_]+$/.test(username)) {
      return json({ success: false, reason: "invalid_username" }, 400);
    }
  }

  const key = generateKey();
  const timestamp = now();
  const expires = timestamp + planTtl(plan);
  const storedUser = username || ("pending_" + key.replace(/-/g, "").slice(0, 12));

  await env.DB.prepare(
    `INSERT INTO keys (key, username, session_id, created_at, expires_at, revoked, executed, last_execution, plan)
     VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?)`
  )
    .bind(key, storedUser, "admin:" + timestamp, timestamp, expires, plan)
    .run();

  return json({
    success: true,
    key,
    plan,
    expires_at: expires,
    username: username || null,
    pending: !username,
  });
}
/** Extend key by N days (un-revokes) */
async function handleAdminRenew(request, env) {
  if (!adminAuthorized(request, env)) return json({ success: false, reason: "unauthorized" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, reason: "invalid_json" }, 400);
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const days = Math.max(1, Math.min(365, Number(body.days) || 0));
  if (!key || !days) return json({ success: false, reason: "missing_key_or_days" }, 400);

  const record = await env.DB.prepare(`SELECT * FROM keys WHERE key = ? LIMIT 1`).bind(key).first();
  if (!record) return json({ success: false, reason: "key_not_found" }, 404);

  const base = Math.max(Number(record.expires_at) || 0, now());
  const expires = base + days * 24 * 60 * 60;

  await env.DB.prepare(`UPDATE keys SET expires_at = ?, revoked = 0 WHERE key = ?`).bind(expires, key).run();

  return json({
    success: true,
    key,
    expires_at: expires,
    username: record.username,
    plan: record.plan || "day",
  });
}

/** Rewire username — GH-PAID-* keys only */
async function handleAdminRewire(request, env) {
  if (!adminAuthorized(request, env)) return json({ success: false, reason: "unauthorized" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, reason: "invalid_json" }, 400);
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!key) return json({ success: false, reason: "missing_key" }, 400);
  if (username.length < 3 || username.length > 20 || !/^[A-Za-z0-9_]+$/.test(username)) {
    return json({ success: false, reason: "invalid_username" }, 400);
  }
  if (!key.startsWith("GH-PAID-")) {
    return json({ success: false, reason: "rewire_only_paid", details: "Only GH-PAID-* keys can be rewired" }, 400);
  }

  const record = await env.DB.prepare(`SELECT * FROM keys WHERE key = ? LIMIT 1`).bind(key).first();
  if (!record) return json({ success: false, reason: "key_not_found" }, 404);
  if (record.revoked === 1) return json({ success: false, reason: "revoked" }, 400);
  if (Number(record.expires_at) <= now()) return json({ success: false, reason: "expired" }, 400);

  const previous = record.username;
  await env.DB.prepare(`UPDATE keys SET username = ? WHERE key = ?`).bind(username, key).run();

  return json({
    success: true,
    key,
    previous_username: previous,
    username,
    plan: record.plan || "paid",
    expires_at: record.expires_at,
  });
}

/** Key issuance stats (day / week / totals) */
async function handleAdminStats(request, env) {
  if (!adminAuthorized(request, env)) return json({ success: false, reason: "unauthorized" }, 401);
  const t = now();
  const dayAgo = t - 86400;
  const weekAgo = t - 7 * 86400;

  const row = async (sql, binds = []) => {
    const r = await env.DB.prepare(sql).bind(...binds).first();
    return Number(r && r.c != null ? r.c : 0);
  };

  const total = await row(`SELECT COUNT(*) AS c FROM keys`);
  const active = await row(
    `SELECT COUNT(*) AS c FROM keys WHERE revoked = 0 AND expires_at > ?`,
    [t]
  );
  const revoked = await row(`SELECT COUNT(*) AS c FROM keys WHERE revoked = 1`);
  const day = await row(`SELECT COUNT(*) AS c FROM keys WHERE created_at >= ?`, [dayAgo]);
  const week = await row(`SELECT COUNT(*) AS c FROM keys WHERE created_at >= ?`, [weekAgo]);
  const paid = await row(`SELECT COUNT(*) AS c FROM keys WHERE key LIKE 'GH-PAID-%'`);
  const paidActive = await row(
    `SELECT COUNT(*) AS c FROM keys WHERE key LIKE 'GH-PAID-%' AND revoked = 0 AND expires_at > ?`,
    [t]
  );
  const dayPaid = await row(
    `SELECT COUNT(*) AS c FROM keys WHERE created_at >= ? AND key LIKE 'GH-PAID-%'`,
    [dayAgo]
  );
  const weekPaid = await row(
    `SELECT COUNT(*) AS c FROM keys WHERE created_at >= ? AND key LIKE 'GH-PAID-%'`,
    [weekAgo]
  );

  return json({
    success: true,
    now: t,
    total,
    active,
    revoked,
    issued_day: day,
    issued_week: week,
    paid_total: paid,
    paid_active: paidActive,
    paid_day: dayPaid,
    paid_week: weekPaid,
  });
}

async function robloxUserIdFromUsername(username) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/to-ids", {
      method: "POST",
      headers,
      body: JSON.stringify({
        usernames: [username],
        excludeBannedUsers: false,
      }),
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    if (res.status === 429) return { ok: false, reason: "roblox_users_http_429" };
    if (res.ok && data) {
      const row = (data.data || []).find((x) => {
        const a = String(x.requestedUsername || "").toLowerCase();
        const b = String(x.name || "").toLowerCase();
        const u = username.toLowerCase();
        return a === u || b === u;
      });
      if (row && row.id != null) {
        return { ok: true, userId: String(row.id), name: row.name || username };
      }
      if (Array.isArray(data.data) && data.data.length === 0) {
        return { ok: false, reason: "username_not_found" };
      }
    } else {
      console.error("to-ids status", res.status, (text || "").slice(0, 200));
    }
  } catch (e) {
    console.error("users.to-ids", e);
  }
  try {
    const q = encodeURIComponent(username);
    const res2 = await fetch(
      `https://users.roblox.com/v1/users/search?keyword=${q}&limit=10`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": headers["User-Agent"],
        },
      }
    );
    const text2 = await res2.text();
    let data2 = null;
    try { data2 = JSON.parse(text2); } catch (_) {}
    if (res2.status === 429) return { ok: false, reason: "roblox_users_http_429" };
    if (res2.ok && data2) {
      const row2 = (data2.data || []).find(
        (x) => String(x.name || "").toLowerCase() === username.toLowerCase()
      );
      if (row2 && row2.id != null) {
        return { ok: true, userId: String(row2.id), name: row2.name || username };
      }
      return { ok: false, reason: "username_not_found" };
    }
    return { ok: false, reason: "roblox_users_http_" + res2.status };
  } catch (e) {
    console.error("users.search", e);
    return { ok: false, reason: "roblox_users_network" };
  }
}
async function ownsGamePass(userId, gamePassId) {
  const url =
    `https://inventory.roblox.com/v1/users/${encodeURIComponent(userId)}` +
    `/items/GamePass/${encodeURIComponent(gamePassId)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (res.status === 429) return { ok: false, reason: "inventory_http_429" };
  if (res.status === 403) return { ok: false, reason: "inventory_private" };
  if (res.status === 404) return { ok: true, owned: false };
  if (!res.ok) return { ok: false, reason: "inventory_http_" + res.status };
  const data = await res.json();
  const list = data.data || data;
  const owned = Array.isArray(list) && list.length > 0;
  return { ok: true, owned };
}
async function handleRedeemGamepass(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({
      success: false,
      reason: "invalid_json",
      support: REDEEM_SUPPORT_HINT,
      discord: DISCORD_REDEEM_CHANNEL,
    }, 400);
  }
  const plan = typeof body.plan === "string" ? body.plan.trim().toLowerCase() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const inventoryPublic = body.inventory_public === true || body.inventoryPublic === true;
  if (!GAMEPASS_BY_PLAN[plan]) {
    return json({
      success: false,
      reason: "invalid_plan",
      allowed: Object.keys(GAMEPASS_BY_PLAN),
      support: REDEEM_SUPPORT_HINT,
      discord: DISCORD_REDEEM_CHANNEL,
    }, 400);
  }
  if (!username || username.length < 3 || username.length > 20 || !/^[A-Za-z0-9_]+$/.test(username)) {
    return json({
      success: false,
      reason: "invalid_username",
      support: REDEEM_SUPPORT_HINT,
      discord: DISCORD_REDEEM_CHANNEL,
    }, 400);
  }
  if (!inventoryPublic) {
    return json({
      success: false,
      reason: "inventory_checkbox_required",
      message: "Set Roblox inventory to Everyone and check the box.",
      support: REDEEM_SUPPORT_HINT,
      discord: DISCORD_REDEEM_CHANNEL,
    }, 400);
  }
  const gamepassId = GAMEPASS_BY_PLAN[plan];
  const byName = await env.DB.prepare(
    `SELECT key_value, plan, user_id FROM pass_redemptions
     WHERE lower(username) = lower(?) AND gamepass_id = ?
     LIMIT 1`
  )
    .bind(username, gamepassId)
    .first();
  if (byName) {
    return json({
      success: true,
      already_redeemed: true,
      key: byName.key_value,
      plan: byName.plan,
      message: "This Game Pass was already redeemed. Showing existing key.",
    });
  }
  const user = await robloxUserIdFromUsername(username);
  if (!user.ok) {
    const msg = String(user.reason || "").includes("429")
      ? "Roblox rate limit. Wait 1-2 minutes and try again."
      : "Could not resolve Roblox username.";
    return json({
      success: false,
      reason: user.reason,
      message: msg,
      support: REDEEM_SUPPORT_HINT,
      discord: DISCORD_REDEEM_CHANNEL,
    }, 400);
  }
  const byId = await env.DB.prepare(
    `SELECT key_value, plan FROM pass_redemptions
     WHERE user_id = ? AND gamepass_id = ? LIMIT 1`
  )
    .bind(user.userId, gamepassId)
    .first();
  if (byId) {
    return json({
      success: true,
      already_redeemed: true,
      key: byId.key_value,
      plan: byId.plan,
      message: "This Game Pass was already redeemed. Showing existing key.",
    });
  }
  const own = await ownsGamePass(user.userId, gamepassId);
  if (!own.ok) {
    let msg = "Could not check Game Pass ownership.";
    if (own.reason === "inventory_private") {
      msg = "Inventory is private. Set Who can see my inventory = Everyone, wait 1-2 min, retry.";
    } else if (String(own.reason).includes("429")) {
      msg = "Roblox rate limit. Wait 1-2 minutes and try again.";
    }
    return json({
      success: false,
      reason: own.reason,
      message: msg,
      support: REDEEM_SUPPORT_HINT,
      discord: DISCORD_REDEEM_CHANNEL,
    }, 400);
  }
  if (!own.owned) {
    return json({
      success: false,
      reason: "not_owned",
      message: "Game Pass not found on this account. Buy it, wait ~30s, retry.",
      store: GAMEPASS_STORE[plan],
      support: REDEEM_SUPPORT_HINT,
      discord: DISCORD_REDEEM_CHANNEL,
    }, 404);
  }
  const key = generateKey();
  const timestamp = now();
  const expires = timestamp + planTtl(plan);
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO keys (key, username, session_id, created_at, expires_at, revoked, executed, last_execution, plan)
         VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?)`
      ).bind(key, user.name || username, "pass:" + gamepassId, timestamp, expires, plan),
      env.DB.prepare(
        `INSERT INTO pass_redemptions (user_id, username, gamepass_id, plan, key_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(user.userId, user.name || username, gamepassId, plan, key, timestamp),
    ]);
  } catch (e) {
    const again = await env.DB.prepare(
      `SELECT key_value, plan FROM pass_redemptions WHERE user_id = ? AND gamepass_id = ? LIMIT 1`
    )
      .bind(user.userId, gamepassId)
      .first();
    if (again) {
      return json({
        success: true,
        already_redeemed: true,
        key: again.key_value,
        plan: again.plan,
      });
    }
    console.error("redeem insert", e);
    return json({
      success: false,
      reason: "db_error",
      message: "Database error while creating key.",
      support: REDEEM_SUPPORT_HINT,
      discord: DISCORD_REDEEM_CHANNEL,
    }, 500);
  }
  return json({
    success: true,
    key,
    plan,
    expires_at: expires,
    username: user.name || username,
    user_id: user.userId,
  });
}

/* ===================== LUA PROXY ===================== */
async function proxyGithub(file) {
  const response = await fetch(`${GH}/${file}`, { cf: { cacheTtl: 0, cacheEverything: false } });
  if (!response.ok) return plain(`${file} not found`, 404);
  return plain(await response.text(), 200);
}
/* ===================== OBFUSCATOR (same as before) ===================== */
const PLUGIN_DEFS = [
  { key: "EncryptStrings", label: "Encrypt Strings", args: [100] },
  { key: "SwizzleLookups", label: "Swizzle Lookups", args: [100] },
  { key: "TableIndirection", label: "Table Indirection", args: [100] },
  { key: "EncryptFuncDeclaration", label: "Encrypt Func Declaration", args: [] },
  { key: "ControlFlowFlattenV1AllBlocks", label: "Control Flow Flatten V1", args: [75] },
  { key: "ControlFlowFlattenAllBlocks", label: "Control Flow Flatten (alt)", args: [75] },
  { key: "RevertAllIfStatements", label: "Revert If Statements", args: [50] },
  { key: "JunkifyAllIfStatements", label: "Junkify If Statements", args: [50] },
  { key: "MixedBooleanArithmetic", label: "Mixed Boolean Arithmetic", args: [75] },
  { key: "MutateAllLiterals", label: "Mutate Literals", args: [50] },
  { key: "DummyFunctionArgs", label: "Dummy Function Args", args: [1, 3] },
];
function presetConfig(preset) {
  if (preset === "basic" || preset === "light") {
    return {
      MinifiyAll: true,
      Virtualize: false,
      CustomPlugins: { SwizzleLookups: [100], EncryptStrings: [100], TableIndirection: [100] },
    };
  }
  if (preset === "medium") {
    return {
      MinifiyAll: true,
      Virtualize: false,
      CustomPlugins: {
        SwizzleLookups: [100],
        EncryptStrings: [100],
        TableIndirection: [100],
        ControlFlowFlattenV1AllBlocks: [75],
        RevertAllIfStatements: [50],
        MutateAllLiterals: [40],
        JunkifyAllIfStatements: [40],
      },
    };
  }
  if (preset === "full" || preset === "vm") {
    return {
      MinifiyAll: true,
      Virtualize: true,
      ASCIIArt: "feet_1",
      CustomPlugins: {
        SwizzleLookups: [100],
        EncryptStrings: [100],
        TableIndirection: [100],
        EncryptFuncDeclaration: [],
        ControlFlowFlattenV1AllBlocks: [100],
        RevertAllIfStatements: [75],
        MixedBooleanArithmetic: [75],
        MutateAllLiterals: [60],
        JunkifyAllIfStatements: [50],
        DummyFunctionArgs: [1, 3],
      },
    };
  }
  return {
    MinifiyAll: true,
    Virtualize: false,
    CustomPlugins: { SwizzleLookups: [100], EncryptStrings: [100], TableIndirection: [100] },
  };
}
function buildConfigFromOptions(opts) {
  opts = opts || {};
  const cfg = { MinifiyAll: opts.MinifiyAll !== false, Virtualize: !!opts.Virtualize };
  if (opts.Multifile) cfg.Multifile = true;
  if (opts.ASCIIArt) cfg.ASCIIArt = opts.ASCIIArt;
  const plugins = {};
  for (const p of PLUGIN_DEFS) {
    if (opts[p.key]) plugins[p.key] = Array.isArray(p.args) ? p.args : [];
  }
  if (Object.keys(plugins).length) cfg.CustomPlugins = plugins;
  return cfg;
}
function plainLongStringEmbed(code) {
  if (code.includes("]=====]")) return `-- embed\nreturn loadstring([======[\n${code}\n]======])()`;
  return `-- embed\nreturn loadstring([=====[\n${code}\n]=====])()`;
}
function bit32Embed(code) {
  const key = 0x5a;
  const bytes = [];
  for (let i = 0; i < code.length; i++) bytes.push(code.charCodeAt(i) ^ (key + (i % 17)));
  const parts = [];
  for (let i = 0; i < bytes.length; i += 40) parts.push(bytes.slice(i, i + 40).join(","));
  const dataLua = parts.map((p) => "{" + p + "}").join(",\n");
  const payload = `-- Greedy embed+bit32
local _k=${key}
local _chunks={${dataLua}}
local _out={}
local _i=0
for _,ch in ipairs(_chunks) do
  for _,b in ipairs(ch) do
    _i=_i+1
    _out[#_out+1]=string.char(bit32.bxor(b,(_k+((_i-1)%17))))
  end
end
local _src=table.concat(_out)
local _fn,_err=loadstring(_src)
if not _fn then error(_err) end
return _fn()
`;
  if (payload.includes("]=====]")) return `return loadstring([======[\n${payload}\n]======])()`;
  return `return loadstring([=====[\n${payload}\n]=====])()`;
}
function _ghXorStr(s, seed) {
  const bytes = [];
  for (let k = 0; k < s.length; k++) bytes.push(s.charCodeAt(k) ^ ((seed + k * 7) & 255));
  return bytes;
}
function _ghParseStringsAndComments(src, opts) {
  const strings = [];
  let out = "";
  let i = 0;
  const encrypt = opts.encryptStrings !== false;
  while (i < src.length) {
    const c = src[i];
    if (c === "-" && src[i + 1] === "-") {
      let j = i + 2;
      if (src[j] === "[") {
        let n = 0;
        j++;
        while (src[j] === "=") {
          n++;
          j++;
        }
        if (src[j] === "[") {
          j++;
          while (j < src.length) {
            if (src[j] === "]") {
              let k = j + 1,
                m = 0;
              while (src[k] === "=") {
                m++;
                k++;
              }
              if (m === n && src[k] === "]") {
                j = k + 1;
                break;
              }
            }
            j++;
          }
          if (!opts.stripComments) out += src.slice(i, j);
          i = j;
          continue;
        }
      }
      const lineStart = i;
      while (i < src.length && src[i] !== "\n") i++;
      if (!opts.stripComments) out += src.slice(lineStart, i);
      continue;
    }
    if (c === "[" && (src[i + 1] === "[" || src[i + 1] === "=")) {
      let j = i + 1,
        n = 0;
      if (src[j] === "=") {
        while (src[j] === "=") {
          n++;
          j++;
        }
      }
      if (src[j] === "[") {
        j++;
        while (j < src.length) {
          if (src[j] === "]") {
            let k = j + 1,
              m = 0;
            while (src[k] === "=") {
              m++;
              k++;
            }
            if (m === n && src[k] === "]") {
              j = k + 1;
              break;
            }
          }
          j++;
        }
        out += src.slice(i, j);
        i = j;
        continue;
      }
    }
    if (encrypt && (c === '"' || c === "'")) {
      const q = c;
      let j = i + 1,
        lit = "";
      while (j < src.length) {
        if (src[j] === "\\") {
          lit += src[j] + (src[j + 1] || "");
          j += 2;
          continue;
        }
        if (src[j] === q) {
          j++;
          break;
        }
        lit += src[j];
        j++;
      }
      const raw = lit
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, "\\");
      strings.push(raw);
      out += "_S[" + strings.length + "]";
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return { code: out, strings };
}
function _ghAliasGlobals(code, level) {
  const sets = [
    { game: "_T[1]", workspace: "_T[2]", print: "_T[3]", warn: "_T[4]" },
    {
      game: "_T[1]",
      workspace: "_T[2]",
      pairs: "_T[3]",
      ipairs: "_T[4]",
      pcall: "_T[5]",
      type: "_T[6]",
      tostring: "_T[7]",
      tonumber: "_T[8]",
      print: "_T[9]",
      warn: "_T[10]",
      select: "_T[11]",
      next: "_T[12]",
      rawget: "_T[13]",
      rawset: "_T[14]",
    },
    {
      game: "_T[1]",
      workspace: "_T[2]",
      pairs: "_T[3]",
      ipairs: "_T[4]",
      pcall: "_T[5]",
      type: "_T[6]",
      tostring: "_T[7]",
      tonumber: "_T[8]",
      print: "_T[9]",
      warn: "_T[10]",
      select: "_T[11]",
      next: "_T[12]",
      rawget: "_T[13]",
      rawset: "_T[14]",
      require: "_T[15]",
      tick: "_T[16]",
      typeof: "_T[17]",
      unpack: "_T[18]",
      error: "_T[19]",
      assert: "_T[20]",
    },
  ];
  const aliases = sets[Math.max(0, Math.min(2, level - 1))];
  let body = code;
  for (const [name, repl] of Object.entries(aliases)) {
    body = body.replace(new RegExp("\\b" + name + "\\b", "g"), repl);
  }
  const list = {
    1: "game,workspace,print,warn",
    2: "game,workspace,pairs,ipairs,pcall,type,tostring,tonumber,print,warn,select,next,rawget,rawset",
    3: "game,workspace,pairs,ipairs,pcall,type,tostring,tonumber,print,warn,select,next,rawget,rawset,require,tick,typeof,unpack or table.unpack,error,assert",
  };
  return { body, tInit: list[level] || list[2] };
}
function _ghEncodeNumbers(code, level) {
  if (level < 2) return code;
  return code.replace(/\b([2-9]\d{0,4})\b/g, (m, n, off, s) => {
    const before = s.slice(Math.max(0, off - 3), off);
    if (/_S\[$|_T\[$/.test(before) || before.endsWith("[")) return m;
    const v = Number(n);
    if (level >= 3) {
      const a = (v ^ 0x3d) + 1;
      return "(bit32.bxor(" + a + ",61)-1)";
    }
    return "(" + (v + 17) + "-17)";
  });
}
function _ghJunk(level) {
  if (level < 2) return "";
  const lines = [];
  for (let i = 0; i < (level >= 3 ? 4 : 2); i++) {
    const n = 1000 + Math.floor(Math.random() * 8000);
    lines.push("do local _j" + i + "=" + n + " if _j" + i + "==" + (n + 1) + " then return end end");
  }
  return lines.join("\n") + "\n";
}
function _ghWrapRuntime(body, strings, tInit, seed) {
  const strTable = strings.map((s) => "{" + _ghXorStr(s, seed).join(",") + "}").join(",");
  return (
    "-- GH local obfuscate\n" +
    "local _T={" +
    tInit +
    "}\n" +
    "local _S={}\n" +
    "do local _d={" +
    strTable +
    "} local _k=" +
    seed +
    "\n" +
    "for _i=1,#_d do local _b=_d[_i] local _o={} for _j=1,#_b do " +
    "_o[_j]=string.char(bit32.bxor(_b[_j],bit32.band(_k+(_j-1)*7,255))) end " +
    "_S[_i]=table.concat(_o) end end\n" +
    _ghJunk(strings.length > 0 ? 2 : 1) +
    body
  );
}
function _ghObfuscateChunk(src, level) {
  const seed = 0x5a + level * 13;
  const parsed = _ghParseStringsAndComments(src, { encryptStrings: true, stripComments: level >= 2 });
  let code = parsed.code;
  const aliased = _ghAliasGlobals(code, level);
  code = aliased.body;
  code = _ghEncodeNumbers(code, level);
  if (level >= 2) code = code.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return _ghWrapRuntime(code, parsed.strings, aliased.tInit, seed);
}
function _ghProcessLongBrackets(code, level) {
  let i = 0,
    out = "";
  while (i < code.length) {
    if (code[i] === "[") {
      let j = i + 1,
        n = 0;
      while (code[j] === "=") {
        n++;
        j++;
      }
      if (code[j] === "[") {
        const openEnd = j + 1;
        let k = openEnd,
          closeAt = -1;
        while (k < code.length) {
          if (code[k] === "]") {
            let m = 0,
              p = k + 1;
            while (code[p] === "=") {
              m++;
              p++;
            }
            if (m === n && code[p] === "]") {
              closeAt = k;
              break;
            }
          }
          k++;
        }
        if (closeAt >= 0) {
          const inner = code.slice(openEnd, closeAt);
          const closeEnd = closeAt + 1 + n + 1;
          const looksCode = /\b(function|local|end|return|game:|GetService|print\s*\()\b/.test(inner);
          if (looksCode && inner.trim().length > 8) {
            const ob = _ghObfuscateChunk(inner, level);
            let eqs = n;
            while (ob.indexOf("]" + "=".repeat(eqs) + "]") !== -1 && eqs < 12) eqs++;
            out += "[" + "=".repeat(eqs) + "[" + ob + "]" + "=".repeat(eqs) + "]";
          } else {
            out += code.slice(i, closeEnd);
          }
          i = closeEnd;
          continue;
        }
      }
    }
    out += code[i];
    i++;
  }
  return out;
}
function localObfuscate(code, level) {
  level = Math.max(1, Math.min(3, level || 1));
  const step1 = _ghProcessLongBrackets(code, level);
  let i = 0,
    out = "";
  while (i < step1.length) {
    if (step1[i] === "[") {
      let j = i + 1,
        n = 0;
      while (step1[j] === "=") {
        n++;
        j++;
      }
      if (step1[j] === "[") {
        const openEnd = j + 1;
        let k = openEnd,
          closeAt = -1;
        while (k < step1.length) {
          if (step1[k] === "]") {
            let m = 0,
              p = k + 1;
            while (step1[p] === "=") {
              m++;
              p++;
            }
            if (m === n && step1[p] === "]") {
              closeAt = k;
              break;
            }
          }
          k++;
        }
        if (closeAt >= 0) {
          out += step1.slice(i, closeAt + 1 + n + 1);
          i = closeAt + 1 + n + 1;
          continue;
        }
      }
    }
    let start = i;
    while (i < step1.length) {
      if (step1[i] === "[") {
        let j = i + 1,
          n = 0;
        while (step1[j] === "=") {
          n++;
          j++;
        }
        if (step1[j] === "[") break;
      }
      i++;
    }
    const plain = step1.slice(start, i);
    if (plain.trim()) out += _ghObfuscateChunk(plain, level);
    else out += plain;
  }
  return out;
}
function localBasicObfuscate(code) {
  return localObfuscate(code, 1);
}
async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error("timeout " + ms + "ms")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function callLuaObf(apiKey, code, cfg) {
  const newRes = await fetch(LUAOBF_NEW, {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8", apikey: apiKey },
    body: code,
  });
  if (!newRes.ok) {
    const t = await newRes.text();
    return { ok: false, error: `newscript HTTP ${newRes.status}: ${t.slice(0, 300)}` };
  }
  let session;
  try {
    session = await newRes.json();
  } catch {
    return { ok: false, error: "newscript: invalid JSON" };
  }
  const sessionId = session.sessionId || newRes.headers.get("sessionId") || newRes.headers.get("sessionid");
  if (!sessionId) return { ok: false, error: session.message || "no sessionId from newscript" };
  const runRes = await fetch(LUAOBF_RUN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      sessionId: sessionId,
    },
    body: JSON.stringify(cfg || {}),
  });
  if (!runRes.ok) {
    const t = await runRes.text();
    return { ok: false, error: `obfuscate HTTP ${runRes.status}: ${t.slice(0, 300)}` };
  }
  let out;
  try {
    out = await runRes.json();
  } catch {
    return { ok: false, error: "obfuscate: invalid JSON" };
  }
  if (!out.code) return { ok: false, error: out.message || "empty code from API" };
  return { ok: true, code: out.code, sessionId };
}
function syntaxCheck(code) {
  const issues = [];
  if (!code || !code.trim()) return { ok: false, issues: ["empty code"] };
  const pairs = { "(": ")", "[": "]", "{": "}" };
  const stack = [];
  let i = 0;
  let line = 1;
  let inStr = null;
  let longEq = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === "\n") line++;
    if (!inStr && c === "[" && code[i + 1] === "[") {
      inStr = "long";
      longEq = 0;
      i += 2;
      continue;
    }
    if (!inStr && c === "[" && code[i + 1] === "=") {
      let n = 0;
      let j = i + 1;
      while (code[j] === "=") {
        n++;
        j++;
      }
      if (code[j] === "[") {
        inStr = "long";
        longEq = n;
        i = j + 1;
        continue;
      }
    }
    if (inStr === "long") {
      if (c === "]") {
        let n = 0;
        let j = i + 1;
        while (code[j] === "=") {
          n++;
          j++;
        }
        if (n === longEq && code[j] === "]") {
          inStr = null;
          i = j + 1;
          continue;
        }
      }
      i++;
      continue;
    }
    if (!inStr && c === "-" && code[i + 1] === "-") {
      let j = i + 2;
      if (code[j] === "[") {
        let n = 0;
        j++;
        while (code[j] === "=") {
          n++;
          j++;
        }
        if (code[j] === "[") {
          j++;
          while (j < code.length) {
            if (code[j] === "\n") line++;
            if (code[j] === "]") {
              let k = j + 1;
              let m = 0;
              while (code[k] === "=") {
                m++;
                k++;
              }
              if (m === n && code[k] === "]") {
                i = k + 1;
                break;
              }
            }
            j++;
          }
          if (j >= code.length) {
            issues.push("unclosed long comment --[[");
            break;
          }
          continue;
        }
      }
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (!inStr && (c === '"' || c === "'")) {
      inStr = c;
      i++;
      continue;
    }
    if (inStr === '"' || inStr === "'") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (pairs[c]) stack.push({ ch: c, line });
    else if (c === ")" || c === "]" || c === "}") {
      const top = stack.pop();
      if (!top || pairs[top.ch] !== c) issues.push(`line ${line}: unexpected '${c}'`);
    }
    i++;
  }
  if (inStr) issues.push("unclosed string/long-string");
  for (const s of stack) issues.push(`line ${s.line}: unclosed '${s.ch}'`);
  return { ok: issues.length === 0, issues };
}
function obfuscatePage(siteName) {
  return pageShell(
    "Obfuscator · " + siteName,
    `
<div class="logo">${siteName} · Obfuscator</div>
<p class="muted">API: luaobfuscator.com. Basic=local L1. Medium/Full/VM=API first, local fallback.</p>
<label>Preset</label>
<select id="preset">
  <option value="basic" selected>Basic — local L1</option>
  <option value="medium">Medium</option>
  <option value="full">Full</option>
  <option value="vm">VM</option>
  <option value="embed">Wrap loadstring</option>
  <option value="embed_bit32">Wrap bit32+loadstring</option>
  <option value="custom">Custom</option>
</select>
<div id="customBox" style="display:none;margin-top:10px">
  <label class="chk"><input type="checkbox" data-root="MinifiyAll" checked/> Minify All</label>
  <label class="chk"><input type="checkbox" data-root="Virtualize"/> Virtualize</label>
</div>
<label style="margin-top:14px">Input Lua</label>
<textarea id="input" placeholder="paste Lua..." style="min-height:220px"></textarea>
<div class="actions">
  <button id="run">Obfuscate</button>
  <button class="secondary" id="checkIn">Syntax check</button>
  <button class="secondary" id="copy">Copy output</button>
</div>
<label style="margin-top:14px">Output</label>
<textarea id="output" placeholder="result..." style="min-height:220px"></textarea>
<p id="status" class="muted"></p>
<script>
const statusEl=document.getElementById('status');
const input=document.getElementById('input');
const output=document.getElementById('output');
const preset=document.getElementById('preset');
const customBox=document.getElementById('customBox');
const runBtn=document.getElementById('run');
preset.onchange=()=>{ customBox.style.display = preset.value==='custom' ? 'block' : 'none'; };
function collectOptions(){
  const opts={};
  document.querySelectorAll('[data-root]').forEach(el=>opts[el.getAttribute('data-root')]=el.checked);
  document.querySelectorAll('[data-plugin]').forEach(el=>opts[el.getAttribute('data-plugin')]=el.checked);
  return opts;
}
document.getElementById('checkIn').onclick=async()=>{
  statusEl.textContent='Checking...';
  try{
    const res=await fetch('/api/syntax-check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:input.value||''})});
    const data=await res.json();
    statusEl.innerHTML=data.ok?'<span class="ok">Syntax OK</span>':'<span class="error">'+(data.issues||[]).join('<br>')+'</span>';
  }catch(e){statusEl.innerHTML='<span class="error">'+String(e)+'</span>'}
};
runBtn.onclick=async()=>{
  const code=input.value||'';
  if(!code.trim()){statusEl.textContent='Paste code first';return}
  runBtn.disabled=true;statusEl.textContent='Obfuscating...';output.value='';
  try{
    const res=await fetch('/api/obfuscate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({preset:preset.value,options:collectOptions(),code})});
    let data;
    try{ data=await res.json(); }catch(_){
      statusEl.innerHTML='<span class="error">Bad response HTTP '+res.status+'</span>';
      runBtn.disabled=false;return;
    }
    if(!data.ok){
      statusEl.innerHTML='<span class="error">'+(data.error||'failed')+'</span>';
    } else {
      output.value=data.code||'';
      statusEl.innerHTML='<span class="ok">OK · '+(data.mode||preset.value)+' · '+(data.code||'').length+' chars</span>';
    }
  }catch(e){statusEl.innerHTML='<span class="error">'+String(e)+'</span>'}
  runBtn.disabled=false;
};
document.getElementById('copy').onclick=async()=>{
  try{await navigator.clipboard.writeText(output.value||'');statusEl.textContent='Copied'}catch(_){statusEl.textContent='Copy failed'}
};
</script>
`
  );
}

/* ===================== SITE PAGES (black/gold nav) ===================== */
const DISCORD_INVITE = "https://discord.gg/sbVuaT9a2T";
const FREE_KEY_LINK = "https://work.ink/28wp/Greedy-hudzell";
const WEAO_URL = "https://weao.xyz/api/status/exploits";

function siteNav(active) {
  const items = [
    ["/home", "Home"],
    ["/pricing", "Pricing"],
    ["/status", "Status"],
    ["/executors", "Executors"],
    ["/guide", "Guide"],
    ["/tos", "ToS"],
    ["/obfuscator", "Obfuscator"],
  ];
  return items
    .map(([href, label]) => {
      const on = active === label.toLowerCase();
      return `<a href="${href}" class="${on ? "active" : ""}">${label}</a>`;
    })
    .join("");
}

function siteShell(title, active, bodyHtml, wide = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} · Greedy Hudzell</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
:root{
  --bg:#0a0a0a;--bg2:#111;--card:#141414;--border:#2a2a2a;
  --text:#f2f2f2;--muted:#9a9a9a;--gold:#C9A227;--gold-soft:#E8C547;
  --ok:#4caf7a;--bad:#e85d5d;--radius:16px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);
  min-height:100vh;line-height:1.55;
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -20%,rgba(201,162,39,.08),transparent),
    radial-gradient(ellipse 60% 40% at 100% 100%,rgba(255,255,255,.03),transparent);
}
a{color:var(--gold-soft);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{width:min(980px,94vw);margin:0 auto;padding:28px 0 80px}
.wrap.wide{width:min(1100px,94vw)}
.top{
  position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);
  background:rgba(10,10,10,.78);border-bottom:1px solid var(--border);
}
.top-inner{
  width:min(1100px,94vw);margin:0 auto;display:flex;align-items:center;
  justify-content:space-between;gap:16px;padding:14px 0;flex-wrap:wrap;
}
.brand{display:flex;align-items:center;gap:12px;font-weight:700;color:var(--text);text-decoration:none}
.brand:hover{text-decoration:none}
.brand-mark{
  width:34px;height:34px;border-radius:10px;
  background:linear-gradient(135deg,#1a1a1a,#2a2410);
  border:1px solid var(--gold);display:grid;place-items:center;
  color:var(--gold);font-size:14px;font-weight:700;
}
.nav{display:flex;flex-wrap:wrap;gap:6px}
.nav a{
  color:var(--muted);padding:8px 14px;border-radius:999px;
  border:1px solid transparent;font-size:13px;font-weight:500;text-decoration:none;
}
.nav a:hover{color:var(--text);border-color:var(--border);background:var(--card);text-decoration:none}
.nav a.active{color:#0a0a0a;background:var(--gold);border-color:var(--gold)}
.page-header{margin:28px 0 22px}
.page-header h1{font-size:1.85rem;font-weight:700;margin-bottom:6px}
.page-header .sub{color:var(--muted);font-size:14px}
.badge{
  display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;
  border-radius:999px;background:rgba(201,162,39,.12);color:var(--gold);
  border:1px solid rgba(201,162,39,.25);margin-bottom:14px;
}
.card{
  background:var(--card);border:1px solid var(--border);border-radius:var(--radius);
  padding:18px;margin:12px 0;
}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:720px){.grid2{grid-template-columns:1fr}}
label.f{display:block;color:var(--muted);font-size:12px;margin:10px 0 6px;font-weight:600}
input,select,textarea{
  width:100%;border-radius:10px;border:1px solid var(--border);
  background:#0c0c0c;color:var(--text);padding:11px 12px;font-size:13px;
}
input:focus,select:focus,textarea:focus{outline:1px solid rgba(201,162,39,.4)}
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:11px 16px;border-radius:999px;border:1px solid var(--border);
  background:var(--bg2);color:var(--text);font-weight:600;font-size:13px;
  cursor:pointer;text-decoration:none;
}
.btn:hover{border-color:var(--gold);color:var(--gold-soft);text-decoration:none}
.btn-gold{
  background:linear-gradient(135deg,var(--gold),#a8841a);
  color:#0a0a0a;border-color:var(--gold);
}
.btn-gold:hover{color:#0a0a0a;filter:brightness(1.05);text-decoration:none}
.muted{color:var(--muted);font-size:13px}
.ok{color:var(--ok)}
.err{color:var(--bad)}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--border)}
th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}
.price-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}
@media(max-width:900px){.price-grid{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.price-grid{grid-template-columns:1fr}}
.price-card{
  background:var(--card);border:1px solid var(--border);border-radius:var(--radius);
  padding:18px;display:flex;flex-direction:column;gap:8px;position:relative;
}
.price-card.featured{border-color:var(--gold);box-shadow:0 0 0 1px rgba(201,162,39,.2)}
.price-card .tag{
  position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;
  background:var(--gold);color:#0a0a0a;padding:3px 8px;border-radius:999px;
}
.price-card h3{font-size:1rem;font-weight:600}
.price-card .amount{font-size:1.7rem;font-weight:700;color:var(--gold-soft)}
.price-card .amount span{font-size:12px;color:var(--muted);font-weight:500}
.price-card ul{list-style:none;padding:0;margin:6px 0;flex:1}
.price-card ul li{font-size:13px;color:#c8c8c8;padding:4px 0 4px 16px;position:relative}
.price-card ul li::before{content:"✓";position:absolute;left:0;color:var(--gold);font-size:12px}
.foot{margin-top:32px;text-align:center;color:#555;font-size:12px}
</style>
</head>
<body>
<header class="top">
  <div class="top-inner">
    <a class="brand" href="/home">
      <div class="brand-mark">GH</div>
      <span>Greedy Hudzell</span>
    </a>
    <nav class="nav">${siteNav(active)}</nav>
  </div>
</header>
<main class="wrap${wide ? " wide" : ""}">
${bodyHtml}
  <div class="foot">© Greedy Hudzell · <a href="${DISCORD_INVITE}">Discord</a> · Not affiliated with Roblox</div>
</main>
</body>
</html>`;
}

function fmtSunc(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v) + (typeof v === "number" && !String(v).includes("%") ? "%" : "");
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return "—";
    if (/^\d+(\.\d+)?$/.test(t)) return t + "%";
    return t;
  }
  if (typeof v === "object") {
    // weao.xyz: real score is suncPercentage / uncPercentage; `sunc` is metadata keys only
    if (v.suncPercentage != null) return fmtSunc(v.suncPercentage);
    if (v.uncPercentage != null) return fmtSunc(v.uncPercentage);
    if (v.percentage != null) return fmtSunc(v.percentage);
    if (v.percent != null) return fmtSunc(v.percent);
    if (v.score != null && typeof v.score !== "object") return fmtSunc(v.score);
    // ignore suncScrap / suncKey blobs
    if (v.suncScrap != null || v.suncKey != null) return "—";
    return "—";
  }
  return "—";
}

function homePage() {
  return siteShell("Home", "home", `
  <div class="badge">Official</div>
  <h1>Greedy Hudzell</h1>
  <p class="sub">Keys, loader, updates. Check your key status below.</p>
  <div class="hero-actions">
    <a class="btn btn-gold" href="${FREE_KEY_LINK}" target="_blank" rel="noopener">Get free key</a>
    <a class="btn" href="/pricing">Pricing</a>
    <a class="btn" href="${DISCORD_INVITE}" target="_blank" rel="noopener">Discord</a>
  </div>
  <div class="grid2">
    <div class="card">
      <h3 style="margin-bottom:8px">Key status</h3>
      <label class="f">Key</label>
      <input id="k_key" placeholder="GH-XXXX-XXXX-XXXX" autocomplete="off"/>
      <label class="f">Roblox username</label>
      <input id="k_user" placeholder="Not display name" autocomplete="off"/>
      <button class="btn btn-gold" style="margin-top:12px;width:100%" id="k_btn" type="button">Check key</button>
      <p id="k_out" class="muted" style="margin-top:12px;white-space:pre-wrap"></p>
    </div>
    <div class="card">
      <h3 style="margin-bottom:8px">Loader</h3>
      <p class="muted" style="word-break:break-all"><code>loadstring(game:HttpGet("https://greedyhudzell.xyz/loader.lua"))()</code></p>
      <p class="muted" style="margin-top:12px"><a href="/guide">Guide</a> · <a href="/executors">Executors</a> · <a href="/status">Status</a></p>
    </div>
  </div>
<script>
(function(){
  const out=document.getElementById('k_out');
  const btn=document.getElementById('k_btn');
  btn.onclick=async function(){
    const key=(document.getElementById('k_key').value||'').trim();
    const username=(document.getElementById('k_user').value||'').trim();
    if(!key||!username){out.className='err';out.textContent='Enter key and username.';return;}
    out.className='muted';out.textContent='Checking...';btn.disabled=true;
    try{
      const res=await fetch('/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,username})});
      const data=await res.json();
      if(data.valid===true){
        out.className='ok';
        const exp=data.expires_at?new Date(Number(data.expires_at)*1000).toUTCString():'n/a';
        out.textContent='VALID\\nPlan: '+(data.plan||'n/a')+'\\nExpires: '+exp;
      }else{out.className='err';out.textContent='INVALID — '+(data.reason||res.status);}
    }catch(e){out.className='err';out.textContent=String(e);}
    btn.disabled=false;
  };
})();
</script>
`, true);
}

function statusPage() {
  return siteShell("Status", "status", `
  <div class="badge">Ops</div>
  <h1>Status</h1>
  <p class="sub">Public endpoints. For live incidents use Discord status channel.</p>
  <div class="card">
    <table>
      <tr><th>Component</th><th>Note</th></tr>
      <tr><td>Website</td><td>Online</td></tr>
      <tr><td>/validate</td><td>Key API</td></tr>
      <tr><td>/loader.lua</td><td>GitHub proxy</td></tr>
      <tr><td>Work.ink free keys</td><td>Third-party flow</td></tr>
      <tr><td>Discord bot</td><td>Keys / verify / updates</td></tr>
    </table>
  </div>
`);
}

function executorsPage() {
  // Client-side fetch + safe sUNC formatting
  return siteShell("Executors", "executors", `
  <div class="badge">Compatibility</div>
  <h1>Executors</h1>
  <p class="sub">Best-effort list. Prefer tools with HTTP, files, and queue_on_teleport.</p>
  <div class="card muted" id="ex_out">Loading…</div>
<script>
function fmtPct(v){
  if(v==null||v==="")return "—";
  if(typeof v==="number")return v+"%";
  if(typeof v==="boolean")return v?"yes":"no";
  if(typeof v==="string"){
    var t=v.trim();
    if(!t)return "—";
    if(/^\d+(\.\d+)?$/.test(t))return t+"%";
    return t;
  }
  return "—";
}
function pickSunc(x){
  if(!x||typeof x!=="object")return "—";
  // weao.xyz uses suncPercentage; sunc field is metadata keys only, not a score
  if(x.suncPercentage!=null)return fmtPct(x.suncPercentage);
  if(x.uncPercentage!=null)return fmtPct(x.uncPercentage);
  if(typeof x.sunc==="number"||typeof x.sunc==="string")return fmtPct(x.sunc);
  if(typeof x.sUNC==="number"||typeof x.sUNC==="string")return fmtPct(x.sUNC);
  if(x.percentage!=null)return fmtPct(x.percentage);
  if(x.percent!=null)return fmtPct(x.percent);
  if(x.unc!=null&&(typeof x.unc==="number"||typeof x.unc==="string"))return fmtPct(x.unc);
  return "—";
}
function fmtStatus(x){
  if(x.updateStatus===true||x.updateStatus==="true"||x.updateStatus==="Updated")return "Updated";
  if(x.updateStatus===false||x.updateStatus==="false")return "Not updated";
  if(x.updateStatus!=null&&typeof x.updateStatus!=="object")return String(x.updateStatus);
  if(x.status!=null&&typeof x.status!=="object")return String(x.status);
  if(x.updatedDate)return String(x.updatedDate);
  return "—";
}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
(async function(){
  const el=document.getElementById("ex_out");
  try{
    const res=await fetch(${JSON.stringify(WEAO_URL)},{headers:{Accept:"application/json"}});
    if(!res.ok)throw new Error("HTTP "+res.status);
    const data=await res.json();
    const list=Array.isArray(data)?data:(data.exploits||data.data||data.results||[]);
    if(!list.length){el.textContent="Empty list from weao.xyz";return;}
    const rows=list.slice(0,50).map(function(x){
      const name=x.title||x.name||x.executor||"?";
      const st=fmtStatus(x);
      const sunc=pickSunc(x);
      const unc=x.uncPercentage!=null?fmtPct(x.uncPercentage):"—";
      return "<tr><td>"+esc(name)+"</td><td>"+esc(st)+"</td><td>"+esc(sunc)+(unc!=="—"&&unc!==sunc?" · UNC "+esc(unc):"")+"</td></tr>";
    }).join("");
    el.className="card";
    el.innerHTML="<table><thead><tr><th>Executor</th><th>Status</th><th>sUNC %</th></tr></thead><tbody>"+rows+"</tbody></table>";
  }catch(e){
    el.textContent="Could not load weao.xyz ("+e+"). Use Discord recommendations.";
  }
})();
</script>
`);
}

function guidePage() {
  return siteShell("Guide", "guide", `
  <div class="badge">Docs</div>
  <h1>Guide</h1>
  <p class="sub">Free key → loader → hub.</p>
  <div class="card">
    <p><b>1.</b> Get a key (free Work.ink or paid on Discord).</p>
    <p style="margin-top:8px"><b>2.</b> Run: <code>loadstring(game:HttpGet("https://greedyhudzell.xyz/loader.lua"))()</code></p>
    <p style="margin-top:8px"><b>3.</b> Enter key. Check status anytime on <a href="/home">Home</a>.</p>
    <p style="margin-top:8px"><b>4.</b> Stack overflow after obfuscation → use light/raw, not Full/VM.</p>
  </div>
`);
}

function pricingPage() {
  return siteShell("Pricing", "pricing", `
  <div class="page-header">
    <div class="badge">USD</div>
    <h1>Pricing</h1>
    <p class="sub">Free day key via Work.ink · Paid plans include <b>account rewire</b></p>
  </div>
  <div class="price-grid">
    <article class="price-card">
      <h3>Free</h3>
      <div class="amount">$0 <span>/ 24h</span></div>
      <ul>
        <li>Full script access</li>
        <li>1 Roblox username</li>
        <li>Work.ink unlock</li>
        <li>No rewire</li>
      </ul>
      <a class="btn" href="${FREE_KEY_LINK}" target="_blank" rel="noopener">Get free key</a>
    </article>
    <article class="price-card">
      <h3>Week</h3>
      <div class="amount">$3.99 <span>/ 7 days</span></div>
      <ul>
        <li>Full script access</li>
        <li>Account rewire included</li>
        <li>Priority Discord support</li>
      </ul>
      <a class="btn" href="${DISCORD_INVITE}" target="_blank" rel="noopener">Buy on Discord</a>
    </article>
    <article class="price-card featured">
      <span class="tag">Popular</span>
      <h3>Month</h3>
      <div class="amount">$6.99 <span>/ 30 days</span></div>
      <ul>
        <li>Full script access</li>
        <li>Account rewire included</li>
        <li>Best balance price / time</li>
      </ul>
      <a class="btn btn-gold" href="${DISCORD_INVITE}" target="_blank" rel="noopener">Buy on Discord</a>
    </article>
    <article class="price-card">
      <h3>Year</h3>
      <div class="amount">$12.99 <span>/ 365 days</span></div>
      <ul>
        <li>Full script access</li>
        <li>Account rewire included</li>
        <li>Best long-term value</li>
      </ul>
      <a class="btn" href="${DISCORD_INVITE}" target="_blank" rel="noopener">Buy on Discord</a>
    </article>
  </div>
  <p class="muted">See <a href="/tos">Terms of Service</a> for rewire, refunds, and key rules.</p>

  <div class="card" style="margin-top:18px">
    <h3>Redeem Game Pass → key</h3>
    <p class="muted">1) Buy the pass · 2) Inventory = Everyone · 3) Redeem</p>
    <label class="field">Roblox username</label>
    <input id="rp_user" maxlength="20" placeholder="Username (not display name)" autocomplete="off"/>
    <label class="field">Plan</label>
    <select id="rp_plan">
      <option value="week">Week (310 R$)</option>
      <option value="month">Month (550 R$)</option>
      <option value="year">Year (1100 R$)</option>
    </select>
    <label class="field" style="display:flex;gap:8px;align-items:center;margin-top:12px">
      <input type="checkbox" id="rp_inv" style="width:auto"/>
      My inventory is set to Everyone
    </label>
    <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px">
      <a class="btn" id="rp_buy" href="https://www.roblox.com/game-pass/1963350769" target="_blank" rel="noopener">Open pass store</a>
      <button type="button" class="btn btn-gold" id="rp_go">Redeem</button>
    </div>
    <p id="rp_out" class="muted" style="margin-top:12px;white-space:pre-wrap"></p>
  </div>
  <script>
  (function(){
    const stores = {
      week: "https://www.roblox.com/game-pass/1963350769",
      month: "https://www.roblox.com/game-pass/1965054742",
      year: "https://www.roblox.com/game-pass/1966320456"
    };
    const planEl = document.getElementById("rp_plan");
    const buy = document.getElementById("rp_buy");
    if (planEl && buy) planEl.onchange = function(){ buy.href = stores[planEl.value] || stores.week; };
    const go = document.getElementById("rp_go");
    if (go) go.onclick = async function(){
      const out = document.getElementById("rp_out");
      const username = (document.getElementById("rp_user").value || "").trim();
      const plan = planEl.value;
      const inventory_public = document.getElementById("rp_inv").checked;
      out.className = "muted";
      out.textContent = "Checking...";
      try {
        const res = await fetch("/redeem/gamepass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, plan, inventory_public })
        });
        const data = await res.json();
        if (data.success && data.key) {
          out.className = "ok";
          out.textContent = (data.already_redeemed ? "Already redeemed\\n" : "OK\\n")
            + "Key: " + data.key + "\\nPlan: " + (data.plan || plan);
        } else {
          out.className = "err";
          out.textContent = (data.message || data.reason || res.status) + (data.store ? "\\n" + data.store : "");
        }
      } catch (e) {
        out.className = "err";
        out.textContent = String(e);
      }
    };
  })();
  </script>
`, true);
}

function tosPage() {
  return siteShell("ToS", "tos", `
  <div class="badge">Legal</div>
  <h1>Terms of Service</h1>
  <p class="sub">August 2026</p>
  <div class="card muted">
    <p>Free = 24h, one username, no rewire. Paid (Week $3.99 / Month $6.99 / Year $12.99) includes fair-use rewire.</p>
    <p style="margin-top:8px">No resale of keys. Sales final after key delivery. Not affiliated with Roblox. Use at your own risk.</p>
    <p style="margin-top:8px"><a href="${DISCORD_INVITE}">Discord</a></p>
  </div>
`);
}

/* ===================== ROUTER ===================== */
export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      
      const url = new URL(request.url);
      // нормализация: "/" и "" и иногда без слэша
      let path = url.pathname;
      if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
      if (path === "") path = "/";

      // РЕДИРЕКТ — сразу, до любого html на "/"
      if (request.method === "GET" && path === "/") {
        return Response.redirect(new URL("/home", request.url).toString(), 302);
      }

      // страницы
      if (request.method === "GET" && path === "/home") {
        return html(homePage());
      }
      if (request.method === "GET" && path === "/status") return html(statusPage());
      if (request.method === "GET" && path === "/executors") return html(executorsPage());
      if (request.method === "GET" && path === "/guide") return html(guidePage());
      if (request.method === "GET" && path === "/pricing") return html(pricingPage());
      if (request.method === "GET" && path === "/tos") return html(tosPage());

      // Lua proxies
      if (path === "/loader.lua") return proxyGithub("greedyloader.lua");
      if (path === "/script.lua") return proxyGithub("greedy.lua");
      if (path === "/library.lua") return proxyGithub("greedylibrary.lua");
      if (path === "/modules.lua") return proxyGithub("greedymodules.lua");
      
      // Obfuscator
      if (
        request.method === "GET" &&
        (path === "/obfuscate" || path === "/obfuscate/" || path === "/obfuscator" || path === "/obfuscator/")
      ) {
        return html(obfuscatePage(env.SITE_NAME || "Greedy Hudzell"));
      }
      if (request.method === "POST" && path === "/api/syntax-check") {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, issues: ["invalid JSON"] }, 400);
        }
        const sc = syntaxCheck(body.code || "");
        if (!Array.isArray(sc.issues)) sc.issues = [];
        return json(sc);
      }
      if (request.method === "POST" && path === "/api/obfuscate") {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "invalid JSON" }, 400);
        }
        const code = typeof body.code === "string" ? body.code : "";
        const preset = body.preset || "basic";
        if (!code || code.length < 2) return json({ ok: false, error: "empty code" }, 400);
        if (code.length > 1_500_000) return json({ ok: false, error: "code too large" }, 413);
        const apiKey = env.LUAOBF_API_KEY || LUAOBF_FALLBACK;
        if (preset === "embed") return json({ ok: true, code: plainLongStringEmbed(code), mode: "embed" });
        if (preset === "embed_bit32") return json({ ok: true, code: bit32Embed(code), mode: "embed_bit32" });
        if (preset === "basic") {
          try {
            return json({ ok: true, code: localObfuscate(code, 1), mode: "basic", note: "local L1" });
          } catch (e) {
            return json({ ok: false, error: String(e && e.message ? e.message : e) }, 500);
          }
        }
        const cfg =
          preset === "custom" ? buildConfigFromOptions(body.options || {}) : presetConfig(preset === "vm" ? "full" : preset);
        if (preset === "full" || preset === "vm") cfg.Virtualize = true;
        try {
          const result = await withTimeout(callLuaObf(apiKey, code, cfg), 20000);
          if (result && result.ok && result.code) {
            return json({
              ok: true,
              code: result.code,
              mode: preset,
              sessionId: result.sessionId,
              note: cfg.Virtualize ? "API + Virtualize" : "API",
            });
          }
          const err = (result && result.error) || "api failed";
          const level = preset === "full" || preset === "vm" ? 3 : 2;
          return json({
            ok: true,
            code: localObfuscate(code, level),
            mode: preset + "_local_L" + level,
            note: "API fail (" + err + ") → local L" + level,
          });
        } catch (e) {
          const level = preset === "full" || preset === "vm" ? 3 : 2;
          return json({
            ok: true,
            code: localObfuscate(code, level),
            mode: preset + "_local_L" + level,
            note: "API error → local L" + level + ": " + String(e && e.message ? e.message : e),
          });
        }
      }

      // KEY SYSTEM
      if (request.method === "GET" && path.startsWith("/get-key/token/")) {
        const token = decodeURIComponent(path.slice("/get-key/token/".length));
        return await handleGetKeyToken(request, env, token);
      }
      if (request.method === "GET" && path === "/step2") return await handleStep2(request, env);
      if (request.method === "GET" && path === "/finish") {
        return await handleFinish(request, env, url.searchParams.get("token"));
      }
      if (request.method === "POST" && path === "/generate-key") return await handleGenerateKey(request, env);
      if (request.method === "POST" && path === "/validate") return await handleValidate(request, env);
      if (request.method === "POST" && path === "/redeem/gamepass") return await handleRedeemGamepass(request, env);
      
      // ADMIN
      const adminMatch = path.match(/^\/keys\/([^/]+)\/encrypted\/get-keys-all$/);
      if (request.method === "GET" && adminMatch) return await handleAdminKeys(request, env, adminMatch[1]);
      if (request.method === "POST" && path === "/admin/generate") return await handleAdminGenerate(request, env);
      if (request.method === "POST" && path === "/admin/renew") return await handleAdminRenew(request, env);
      if (request.method === "POST" && path === "/admin/revoke") return await handleAdminRevoke(request, env);
      if (request.method === "POST" && path === "/admin/rewire") return await handleAdminRewire(request, env);
      if (request.method === "GET" && path === "/admin/stats") return await handleAdminStats(request, env);
      const adminKeyMatch = path.match(/^\/admin\/key\/(.+)$/);
      if (request.method === "GET" && adminKeyMatch) {
        return await handleAdminKey(request, env, decodeURIComponent(adminKeyMatch[1]));
      }
      
      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error("Worker error:", error);
      return json({ error: "Internal server error" }, 500);
    }
  },
};
