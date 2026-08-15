const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const SESSION_TTL = 30 * 60;
const KEY_TTL = 24 * 60 * 60;

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...jsonHeaders,
      ...corsHeaders,
      ...extraHeaders
    }
  });
}

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
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

  return [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomString(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return [...bytes]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateKey() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let value = "";

  for (const byte of bytes) {
    value += alphabet[byte % alphabet.length];
  }

  return `GH-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name) {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";

  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

/* =========================================================
   WORK.INK
   ========================================================= */

async function validateWorkInkToken(token) {
  if (!token || token.length > 500) {
    return {
      valid: false,
      reason: "missing_token"
    };
  }

  try {
    const safeToken = encodeURIComponent(token);

    const response = await fetch(
      `https://work.ink/_api/v2/token/isValid/${safeToken}`
    );

    if (!response.ok) {
      return {
        valid: false,
        reason: "workink_http_error"
      };
    }

    const data = await response.json();

    return {
      valid: data.valid === true,
      byIp: data.info?.byIp ?? data.byIp ?? null,
      info: data.info ?? null
    };

  } catch (error) {
    console.error("Work.ink validation error:", error);

    return {
      valid: false,
      reason: "workink_request_failed"
    };
  }
}

/* =========================================================
   DATABASE / SESSION
   ========================================================= */

async function createSession(env, ipHash) {
  const timestamp = now();

  const sessionId = `GH-${randomString(32)}`;

  await env.DB.prepare(`
    INSERT INTO sessions
      (session_id, ip_hash, step1, step2, created_at, expires_at)
    VALUES
      (?, ?, 1, 0, ?, ?)
  `)
    .bind(
      sessionId,
      ipHash,
      timestamp,
      timestamp + SESSION_TTL
    )
    .run();

  return sessionId;
}

async function getSession(env, sessionId) {
  if (!sessionId) {
    return null;
  }

  const result = await env.DB.prepare(`
    SELECT *
    FROM sessions
    WHERE session_id = ?
    LIMIT 1
  `)
    .bind(sessionId)
    .first();

  return result || null;
}

async function validSession(env, sessionId, ipHash) {
  const session = await getSession(env, sessionId);

  if (!session) {
    return {
      valid: false,
      reason: "session_not_found"
    };
  }

  if (session.expires_at <= now()) {
    return {
      valid: false,
      reason: "session_expired"
    };
  }

  /*
   * This is now our own IP protection.
   *
   * We don't compare against Work.ink's byIp because
   * IPv4/IPv6 representation can differ between services.
   */
  if (session.ip_hash !== ipHash) {
    return {
      valid: false,
      reason: "ip_mismatch"
    };
  }

  return {
    valid: true,
    session
  };
}

/* =========================================================
   HTML
   ========================================================= */

function pageShell(title, content) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>${title}</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;

  display: flex;
  align-items: center;
  justify-content: center;

  background: #080808;
  color: #fff;

  font-family: Arial, sans-serif;
}

.card {
  width: min(460px, calc(100% - 32px));

  background: #111;

  border: 1px solid #292929;
  border-radius: 18px;

  padding: 30px;

  box-shadow:
    0 20px 60px rgba(0,0,0,.5);
}

.logo {
  font-size: 25px;
  font-weight: 800;

  letter-spacing: 1px;

  margin-bottom: 24px;
}

.step {
  padding: 12px 14px;

  border-radius: 10px;

  background: #181818;

  margin: 8px 0;
}

.ok {
  color: #6dff9a;
}

button {
  width: 100%;

  padding: 13px;

  margin-top: 18px;

  border: 0;
  border-radius: 10px;

  background: #fff;
  color: #000;

  font-weight: 700;

  cursor: pointer;
}

input {
  width: 100%;

  padding: 13px;

  border-radius: 10px;

  border: 1px solid #333;

  background: #080808;
  color: #fff;

  outline: none;
}

label {
  display: block;

  margin: 20px 0 7px;

  font-size: 14px;
  color: #aaa;
}

.muted {
  color: #888;

  font-size: 13px;

  line-height: 1.5;
}

.error {
  color: #ff6d6d;
}

</style>
</head>

<body>

<div class="card">
${content}
</div>

</body>
</html>`;
}

/* =========================================================
   STEP 1
   ========================================================= */

async function handleGetKeyToken(request, env, token) {

  const work = await validateWorkInkToken(token);

  /*
   * IMPORTANT:
   *
   * We only require Work.ink to confirm the token.
   *
   * We intentionally do NOT compare work.byIp
   * with CF-Connecting-IP.
   */

  if (!work.valid) {

    return html(
      pageShell(
        "Failed",
        `
        <div class="logo">${env.SITE_NAME}</div>

        <h2>FAILED</h2>

        <p>
          Invalid or expired Work.ink token.
        </p>
        `
      ),
      403
    );
  }

  const currentIP = getClientIP(request);

  if (!currentIP) {

    return html(
      pageShell(
        "Failed",
        `
        <div class="logo">${env.SITE_NAME}</div>

        <h2>FAILED</h2>

        <p>
          Unable to identify your IP address.
        </p>
        `
      ),
      403
    );
  }

  const ipHash = await sha256(currentIP);

  const sessionId =
    await createSession(
      env,
      ipHash
    );

  return html(
    pageShell(
      "Step 1 Complete",
      `
      <div class="logo">
        ${env.SITE_NAME}
      </div>

      <div class="step ok">
        ✓ STEP 1 COMPLETE
      </div>

      <p class="muted">
        Work.ink token verified successfully.
      </p>

      <p class="muted">
        Continue to the second required step.
      </p>

      <a href="/step2">
        <button>
          CONTINUE TO STEP 2
        </button>
      </a>
      `
    ),
    200,
    {
      "Set-Cookie": cookie(
        "GH_SESSION",
        sessionId,
        SESSION_TTL
      )
    }
  );
}

/* =========================================================
   STEP 2
   ========================================================= */

async function handleStep2(request, env) {

  const sessionId =
    getCookie(
      request,
      "GH_SESSION"
    );

  const currentIP =
    getClientIP(request);

  const ipHash =
    await sha256(currentIP);

  const result =
    await validSession(
      env,
      sessionId,
      ipHash
    );

  if (
    !result.valid ||
    result.session.step1 !== 1
  ) {

    return html(
      pageShell(
        "Failed",
        `
        <div class="logo">
          ${env.SITE_NAME}
        </div>

        <h2>FAILED</h2>

        <p>
          Please complete Step 1 first.
        </p>
        `
      ),
      403
    );
  }

  /*
   * IMPORTANT:
   *
   * This must be your SECOND Work.ink link.
   *
   * Its destination must be:
   *
   * https://greedyhudzell.xyz/finish?token={TOKEN}
   */

  const secondWorkInkLink =
    "https://work.ink/28wp/greedy-hudzell-12";

  return html(
    pageShell(
      "Step 2",
      `
      <div class="logo">
        ${env.SITE_NAME}
      </div>

      <div class="step ok">
        ✓ STEP 1 COMPLETE
      </div>

      <p class="muted">
        Complete Work.ink Step 2.
      </p>

      <a href="${secondWorkInkLink}">
        <button>
          CONTINUE TO STEP 2
        </button>
      </a>
      `
    )
  );
}

/* =========================================================
   FINISH
   ========================================================= */

async function handleFinish(request, env, token) {

  const sessionId =
    getCookie(
      request,
      "GH_SESSION"
    );

  const currentIP =
    getClientIP(request);

  const ipHash =
    await sha256(currentIP);

  const sessionResult =
    await validSession(
      env,
      sessionId,
      ipHash
    );

  if (!sessionResult.valid) {

    return html(
      pageShell(
        "Failed",
        `
        <div class="logo">
          ${env.SITE_NAME}
        </div>

        <h2>FAILED</h2>

        <p>
          Your session is invalid or expired.
        </p>
        `
      ),
      403
    );
  }

  /*
   * Validate SECOND Work.ink token.
   */

  const work =
    await validateWorkInkToken(token);

  if (!work.valid) {

    return html(
      pageShell(
        "Failed",
        `
        <div class="logo">
          ${env.SITE_NAME}
        </div>

        <h2>FAILED</h2>

        <p>
          Invalid Work.ink Step 2 token.
        </p>
        `
      ),
      403
    );
  }

  /*
   * Again:
   *
   * We trust Work.ink's token validation,
   * but do not use its byIp field.
   *
   * Our own session already binds this browser
   * to the IP from Step 1.
   */

  await env.DB.prepare(`
    UPDATE sessions
    SET step2 = 1
    WHERE session_id = ?
  `)
    .bind(sessionId)
    .run();

  return html(
    pageShell(
      "Key Generator",
      `
      <div class="logo">
        ${env.SITE_NAME}
      </div>

      <div class="step ok">
        ✓ STEP 1 COMPLETE
      </div>

      <div class="step ok">
        ✓ STEP 2 COMPLETE
      </div>

      <label>
        Roblox username
      </label>

      <input
        id="username"
        maxlength="20"
        placeholder="Not displayname!"
        autocomplete="off"
      >

      <button onclick="generateKey()">
        GENERATE KEY
      </button>

      <p id="result" class="muted"></p>

      <script>

      async function generateKey() {

        const username =
          document
            .getElementById("username")
            .value
            .trim();

        const result =
          document
            .getElementById("result");

        if (!username) {

          result.textContent =
            "Enter your Roblox username.";

          return;
        }

        result.textContent =
          "Generating...";

        try {

          const response =
            await fetch(
              "/generate-key",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    username
                  })
              }
            );

          const data =
            await response.json();

          if (!data.success) {

            result.textContent =
              data.reason ||
              "Failed to generate key.";

            return;
          }

          result.innerHTML =
            "Your key:<br><br>" +
            "<strong>" +
            data.key +
            "</strong>";

        } catch {

          result.textContent =
            "Network error.";
        }
      }

      </script>
      `
    )
  );
}

/* =========================================================
   GENERATE KEY
   ========================================================= */

async function handleGenerateKey(request, env) {

  const sessionId =
    getCookie(
      request,
      "GH_SESSION"
    );

  const currentIP =
    getClientIP(request);

  if (!currentIP) {

    return json(
      {
        success: false,
        reason: "ip_unavailable"
      },
      403
    );
  }

  const ipHash =
    await sha256(currentIP);

  const sessionResult =
    await validSession(
      env,
      sessionId,
      ipHash
    );

  if (!sessionResult.valid) {

    return json(
      {
        success: false,
        reason:
          sessionResult.reason
      },
      403
    );
  }

  if (
    sessionResult.session.step1 !== 1 ||
    sessionResult.session.step2 !== 1
  ) {

    return json(
      {
        success: false,
        reason: "steps_not_completed"
      },
      403
    );
  }

  let body;

  try {

    body =
      await request.json();

  } catch {

    return json(
      {
        success: false,
        reason: "invalid_json"
      },
      400
    );
  }

  const username =
    typeof body.username === "string"
      ? body.username.trim()
      : "";

  if (
    username.length < 3 ||
    username.length > 20 ||
    !/^[A-Za-z0-9_]+$/.test(username)
  ) {

    return json(
      {
        success: false,
        reason: "invalid_username"
      },
      400
    );
  }

  /*
   * Prevent multiple keys from being generated
   * from the same session.
   */

  const existing =
    await env.DB.prepare(`
      SELECT key
      FROM keys
      WHERE session_id = ?
      LIMIT 1
    `)
      .bind(sessionId)
      .first();

  if (existing) {

    return json({
      success: true,
      key: existing.key,
      already_generated: true
    });
  }

  const key =
    generateKey();

  const timestamp =
    now();

  await env.DB.prepare(`
    INSERT INTO keys
      (
        key,
        username,
        session_id,
        created_at,
        expires_at,
        revoked,
        executed,
        last_execution
      )
    VALUES
      (?, ?, ?, ?, ?, 0, 0, NULL)
  `)
    .bind(
      key,
      username,
      sessionId,
      timestamp,
      timestamp + KEY_TTL
    )
    .run();

  return json({
    success: true,
    key,
    expires_at:
      timestamp + KEY_TTL
  });
}

/* =========================================================
   LUA VALIDATION
   ========================================================= */

async function handleValidate(request, env) {

  if (request.method !== "POST") {

    return json(
      {
        valid: false,
        reason: "method_not_allowed"
      },
      405
    );
  }

  let body;

  try {

    body =
      await request.json();

  } catch {

    return json(
      {
        valid: false,
        reason: "invalid_json"
      },
      400
    );
  }

  const key =
    typeof body.key === "string"
      ? body.key.trim()
      : "";

  const username =
    typeof body.username === "string"
      ? body.username.trim()
      : "";

  if (!key || !username) {

    return json({
      valid: false,
      reason:
        "missing_key_or_username"
    });
  }

  const record =
    await env.DB.prepare(`
      SELECT *
      FROM keys
      WHERE key = ?
      LIMIT 1
    `)
      .bind(key)
      .first();

  if (!record) {

    return json({
      valid: false,
      reason: "invalid_key"
    });
  }

  if (record.revoked === 1) {

    return json({
      valid: false,
      reason: "revoked"
    });
  }

  if (record.expires_at <= now()) {

    return json({
      valid: false,
      reason: "expired"
    });
  }

  if (record.username !== username) {

    return json({
      valid: false,
      reason: "username_mismatch"
    });
  }

  const timestamp =
    now();

  await env.DB.prepare(`
    UPDATE keys
    SET executed = 1,
        last_execution = ?
    WHERE key = ?
  `)
    .bind(
      timestamp,
      key
    )
    .run();

  return json({
    valid: true
  });
}

/* =========================================================
   ADMIN AUTH
   ========================================================= */

function adminAuthorized(request, env) {

  const auth =
    request.headers.get(
      "Authorization"
    );

  if (!auth) {
    return false;
  }

  if (!auth.startsWith("Bearer ")) {
    return false;
  }

  const provided =
    auth.slice(7);

  return (
    provided ===
    env.ADMIN_SECRET
  );
}

/* =========================================================
   ROTATION TOKEN
   ========================================================= */

async function createRotationToken(env) {

  const interval =
    Math.floor(
      Date.now() / 1000 / 600
    );

  const key =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(
        env.ROTATION_SECRET
      ),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(
        String(interval)
      )
    );

  return [...new Uint8Array(signature)]
    .map(b =>
      b.toString(16).padStart(2, "0")
    )
    .join("");
}

/* =========================================================
   ADMIN LIST
   ========================================================= */

async function handleAdminKeys(
  request,
  env,
  rotation
) {

  if (!adminAuthorized(request, env)) {

    return json(
      {
        error: "Unauthorized"
      },
      401
    );
  }

  const expectedRotation =
    await createRotationToken(env);

  if (
    rotation !== expectedRotation
  ) {

    return json(
      {
        error: "Invalid rotation"
      },
      403
    );
  }

  const url =
    new URL(request.url);

  const search =
    url.searchParams
      .get("search")
      ?.trim() || "";

  let result;

  if (search) {

    result =
      await env.DB.prepare(`
        SELECT *
        FROM keys
        WHERE key LIKE ?
           OR username LIKE ?
        ORDER BY created_at DESC
      `)
        .bind(
          `%${search}%`,
          `%${search}%`
        )
        .all();

  } else {

    result =
      await env.DB.prepare(`
        SELECT *
        FROM keys
        ORDER BY created_at DESC
      `)
        .all();
  }

  return json({
    keys:
      result.results.map(key => ({
        key: key.key,
        username: key.username,

        executed:
          key.executed === 1,

        last_execution:
          key.last_execution,

        created_at:
          key.created_at,

        expires_at:
          key.expires_at,

        revoked:
          key.revoked === 1,

        status:
          key.revoked === 1
            ? "REVOKED"
            : key.expires_at <= now()
              ? "EXPIRED"
              : "ACTIVE"
      }))
  });
}

/* =========================================================
   ADMIN REVOKE
   ========================================================= */

async function handleAdminRevoke(
  request,
  env
) {

  if (!adminAuthorized(request, env)) {

    return json(
      {
        success: false,
        reason: "unauthorized"
      },
      401
    );
  }

  let body;

  try {

    body =
      await request.json();

  } catch {

    return json(
      {
        success: false,
        reason: "invalid_json"
      },
      400
    );
  }

  const key =
    typeof body.key === "string"
      ? body.key.trim()
      : "";

  if (!key) {

    return json(
      {
        success: false,
        reason: "missing_key"
      },
      400
    );
  }

  const result =
    await env.DB.prepare(`
      UPDATE keys
      SET revoked = 1
      WHERE key = ?
    `)
      .bind(key)
      .run();

  if (!result.meta.changes) {

    return json(
      {
        success: false,
        reason: "key_not_found"
      },
      404
    );
  }

  return json({
    success: true
  });
}

/* =========================================================
   ADMIN KEY INFO
   ========================================================= */

async function handleAdminKey(
  request,
  env,
  key
) {

  if (!adminAuthorized(request, env)) {

    return json(
      {
        error: "Unauthorized"
      },
      401
    );
  }

  const record =
    await env.DB.prepare(`
      SELECT *
      FROM keys
      WHERE key = ?
      LIMIT 1
    `)
      .bind(key)
      .first();

  if (!record) {

    return json(
      {
        error: "Key not found"
      },
      404
    );
  }

  return json({
    key: record.key,

    username:
      record.username,

    session_id:
      record.session_id,

    created_at:
      record.created_at,

    expires_at:
      record.expires_at,

    revoked:
      record.revoked === 1,

    executed:
      record.executed === 1,

    last_execution:
      record.last_execution,

    status:
      record.revoked === 1
        ? "REVOKED"
        : record.expires_at <= now()
          ? "EXPIRED"
          : "ACTIVE"
  });
}

/* =========================================================
   ROUTER
   ========================================================= */

export default {

  async fetch(request, env) {

    try {

      const url =
        new URL(request.url);

      /* -----------------------------------------
         HOME
      ----------------------------------------- */

      if (
        request.method === "GET" &&
        url.pathname === "/"
      ) {

        return html(
          pageShell(
            env.SITE_NAME,
            `
            <div class="logo">
              ${env.SITE_NAME}
            </div>

            <p class="muted">
              Key system online.
            </p>
            `
          )
        );
      }

      /* -----------------------------------------
         STEP 1
      ----------------------------------------- */

      if (
        request.method === "GET" &&
        url.pathname.startsWith(
          "/get-key/token/"
        )
      ) {

        const token =
          decodeURIComponent(
            url.pathname.slice(
              "/get-key/token/".length
            )
          );

        return await handleGetKeyToken(
          request,
          env,
          token
        );
      }

      /* -----------------------------------------
         STEP 2
      ----------------------------------------- */

      if (
        request.method === "GET" &&
        url.pathname === "/step2"
      ) {

        return await handleStep2(
          request,
          env
        );
      }

      /* -----------------------------------------
         FINISH
      ----------------------------------------- */

      if (
        request.method === "GET" &&
        url.pathname === "/finish"
      ) {

        const token =
          url.searchParams.get(
            "token"
          );

        return await handleFinish(
          request,
          env,
          token
        );
      }

      /* -----------------------------------------
         GENERATE KEY
      ----------------------------------------- */

      if (
        request.method === "POST" &&
        url.pathname === "/generate-key"
      ) {

        return await handleGenerateKey(
          request,
          env
        );
      }

      /* -----------------------------------------
         LUA VALIDATE
      ----------------------------------------- */

      if (
        request.method === "POST" &&
        url.pathname === "/validate"
      ) {

        return await handleValidate(
          request,
          env
        );
      }

      /* -----------------------------------------
         ADMIN LIST
      ----------------------------------------- */

      const adminMatch =
        url.pathname.match(
          /^\/keys\/([^/]+)\/encrypted\/get-keys-all$/
        );

      if (
        request.method === "GET" &&
        adminMatch
      ) {

        return await handleAdminKeys(
          request,
          env,
          adminMatch[1]
        );
      }

      /* -----------------------------------------
         ADMIN REVOKE
      ----------------------------------------- */

      if (
        request.method === "POST" &&
        url.pathname === "/admin/revoke"
      ) {

        return await handleAdminRevoke(
          request,
          env
        );
      }

      /* -----------------------------------------
         ADMIN KEY
      ----------------------------------------- */

      const adminKeyMatch =
        url.pathname.match(
          /^\/admin\/key\/(.+)$/
        );

      if (
        request.method === "GET" &&
        adminKeyMatch
      ) {

        return await handleAdminKey(
          request,
          env,
          decodeURIComponent(
            adminKeyMatch[1]
          )
        );
      }

      /* -----------------------------------------
         NOT FOUND
      ----------------------------------------- */

      return json(
        {
          error: "Not found"
        },
        404
      );

    } catch (error) {

      console.error(
        "Worker error:",
        error
      );

      return json(
        {
          error:
            "Internal server error"
        },
        500
      );
    }
  }
};
