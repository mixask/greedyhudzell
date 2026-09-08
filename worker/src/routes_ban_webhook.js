/**
 * Merge these handlers into greedyhudzell worker index.js
 * Bindings: DB (D1)
 * Secrets: ADMIN_SECRET, DISCORD_BOT_TOKEN (or DISCORD_TOKEN)
 */

function adminAuth(request, env) {
  const h = request.headers.get("Authorization") || "";
  return h === `Bearer ${env.ADMIN_SECRET}`;
}

async function isBanned(env, key, username) {
  const k = (key || "").trim();
  const u = (username || "").trim().toLowerCase();
  if (k) {
    const row = await env.DB.prepare(
      "SELECT 1 AS x FROM bans WHERE key = ? LIMIT 1"
    )
      .bind(k)
      .first();
    if (row) return true;
  }
  if (u) {
    const row = await env.DB.prepare(
      "SELECT 1 AS x FROM bans WHERE lower(username) = ? LIMIT 1"
    )
      .bind(u)
      .first();
    if (row) return true;
  }
  return false;
}

/** Call inside handleValidate after key is found:
 *  if (await isBanned(env, key, username)) {
 *    return json({ valid: false, reason: "banned" });
 *  }
 */

async function handleAdminBan(request, env) {
  if (!adminAuth(request, env)) {
    return json({ success: false, reason: "unauthorized" }, 401);
  }
  const body = await request.json().catch(() => ({}));
  const key = (body.key || "").trim();
  const username = (body.username || "").trim();
  const reason = body.reason || "";
  const by = String(body.by_discord || "");
  if (!key && !username) {
    return json({ success: false, reason: "need key or username" }, 400);
  }
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "INSERT INTO bans (key, username, reason, by_discord, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(key || null, username || null, reason, by, now)
    .run();
  if (key) {
    try {
      await env.DB.prepare("UPDATE keys SET revoked = 1 WHERE key = ?")
        .bind(key)
        .run();
    } catch (_) {}
  }
  return json({ success: true });
}

async function handleAdminUnban(request, env) {
  if (!adminAuth(request, env)) {
    return json({ success: false, reason: "unauthorized" }, 401);
  }
  const body = await request.json().catch(() => ({}));
  const key = (body.key || "").trim();
  const username = (body.username || "").trim();
  if (!key && !username) {
    return json({ success: false, reason: "need key or username" }, 400);
  }
  if (key) {
    await env.DB.prepare("DELETE FROM bans WHERE key = ?").bind(key).run();
    try {
      await env.DB.prepare("UPDATE keys SET revoked = 0 WHERE key = ?")
        .bind(key)
        .run();
    } catch (_) {}
  }
  if (username) {
    await env.DB.prepare("DELETE FROM bans WHERE lower(username) = lower(?)")
      .bind(username)
      .run();
  }
  return json({ success: true });
}

async function handleAdminKick(request, env) {
  if (!adminAuth(request, env)) {
    return json({ success: false, reason: "unauthorized" }, 401);
  }
  const body = await request.json().catch(() => ({}));
  const userId = String(body.user_id || "");
  const reason = String(body.reason || "Kicked by moderator");
  if (!userId) return json({ success: false, reason: "user_id" }, 400);
  await env.DB.prepare(
    "INSERT OR REPLACE INTO pending_kicks (user_id, reason, created_at) VALUES (?, ?, ?)"
  )
    .bind(userId, reason, Math.floor(Date.now() / 1000))
    .run();
  return json({ success: true });
}

async function handleKickCheck(request, env, url) {
  const userId = url.searchParams.get("userId") || "";
  if (!userId) return json({ kick: false });
  const row = await env.DB.prepare(
    "SELECT reason FROM pending_kicks WHERE user_id = ?"
  )
    .bind(userId)
    .first();
  if (!row) return json({ kick: false });
  await env.DB.prepare("DELETE FROM pending_kicks WHERE user_id = ?")
    .bind(userId)
    .run();
  return json({ kick: true, reason: row.reason });
}

async function handleWebhookRegister(request, env) {
  if (!adminAuth(request, env)) {
    return json({ success: false, reason: "unauthorized" }, 401);
  }
  const body = await request.json().catch(() => ({}));
  const webhookId = String(body.webhook_id || "");
  const whUrl = String(body.url || "");
  if (!webhookId || !whUrl) {
    return json({ success: false, reason: "webhook_id+url" }, 400);
  }
  await env.DB.prepare(
    "INSERT OR REPLACE INTO webhooks_meta (webhook_id, url, roblox_name, discord_id, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(
      webhookId,
      whUrl,
      body.roblox_name || "",
      body.discord_id || "",
      Math.floor(Date.now() / 1000)
    )
    .run();
  return json({ success: true });
}

async function handleCreateWebhook(request, env) {
  const body = await request.json().catch(() => ({}));
  const key = (body.key || "").trim();
  const username = (body.username || "").trim();
  if (!key || !username) {
    return json({ ok: false, error: "key+username" }, 400);
  }
  if (await isBanned(env, key, username)) {
    return json({ ok: false, error: "banned" }, 403);
  }
  // Optional: re-validate key via same logic as /validate
  const token = env.DISCORD_BOT_TOKEN || env.DISCORD_TOKEN;
  if (!token) return json({ ok: false, error: "no bot token" }, 500);
  const channelId = "1546938830333153321";
  const name = username.replace(/[^\w\- ]/g, "").slice(0, 80) || "gh-user";
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/webhooks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ ok: false, error: data }, 502);
  const urlWh = `https://discord.com/api/webhooks/${data.id}/${data.token}`;
  await env.DB.prepare(
    "INSERT OR REPLACE INTO webhooks_meta (webhook_id, url, roblox_name, discord_id, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(
      String(data.id),
      urlWh,
      username,
      body.discord_id || "",
      Math.floor(Date.now() / 1000)
    )
    .run();
  return json({ ok: true, url: urlWh });
}

async function handleSessionJoin(request, env) {
  const body = await request.json().catch(() => ({}));
  const token = env.DISCORD_BOT_TOKEN || env.DISCORD_TOKEN;
  if (!token) return json({ ok: false }, 500);
  const ch = "1438999670075686912";
  const content =
    `**Session**\n` +
    `Roblox: \`${body.roblox_user || "?"}\` (${body.roblox_id || "?"})\n` +
    `Discord: \`${body.discord_name || "-"}\` (${body.discord_id || "-"})\n` +
    `Key: \`${body.key || "-"}\` plan=${body.plan || "-"} place=${body.place_id || "-"}`;
  await fetch(`https://discord.com/api/v10/channels/${ch}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
  return json({ ok: true });
}

/**
 * Router snippet (inside fetch):
 *
 * if (path === "/admin/ban" && method === "POST") return handleAdminBan(request, env);
 * if (path === "/admin/unban" && method === "POST") return handleAdminUnban(request, env);
 * if (path === "/admin/kick" && method === "POST") return handleAdminKick(request, env);
 * if (path === "/admin/webhook-register" && method === "POST") return handleWebhookRegister(request, env);
 * if (path === "/api/session/kick-check" && method === "GET") return handleKickCheck(request, env, url);
 * if (path === "/api/discord/create-webhook" && method === "POST") return handleCreateWebhook(request, env);
 * if (path === "/api/session/join" && method === "POST") return handleSessionJoin(request, env);
 *
 * export { isBanned, handleAdminBan, handleAdminUnban, handleAdminKick,
 *   handleKickCheck, handleWebhookRegister, handleCreateWebhook, handleSessionJoin };
 */

export {
  isBanned,
  handleAdminBan,
  handleAdminUnban,
  handleAdminKick,
  handleKickCheck,
  handleWebhookRegister,
  handleCreateWebhook,
  handleSessionJoin,
  adminAuth,
};
