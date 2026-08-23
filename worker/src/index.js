/**
 * greedyhudzell.xyz — unified Worker
 * - Key system (Work.ink + D1) — unchanged logic
 * - Lua proxies: /loader.lua /script.lua /library.lua /modules.lua
 * - Obfuscator: GET /obfuscate , POST /api/obfuscate , POST /api/syntax-check
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

const GH = "https://raw.githubusercontent.com/mixask/GH/main";
const LUAOBF_NEW = "https://api.luaobfuscator.com/v1/obfuscator/newscript";
const LUAOBF_RUN = "https://api.luaobfuscator.com/v1/obfuscator/obfuscate";
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

/* ===================== HTML SHELL (shared theme) ===================== */
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
    `INSERT INTO keys (key, username, session_id, created_at, expires_at, revoked, executed, last_execution)
     VALUES (?, ?, ?, ?, ?, 0, 0, NULL)`
  )
    .bind(key, username, sessionId, timestamp, timestamp + KEY_TTL)
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
  if (record.username !== username) return json({ valid: false, reason: "username_mismatch" });

  const timestamp = now();
  await env.DB.prepare(`UPDATE keys SET executed = 1, last_execution = ? WHERE key = ?`).bind(timestamp, key).run();

  // Additive for Lua loader: real unix expiry (KEY_TTL from D1)
  return json({
    valid: true,
    expires_at: record.expires_at,
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
    session_id: record.session_id,
    created_at: record.created_at,
    expires_at: record.expires_at,
    revoked: record.revoked === 1,
    executed: record.executed === 1,
    last_execution: record.last_execution,
    status: record.revoked === 1 ? "REVOKED" : record.expires_at <= now() ? "EXPIRED" : "ACTIVE",
  });
}

/* ===================== LUA PROXY ===================== */
async function proxyGithub(file) {
  const response = await fetch(`${GH}/${file}`, { cf: { cacheTtl: 0, cacheEverything: false } });
  if (!response.ok) return plain(`${file} not found`, 404);
  return plain(await response.text(), 200);
}

/* ===================== OBFUSCATOR ===================== */
const PLUGIN_DEFS = [
  { key: "EncryptStrings", label: "Encrypt Strings", args: [100] },
  { key: "SwizzleLookups", label: "Table indirection (SwizzleLookups)", args: [100] },
  { key: "EncryptFuncDeclaration", label: "Encrypt Func Declaration", args: [100] },
  { key: "ControlFlowFlattenV1AllBlocks", label: "Control Flow Flatten", args: [75, 75, 33] },
  { key: "RevertAllIfStatements", label: "Revert If Statements", args: [50] },
  { key: "MixedBooleanArithmetic", label: "Mixed Boolean Arithmetic", args: [75] },
  { key: "MutateAllLiterals", label: "Mutate Literals", args: [20] },
  { key: "JunkifyAllIfStatements", label: "Junkify If Statements", args: [50] },
];

function presetConfig(preset) {
  if (preset === "basic" || preset === "light") {
    // table indirection + strings
    return { MinifiyAll: true, CustomPlugins: { SwizzleLookups: [100], EncryptStrings: [100] } };
  }
  if (preset === "full") {
    return {
      MinifiyAll: true,
      ASCIIArt: "feet_1",
      Virtualize: true,
      CustomPlugins: {
        SwizzleLookups: [100],
        EncryptStrings: [100],
        EncryptFuncDeclaration: [100],
        RevertAllIfStatements: [50],
        ControlFlowFlattenV1AllBlocks: [75, 75, 33],
        MixedBooleanArithmetic: [75],
        MutateAllLiterals: [20],
        JunkifyAllIfStatements: [50],
      },
    };
  }
  return {
    MinifiyAll: true,
    CustomPlugins: {
      SwizzleLookups: [100],
      EncryptStrings: [100],
      ControlFlowFlattenV1AllBlocks: [50, 50, 25],
      JunkifyAllIfStatements: [30],
    },
  };
}

function buildConfigFromOptions(opts) {
  opts = opts || {};
  const cfg = {
    MinifiyAll: opts.MinifiyAll !== false,
    Virtualize: !!opts.Virtualize,
  };
  if (opts.Multifile) cfg.Multifile = true;
  const plugins = {};
  for (const p of PLUGIN_DEFS) {
    if (opts[p.key]) plugins[p.key] = p.args;
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


/** Local Basic obfuscation — no external API (works on 429).
 *  string encryption + simple table indirection + bit32 embed option applied by caller
 */

/** Expand [====[ inner ]====] blocks: if inner looks like Lua, obfuscate inner too */

/** Split by long brackets [=[...]=] / [====[... ]====] */
function mapLongBrackets(code, onCodeSegment, onBracketInner) {
  let i = 0;
  let out = "";
  while (i < code.length) {
    if (code[i] === "[") {
      let j = i + 1;
      let n = 0;
      while (code[j] === "=") { n++; j++; }
      if (code[j] === "[") {
        const openEnd = j + 1;
        let k = openEnd;
        let closeAt = -1;
        while (k < code.length) {
          if (code[k] === "]") {
            let m = 0;
            let p = k + 1;
            while (code[p] === "=") { m++; p++; }
            if (m === n && code[p] === "]") {
              closeAt = k;
              break;
            }
          }
          k++;
        }
        if (closeAt >= 0) {
          const before = code.slice(
            out.length === 0 && i === 0 ? 0 : i,
            i
          );
          // flush plain before this bracket from last index — handled by walking
          const inner = code.slice(openEnd, closeAt);
          const closeEnd = closeAt + 1 + n + 1;
          const looksCode = /\b(function|local|end|return|game:|GetService|print\s*\()\b/.test(inner);
          let eqs = n;
          let body = inner;
          if (looksCode && inner.trim().length > 8) {
            body = onBracketInner(inner);
            while (body.indexOf("]" + "=".repeat(eqs) + "]") !== -1 && eqs < 10) eqs++;
          }
          out += "[" + "=".repeat(eqs) + "[" + body + "]" + "=".repeat(eqs) + "]";
          i = closeEnd;
          continue;
        }
      }
    }
    // accumulate plain char — batch for speed
    let startPlain = i;
    while (i < code.length) {
      if (code[i] === "[") {
        let j = i + 1, n = 0;
        while (code[j] === "=") { n++; j++; }
        if (code[j] === "[") break;
      }
      i++;
    }
    const plain = code.slice(startPlain, i);
    if (plain) out += onCodeSegment(plain);
  }
  return out;
}

function encryptStringsAndAlias(src) {
  const strings = [];
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    // comments
    if (c === "-" && src[i + 1] === "-") {
      let j = i + 2;
      if (src[j] === "[") {
        let n = 0;
        j++;
        while (src[j] === "=") { n++; j++; }
        if (src[j] === "[") {
          j++;
          while (j < src.length) {
            if (src[j] === "]") {
              let k = j + 1, m = 0;
              while (src[k] === "=") { m++; k++; }
              if (m === n && src[k] === "]") { j = k + 1; break; }
            }
            j++;
          }
          out += src.slice(i, j);
          i = j;
          continue;
        }
      }
      while (i < src.length && src[i] !== "\n") { out += src[i]; i++; }
      continue;
    }
    // skip nested long brackets here (already handled outside)
    if (c === "[" && (src[i + 1] === "[" || src[i + 1] === "=")) {
      let j = i + 1, n = 0;
      if (src[j] === "=") {
        while (src[j] === "=") { n++; j++; }
      }
      if (src[j] === "[") {
        j++;
        while (j < src.length) {
          if (src[j] === "]") {
            let k = j + 1, m = 0;
            while (src[k] === "=") { m++; k++; }
            if (m === n && src[k] === "]") { j = k + 1; break; }
          }
          j++;
        }
        out += src.slice(i, j);
        i = j;
        continue;
      }
    }
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      let lit = "";
      while (j < src.length) {
        if (src[j] === "\\") {
          lit += src[j] + (src[j + 1] || "");
          j += 2;
          continue;
        }
        if (src[j] === q) { j++; break; }
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

  const aliases = {
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
  };
  let body = out;
  for (const [name, repl] of Object.entries(aliases)) {
    body = body.replace(new RegExp("\\b" + name + "\\b", "g"), repl);
  }

  const strTable = strings.map((s) => {
    const bytes = [];
    for (let k = 0; k < s.length; k++) {
      bytes.push(s.charCodeAt(k) ^ (0x5a + (k % 13)));
    }
    return "{" + bytes.join(",") + "}";
  }).join(",");

  // if no strings and no aliases changed, still return body with empty _S
  return {
    body,
    strTable,
    hasStrings: strings.length > 0,
  };
}

function wrapWithRuntime(body, strTable) {
  return (
    "-- GH basic (local)\n" +
    "local _T={game,workspace,pairs,ipairs,pcall,type,tostring,tonumber,print,warn,select,next}\n" +
    "local _S={}\n" +
    "do local _d={" + strTable + "} " +
    "for _i=1,#_d do local _b=_d[_i] local _o={} " +
    "for _j=1,#_b do _o[_j]=string.char(bit32.bxor(_b[_j],(90+((_j-1)%13)))) end " +
    "_S[_i]=table.concat(_o) end end\n" +
    body
  );
}

/** Local Basic: obfuscate code + Lua inside [====[ ]====]. No loadstring wrap of whole file. */
function localBasicObfuscate(code) {
  // First pass: only transform insides of long brackets that look like Lua
  let step1 = "";
  {
    let i = 0;
    while (i < code.length) {
      if (code[i] === "[") {
        let j = i + 1, n = 0;
        while (code[j] === "=") { n++; j++; }
        if (code[j] === "[") {
          const openEnd = j + 1;
          let k = openEnd, closeAt = -1;
          while (k < code.length) {
            if (code[k] === "]") {
              let m = 0, p = k + 1;
              while (code[p] === "=") { m++; p++; }
              if (m === n && code[p] === "]") { closeAt = k; break; }
            }
            k++;
          }
          if (closeAt >= 0) {
            const inner = code.slice(openEnd, closeAt);
            const closeEnd = closeAt + 1 + n + 1;
            const looksCode = /\b(function|local|end|return|game:|GetService|print\s*\()\b/.test(inner);
            if (looksCode && inner.trim().length > 8) {
              const r = encryptStringsAndAlias(inner);
              const ob = wrapWithRuntime(r.body, r.strTable);
              let eqs = n;
              while (ob.indexOf("]" + "=".repeat(eqs) + "]") !== -1 && eqs < 12) eqs++;
              step1 += "[" + "=".repeat(eqs) + "[" + ob + "]" + "=".repeat(eqs) + "]";
            } else {
              step1 += code.slice(i, closeEnd);
            }
            i = closeEnd;
            continue;
          }
        }
      }
      step1 += code[i];
      i++;
    }
  }

  // Second pass: obfuscate ONLY plain segments (do not touch long-bracket contents)
  let step2 = "";
  let allStrings = [];
  let stringOffset = 0;
  {
    let i = 0;
    let plain = "";
    function flushPlain() {
      if (!plain) return;
      const r = encryptStringsAndAlias(plain);
      // remap _S indices to global offset
      let body = r.body;
      if (r.hasStrings) {
        // rebuild with offset
        const parts = [];
        let sidx = 0;
        // re-extract was already done; simpler: run encrypt again collecting into allStrings
        const r2 = encryptStringsAndAlias(plain);
        // Actually append strings to global and re-number
        const localCount = (r.strTable.match(/\{/g) || []).length;
      }
      // simpler approach: just append encrypted plain with local header only once at end
      step2 += "\0PLAIN:" + plain + "\0";
      plain = "";
    }
    // rewrite second pass more cleanly without the broken flush
  }

  // Cleaner second pass
  step2 = "";
  {
    let i = 0;
    while (i < step1.length) {
      if (step1[i] === "[") {
        let j = i + 1, n = 0;
        while (step1[j] === "=") { n++; j++; }
        if (step1[j] === "[") {
          const openEnd = j + 1;
          let k = openEnd, closeAt = -1;
          while (k < step1.length) {
            if (step1[k] === "]") {
              let m = 0, p = k + 1;
              while (step1[p] === "=") { m++; p++; }
              if (m === n && step1[p] === "]") { closeAt = k; break; }
            }
            k++;
          }
          if (closeAt >= 0) {
            // keep whole bracket as-is (already obfuscated if needed)
            step2 += step1.slice(i, closeAt + 1 + n + 1);
            i = closeAt + 1 + n + 1;
            continue;
          }
        }
      }
      // gather plain run
      let start = i;
      while (i < step1.length) {
        if (step1[i] === "[") {
          let j = i + 1, n = 0;
          while (step1[j] === "=") { n++; j++; }
          if (step1[j] === "[") break;
        }
        i++;
      }
      const plain = step1.slice(start, i);
      if (plain) {
        const r = encryptStringsAndAlias(plain);
        // temporary markers with full wrap deferred
        step2 += "<<<CHUNK_START>>>" + JSON.stringify(r) + "<<<CHUNK_END>>>";
      }
    }
  }

  // Merge chunks into one runtime + concatenated bodies
  const chunkRe = /<<<CHUNK_START>>>([\s\S]*?)<<<CHUNK_END>>>/g;
  let mergedBody = "";
  let mergedTables = [];
  let sOff = 0;
  let result = "";
  let last = 0;
  let m;
  while ((m = chunkRe.exec(step2)) !== null) {
    result += step2.slice(last, m.index);
    const r = JSON.parse(m[1]);
    let body = r.body;
    if (r.hasStrings && r.strTable) {
      // shift _S[n] by sOff
      body = body.replace(/_S\[(\d+)\]/g, (_, n) => "_S[" + (Number(n) + sOff) + "]");
      const tables = r.strTable ? r.strTable.split("},{").length : 0;
      // count entries
      const count = (r.strTable.match(/\{/g) || []).length;
      if (r.strTable) mergedTables.push(r.strTable);
      sOff += count;
    }
    mergedBody += body;
    last = m.index + m[0].length;
  }
  result += step2.slice(last);

  // If we only had bracket content and no plain, still ok
  const strTable = mergedTables.join(",");
  // Place runtime at start of whole file, then result with mergedBody embedded... 
  // result still has brackets; mergedBody is only plain pieces that were replaced by markers.
  // Rebuild: result currently is step2 with markers replaced by nothing yet — we built `result` as outside + we need to inject body at marker positions.

  // Redo merge properly
  result = "";
  last = 0;
  sOff = 0;
  mergedTables = [];
  chunkRe.lastIndex = 0;
  while ((m = chunkRe.exec(step2)) !== null) {
    result += step2.slice(last, m.index);
    const r = JSON.parse(m[1]);
    let body = r.body;
    if (r.hasStrings && r.strTable) {
      body = body.replace(/_S\[(\d+)\]/g, (_, n) => "_S[" + (Number(n) + sOff) + "]");
      const count = (r.strTable.match(/\{/g) || []).length;
      mergedTables.push(r.strTable);
      sOff += count;
    } else if (r.strTable) {
      // no strings but still
    }
    // always apply alias body
    if (!r.hasStrings) {
      // body still has aliases applied
    }
    result += body;
    last = m.index + m[0].length;
  }
  result += step2.slice(last);

  const finalTable = mergedTables.join(",");
  // Always add one runtime header for outer plain aliases/strings
  // Bracket-inners already have their own runtime inside the brackets
  return wrapWithRuntime(result, finalTable);
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
    headers: { "content-type": "text/plain; charset=utf-8", apikey: apiKey },
    body: code,
  });
  if (!newRes.ok) {
    const t = await newRes.text();
    return { ok: false, error: `newscript HTTP ${newRes.status}: ${t.slice(0, 240)}` };
  }
  let session;
  try {
    session = await newRes.json();
  } catch {
    return { ok: false, error: "newscript: invalid JSON" };
  }
  if (!session.sessionId) return { ok: false, error: session.message || "no sessionId" };

  const runRes = await fetch(LUAOBF_RUN, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: apiKey,
      sessionId: session.sessionId,
    },
    body: JSON.stringify(cfg),
  });
  if (!runRes.ok) {
    const t = await runRes.text();
    return { ok: false, error: `obfuscate HTTP ${runRes.status}: ${t.slice(0, 240)}` };
  }
  let out;
  try {
    out = await runRes.json();
  } catch {
    return { ok: false, error: "obfuscate: invalid JSON" };
  }
  if (!out.code) return { ok: false, error: out.message || "empty code from API" };
  return { ok: true, code: out.code, sessionId: session.sessionId };
}

function syntaxCheck(code) {
  const issues = [];
  if (!code || !code.trim()) return { ok: false, issues: ["empty code"] };
  const pairs = { "(": ")", "[": "]", "{": "}" };
  const stack = [];
  let i = 0;
  let line = 1;
  let inStr = null; // '"', "'", "long"
  let longEq = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === "\n") line++;

    // long strings [[ ]] and [=[ ]=]
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

    // comments: -- line OR --[[ long ]] OR --[=[ long ]=]
    if (!inStr && c === "-" && code[i + 1] === "-") {
      // long comment?
      let j = i + 2;
      if (code[j] === "[") {
        let n = 0;
        j++;
        while (code[j] === "=") {
          n++;
          j++;
        }
        if (code[j] === "[") {
          // skip until matching ]=...=]
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
      // line comment
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
<p class="muted">Basic obfuscates code (and Lua inside [====[ ]). Does not wrap in loadstring. Medium/Full = API, fallback local.</p>

<label>Preset</label>
<select id="preset">
  <option value="basic" selected>Basic — table + strings (obfuscate code, incl. inside [====[ ])</option>
  <option value="medium">Medium — API plugins</option>
  <option value="full">Full — virtualize + plugins</option>
  <option value="embed">Wrap only loadstring([====[ ])</option>
  <option value="embed_bit32">Wrap bit32 + loadstring</option>
  <option value="custom">Custom checkboxes</option>
</select>

<div id="customBox" style="display:none;margin-top:10px">
  <label>Root</label>
  <label class="chk"><input type="checkbox" data-root="MinifiyAll" checked/> Minify All</label>
  <label class="chk"><input type="checkbox" data-root="Virtualize"/> Virtualize</label>
  <label class="chk"><input type="checkbox" data-root="Multifile"/> Multifile</label>
  <label>Plugins</label>
  <div class="plugins">
    <label class="chk"><input type="checkbox" data-plugin="EncryptStrings" checked/> Encrypt Strings</label>
    <label class="chk"><input type="checkbox" data-plugin="SwizzleLookups" checked/> Table indirection</label>
    <label class="chk"><input type="checkbox" data-plugin="EncryptFuncDeclaration"/> Encrypt Func Declaration</label>
    <label class="chk"><input type="checkbox" data-plugin="ControlFlowFlattenV1AllBlocks"/> Control Flow Flatten</label>
    <label class="chk"><input type="checkbox" data-plugin="JunkifyAllIfStatements"/> Junkify Ifs</label>
  </div>
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
async function doCheck(){
  statusEl.textContent='Checking...';
  try{
    const res=await fetch('/api/syntax-check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:input.value||''})});
    const data=await res.json();
    statusEl.innerHTML=data.ok?'<span class="ok">Syntax OK</span>':'<span class="error">'+(data.issues||[]).join('<br>')+'</span>';
  }catch(e){statusEl.innerHTML='<span class="error">'+String(e)+'</span>'}
}
document.getElementById('checkIn').onclick=()=>doCheck();
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
      statusEl.innerHTML='<span class="error">'+(data.error||'failed')+(data.hint?('<br>'+data.hint):'')+'</span>';
    } else {
      output.value=data.code||'';
      statusEl.innerHTML='<span class="ok">OK · '+(data.mode||preset.value)+' · '+(data.code||'').length+' chars</span>'+(data.note?('<br><span class="muted">'+data.note+'</span>'):'');
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

/* ===================== ROUTER ===================== */
export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // --- Lua proxies (mixask/GH) ---
      if (path === "/loader.lua") return proxyGithub("greedyloader.lua");
      if (path === "/script.lua") return proxyGithub("greedy.lua");
      if (path === "/library.lua") return proxyGithub("greedylibrary.lua");
      if (path === "/modules.lua") return proxyGithub("greedymodules.lua");

      // --- Obfuscator ---
      if (
        request.method === "GET" &&
        (path === "/obfuscate" ||
          path === "/obfuscate/" ||
          path === "/obfuscator" ||
          path === "/obfuscator/")
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
        const preset = body.preset || "medium";
        if (!code || code.length < 2) return json({ ok: false, error: "empty code" }, 400);
        if (code.length > 1_500_000) return json({ ok: false, error: "code too large" }, 413);

        const apiKey = env.LUAOBF_API_KEY || LUAOBF_FALLBACK;

        if (preset === "embed") {
          return json({ ok: true, code: plainLongStringEmbed(code), mode: "embed" });
        }
        // Basic = local table + strings, obfuscate [====[ code ]====] inners. NO loadstring wrap.
        if (preset === "basic") {
          try {
            const src = localBasicObfuscate(code);
            return json({
              ok: true,
              code: src,
              mode: "basic",
              note: "local table+strings; long-bracket inners obfuscated",
            });
          } catch (e) {
            return json({ ok: false, error: "local basic failed: " + String(e && e.message ? e.message : e) }, 500);
          }
        }
        if (preset === "embed_bit32") {
          // try API light once; on 429 fall back to local
          let src = code;
          let note = "local";
          const light = await callLuaObf(apiKey, code, presetConfig("light"));
          if (light.ok) {
            src = light.code;
            note = "api light";
          } else {
            src = localBasicObfuscate(code);
            note = "api fail -> local: " + (light.error || "");
          }
          return json({ ok: true, code: bit32Embed(src), mode: "embed_bit32", note });
        }

        // Medium / Full / Custom: try API once (8s). Any fail -> local basic. No spam needed.
        const cfg = preset === "custom" ? buildConfigFromOptions(body.options || {}) : presetConfig(preset);
        try {
          const result = await withTimeout(callLuaObf(apiKey, code, cfg), 8000);
          if (result && result.ok && result.code) {
            return json({ ok: true, code: result.code, mode: preset, sessionId: result.sessionId });
          }
          const err = (result && result.error) || "api failed";
          const src = localBasicObfuscate(code);
          return json({
            ok: true,
            code: src,
            mode: "basic_fallback",
            note: "API unavailable (" + err + ") — local basic used",
          });
        } catch (e) {
          const src = localBasicObfuscate(code);
          return json({
            ok: true,
            code: src,
            mode: "basic_fallback",
            note: "API error/timeout — local basic used: " + String(e && e.message ? e.message : e),
          });
        }
      }

      // --- HOME ---
      if (request.method === "GET" && path === "/") {
        return html(
          pageShell(
            env.SITE_NAME || "Greedy Hudzell",
            `<div class="logo">${env.SITE_NAME || "Greedy Hudzell"}</div>
            <p class="muted">Key system online.</p>
            <div class="nav" style="margin-top:18px">
              <a href="/obfuscator">Lua Obfuscator →</a>
              <a href="https://discord.gg/sbVuaT9a2T">Discord</a>
            </div>`
          )
        );
      }

      // --- KEY SYSTEM ---
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

      const adminMatch = path.match(/^\/keys\/([^/]+)\/encrypted\/get-keys-all$/);
      if (request.method === "GET" && adminMatch) return await handleAdminKeys(request, env, adminMatch[1]);
      if (request.method === "POST" && path === "/admin/revoke") return await handleAdminRevoke(request, env);
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
