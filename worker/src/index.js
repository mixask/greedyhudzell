/**
 * Greedy Hudzell – public site (black / white / gold)
 * Merge into greedyhudzell worker OR deploy as site routes.
 *
 * Routes:
 *   /  /status  /executors  /guide  /tos  /obfuscator
 *   /api/status  /api/executors  /api/syntax-check
 *
 * Discord bot (later) can POST to update SITE_STATUS KV key "public"
 * with Authorization: Bearer <ADMIN_SECRET>
 */

const GOLD = "#C9A227";
const GOLD_SOFT = "#E8C547";
const OFFICIAL_DISCORD = "https://discord.gg/sbVuaT9a2T";

const DEFAULT_STATUS = {
  ban_wave: {
    active: true,
    message:
      "Roblox ban wave is active. Use scripts at your own risk. Prefer high sUNC executors and avoid blatant automation on main accounts.",
    color: "#C9A227",
    until: null,
    updated_at: new Date().toISOString(),
  },
  announcement: null, // { message, color, until } — for Discord bot
  executors_override: {}, // { "Name": { note, forceSupport } }
  services: { api: "ok", github: "unknown", keys: "unknown" },
  updated_at: new Date().toISOString(),
};

function css() {
  return `
    :root {
      --bg: #0a0a0a; --bg2: #111; --card: #141414; --border: #2a2a2a;
      --text: #f2f2f2; --muted: #9a9a9a; --gold: ${GOLD}; --gold-soft: ${GOLD_SOFT};
      --danger: #e85d5d; --ok: #4caf7a; --warn: #d4a017;
      --radius: 16px; --radius-sm: 10px; --shadow: 0 12px 40px rgba(0,0,0,.45);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, sans-serif; background: var(--bg); color: var(--text);
      min-height: 100vh; line-height: 1.55;
      background-image:
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(201,162,39,.12), transparent),
        radial-gradient(ellipse 60% 40% at 100% 100%, rgba(255,255,255,.03), transparent);
    }
    a { color: var(--gold-soft); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .wrap { width: min(980px, 94vw); margin: 0 auto; padding: 28px 0 80px; }
    .top {
      position: sticky; top: 0; z-index: 50; backdrop-filter: blur(14px);
      background: rgba(10,10,10,.78); border-bottom: 1px solid var(--border);
    }
    .top-inner {
      width: min(980px, 94vw); margin: 0 auto; display: flex; align-items: center;
      justify-content: space-between; gap: 16px; padding: 14px 0; flex-wrap: wrap;
    }
    .brand {
      display: flex; align-items: center; gap: 12px; font-weight: 700;
      color: var(--text); text-decoration: none;
    }
    .brand:hover { text-decoration: none; }
    .brand-mark {
      width: 34px; height: 34px; border-radius: 10px;
      background: linear-gradient(135deg, #1a1a1a, #2a2410);
      border: 1px solid var(--gold); display: grid; place-items: center;
      color: var(--gold); font-size: 14px; font-weight: 700;
    }
    .nav { display: flex; flex-wrap: wrap; gap: 6px; }
    .nav-link {
      color: var(--muted); padding: 8px 14px; border-radius: 999px;
      border: 1px solid transparent; font-size: 13px; font-weight: 500; transition: .2s;
      text-decoration: none;
    }
    .nav-link:hover {
      color: var(--text); border-color: var(--border); background: var(--card); text-decoration: none;
    }
    .nav-link.active { color: #0a0a0a; background: var(--gold); border-color: var(--gold); }
    .banner {
      margin: 22px 0 0; border-radius: var(--radius); border: 1px solid var(--gold);
      background: linear-gradient(135deg, rgba(201,162,39,.14), rgba(20,20,20,.9));
      padding: 16px 18px; display: flex; gap: 14px; align-items: flex-start;
      animation: fadeUp .5s ease both;
    }
    .banner .dot {
      width: 10px; height: 10px; margin-top: 6px; border-radius: 50%; background: var(--gold);
      box-shadow: 0 0 0 4px rgba(201,162,39,.2); flex-shrink: 0; animation: pulse 1.8s ease infinite;
    }
    .banner strong {
      color: var(--gold-soft); display: block; margin-bottom: 4px; font-size: 13px;
      letter-spacing: .06em; text-transform: uppercase;
    }
    .banner p { color: var(--text); font-size: 14px; }
    .hero { text-align: center; padding: 48px 12px 28px; animation: fadeUp .55s ease both; }
    .hero h1 {
      font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 700; letter-spacing: -.02em; margin-bottom: 10px;
    }
    .hero h1 span { color: var(--gold); }
    .hero p { color: var(--muted); max-width: 520px; margin: 0 auto 22px; font-size: 15px; }
    .hero-line {
      width: 64px; height: 3px; margin: 0 auto 22px; border-radius: 2px;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
    }
    .btn-row { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 11px 18px; border-radius: 999px; font-size: 13px; font-weight: 600;
      border: 1px solid var(--border); background: var(--card); color: var(--text);
      cursor: pointer; transition: .2s; text-decoration: none;
    }
    .btn:hover {
      border-color: var(--gold); color: var(--gold-soft); text-decoration: none; transform: translateY(-1px);
    }
    .btn-gold {
      background: linear-gradient(135deg, var(--gold), #a8841a); color: #0a0a0a; border-color: var(--gold);
    }
    .btn-gold:hover { color: #0a0a0a; filter: brightness(1.06); }
    .grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-top: 10px;
    }
    .card {
      background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 18px; box-shadow: var(--shadow); animation: fadeUp .55s ease both;
    }
    .card h3 {
      font-size: 14px; letter-spacing: .04em; text-transform: uppercase; color: var(--gold-soft); margin-bottom: 8px;
    }
    .card p, .card li { color: var(--muted); font-size: 14px; }
    .card ul { padding-left: 18px; }
    .panel {
      background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 22px; margin-top: 18px; animation: fadeUp .55s ease both;
    }
    .panel h2 { font-size: 1.15rem; margin-bottom: 6px; }
    .panel .sub { color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .pill {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase;
    }
    .pill-ok { background: rgba(76,175,122,.15); color: var(--ok); border: 1px solid rgba(76,175,122,.35); }
    .pill-warn { background: rgba(212,160,23,.15); color: var(--warn); border: 1px solid rgba(212,160,23,.35); }
    .pill-bad { background: rgba(232,93,93,.15); color: var(--danger); border: 1px solid rgba(232,93,93,.35); }
    .pill-muted { background: rgba(154,154,154,.12); color: var(--muted); border: 1px solid var(--border); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border); }
    th {
      color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
    }
    .code {
      font-family: "JetBrains Mono", monospace; font-size: 12px; background: var(--bg2);
      border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px;
      overflow-x: auto; color: var(--gold-soft); white-space: pre-wrap; word-break: break-all;
    }
    textarea.code-input {
      width: 100%; min-height: 220px; font-family: "JetBrains Mono", monospace; font-size: 12px;
      background: #0c0c0c; color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm);
      padding: 14px; resize: vertical;
    }
    textarea.code-input:focus { outline: 1px solid var(--gold); }
    select, .field {
      background: var(--bg2); color: var(--text); border: 1px solid var(--border);
      border-radius: 999px; padding: 10px 14px; font-size: 13px;
    }
    .warn-box {
      border: 1px solid rgba(232,93,93,.4); background: rgba(232,93,93,.08);
      border-radius: var(--radius-sm); padding: 12px 14px; color: #f0c0c0; font-size: 13px; margin: 12px 0;
    }
    .note-box {
      border: 1px solid rgba(201,162,39,.35); background: rgba(201,162,39,.08);
      border-radius: var(--radius-sm); padding: 12px 14px; color: #e8d9a8; font-size: 13px; margin: 12px 0;
    }
    .ok-box {
      border: 1px solid rgba(76,175,122,.35); background: rgba(76,175,122,.08);
      border-radius: var(--radius-sm); padding: 12px 14px; color: #b8e0c8; font-size: 13px; margin: 12px 0;
    }
    .tos p { margin: 0 0 12px; color: var(--muted); font-size: 14px; }
    .tos h3 { margin: 18px 0 8px; font-size: 15px; color: var(--text); }
    .tos ol, .tos ul { margin: 0 0 12px 18px; color: var(--muted); font-size: 14px; }
    .tos li { margin: 6px 0; }
    .rainware {
      margin-top: 36px; border-radius: var(--radius); border: 1px solid var(--border);
      background: linear-gradient(160deg, #121212, #0e0e0e 60%, #15120a); padding: 22px;
      animation: fadeUp .6s ease both;
    }
    .rainware-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      flex-wrap: wrap; margin-bottom: 14px;
    }
    .rainware-head h3 { font-size: 1rem; }
    .rainware-head h3 span { color: var(--gold); }
    .rainware-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;
    }
    .rw-item {
      background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px;
    }
    .rw-item label {
      display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .08em;
      color: var(--muted); margin-bottom: 6px;
    }
    .rw-item a, .rw-item code { font-size: 12px; color: var(--gold-soft); word-break: break-all; }
    .rainware-foot { margin-top: 14px; font-size: 11px; color: #6a6a6a; text-align: center; }
    footer.site { margin-top: 28px; text-align: center; color: #555; font-size: 12px; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 12px 0; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 4px rgba(201,162,39,.15); }
      50% { box-shadow: 0 0 0 8px rgba(201,162,39,.05); }
    }
    @media (max-width: 640px) {
      .hero { padding-top: 28px; }
      th:nth-child(5), td:nth-child(5) { display: none; }
    }
  `;
}

function layout(title, active, body, { rainware = false, extraScript = "" } = {}) {
  const nav = [
    ["/", "Home"],
    ["/status", "Status"],
    ["/executors", "Executors"],
    ["/guide", "Guide"],
    ["/tos", "ToS"],
    ["/obfuscator", "Obfuscator"],
  ]
    .map(
      ([href, label]) =>
        `<a class="nav-link${active === href ? " active" : ""}" href="${href}">${label}</a>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} · Greedy Hudzell</title>
  <meta name="description" content="Greedy Hudzell — official hub site."/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <style>${css()}</style>
</head>
<body>
  <header class="top">
    <div class="top-inner">
      <a class="brand" href="/">
        <div class="brand-mark">GH</div>
        <span>Greedy Hudzell</span>
      </a>
      <nav class="nav">${nav}</nav>
    </div>
  </header>
  <main class="wrap">
    ${body}
    ${rainware ? rainwareBlock() : ""}
    <footer class="site">© Greedy Hudzell · Official Discord: <a href="${OFFICIAL_DISCORD}">discord.gg/sbVuaT9a2T</a> · Not affiliated with Roblox</footer>
  </main>
  ${extraScript}
</body>
</html>`;
}

function rainwareBlock() {
  return `
  <section class="rainware" id="rainware">
    <div class="rainware-head">
      <h3><span>Rainware</span> · separate project</h3>
      <span class="pill pill-warn">Paid · not GH</span>
    </div>
    <div class="rainware-grid">
      <div class="rw-item">
        <label>Discord</label>
        <a href="https://discord.gg/rainware" target="_blank" rel="noopener">discord.gg/rainware</a>
      </div>
      <div class="rw-item">
        <label>Game</label>
        <a href="https://www.roblox.com/games/10595058975/Arcane-Lineage" target="_blank" rel="noopener">Arcane Lineage</a>
      </div>
      <div class="rw-item" style="grid-column:1/-1">
        <label>Loader (paid product)</label>
        <div class="code">loadstring(game:HttpGet("https://raw.githubusercontent.com/ShitScripts/rainware-loader/refs/heads/main/loader-ob.lua"))()</div>
      </div>
    </div>
    <p class="rainware-foot">
      Rainware is a separate paid project. Greedy Hudzell remains its own product with its own keys, Discord, and distribution.
      Official GH Discord: ${OFFICIAL_DISCORD.replace("https://", "")}
    </p>
  </section>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function banBanner(status) {
  const bw = status?.ban_wave;
  const ann = status?.announcement;
  let html = "";
  if (bw?.active) {
    html += `
    <div class="banner" role="status">
      <div class="dot"></div>
      <div>
        <strong>Ban wave notice</strong>
        <p>${escapeHtml(bw.message || "Elevated ban activity.")}</p>
      </div>
    </div>`;
  }
  if (ann?.message) {
    html += `
    <div class="banner" style="border-color:${escapeHtml(ann.color || GOLD)};margin-top:12px">
      <div class="dot"></div>
      <div>
        <strong>Announcement</strong>
        <p>${escapeHtml(ann.message)}</p>
      </div>
    </div>`;
  }
  return html;
}

/** GH support score from WEAO fields (aligned with hub Info-style support). */
function supportFromExploit(ex) {
  const sunc = Number(ex.suncPercentage ?? ex.sUNC ?? 0);
  const unc = Number(ex.uncPercentage ?? 0);
  const score = Math.max(sunc, unc * 0.9);
  const detected = ex.detected === true;
  const updated = ex.updateStatus === true;

  // Map roughly to "X/11" style capability for GH features
  let outOf11 = Math.round((score / 100) * 11);
  if (!updated) outOf11 = Math.min(outOf11, 6);
  if (detected) outOf11 = Math.min(outOf11, 4);
  outOf11 = Math.max(0, Math.min(11, outOf11));

  let level = "Low";
  let cls = "pill-bad";
  let ghOk = false;
  if (!detected && updated && score >= 90) {
    level = "Full";
    cls = "pill-ok";
    ghOk = true;
  } else if (!detected && score >= 70) {
    level = "Good";
    cls = "pill-ok";
    ghOk = true;
  } else if (score >= 40 && !detected) {
    level = "Partial";
    cls = "pill-warn";
    ghOk = false;
  } else {
    level = "Poor";
    cls = "pill-bad";
    ghOk = false;
  }

  return {
    level,
    cls,
    outOf11,
    sunc: score,
    ghOk,
    label: `${level} · ${outOf11}/11`,
  };
}

function pageHome(status) {
  const body = `
    ${banBanner(status)}
    <section class="hero">
      <div class="hero-line"></div>
      <h1>Greedy <span>Hudzell</span></h1>
      <p>Official status, executor support for GH, and load instructions. Use only links from this domain.</p>
      <div class="btn-row">
        <a class="btn btn-gold" href="${OFFICIAL_DISCORD}" target="_blank" rel="noopener">Official Discord</a>
        <a class="btn" href="/status">Live status</a>
        <a class="btn" href="/executors">Executor support</a>
        <a class="btn" href="/guide">Safety guide</a>
      </div>
    </section>
    <div class="grid">
      <div class="card">
        <h3>Official load</h3>
        <p>Third-party pastes may be outdated or malicious.</p>
        <div class="code" style="margin-top:10px">loadstring(game:HttpGet("https://greedyhudzell.xyz/loader.lua"))()</div>
      </div>
      <div class="card">
        <h3>Keys</h3>
        <p>Keys are bound to your Roblox username. Remaining time is shown in the hub Info tab after unlock.</p>
      </div>
      <div class="card">
        <h3>Support</h3>
        <p>Prefer executors with high <strong style="color:var(--text)">sUNC%</strong> and Support Full/Good on the Executors page before running GH.</p>
      </div>
    </div>`;
  return layout("Home", "/", body, { rainware: true });
}

function pageStatus(status) {
  const bw = status.ban_wave || {};
  const body = `
    ${banBanner(status)}
    <section class="panel" style="margin-top:22px">
      <h2>Service status</h2>
      <p class="sub">Public snapshot. Discord bot can push announcements into this feed later.</p>
      <div class="grid">
        <div class="card">
          <h3>Ban wave</h3>
          <p><span class="pill ${bw.active ? "pill-warn" : "pill-ok"}">${bw.active ? "Active" : "Clear"}</span></p>
          <p style="margin-top:8px">${escapeHtml(bw.message || "—")}</p>
        </div>
        <div class="card">
          <h3>Last update</h3>
          <p style="font-family:JetBrains Mono,monospace;font-size:12px;color:var(--muted)">${escapeHtml(status.updated_at || "—")}</p>
        </div>
        <div class="card">
          <h3>API</h3>
          <ul style="padding-left:18px;color:var(--muted);font-size:14px">
            <li><a href="/api/status">/api/status</a></li>
            <li><a href="/api/executors">/api/executors</a></li>
            <li>POST /api/admin/status (bot)</li>
          </ul>
        </div>
      </div>
    </section>`;
  return layout("Status", "/status", body);
}

function pageExecutors() {
  const body = `
    <section class="panel" style="margin-top:22px">
      <h2>Executor support for GH</h2>
      <p class="sub">
        Detection &amp; Update from WEAO. <strong>Support</strong> is derived from sUNC% (and detection/update flags)
        and mapped to an X/11 style score for Greedy Hudzell feature compatibility.
      </p>
      <div class="note-box">
        Full / Good ≈ safer to run GH. Partial / Poor may break modules (filesystem, request, unc, etc.).
        Always verify on your own build — WEAO data can lag.
      </div>
      <div id="exec-root"><p style="color:var(--muted);font-size:14px">Loading…</p></div>
      <p style="margin-top:14px;font-size:12px;color:#666">Source: weao.xyz · Not affiliated with WEAO.</p>
    </section>
    <script>
      function pill(cls, text) {
        return '<span class="pill ' + cls + '">' + text + '</span>';
      }
      function supportFrom(ex) {
        var sunc = Number(ex.suncPercentage != null ? ex.suncPercentage : 0);
        var unc = Number(ex.uncPercentage != null ? ex.uncPercentage : 0);
        var score = Math.max(sunc, unc * 0.9);
        var detected = ex.detected === true;
        var updated = ex.updateStatus === true;
        var outOf11 = Math.round((score / 100) * 11);
        if (!updated) outOf11 = Math.min(outOf11, 6);
        if (detected) outOf11 = Math.min(outOf11, 4);
        outOf11 = Math.max(0, Math.min(11, outOf11));
        var level = 'Poor', cls = 'pill-bad';
        if (!detected && updated && score >= 90) { level = 'Full'; cls = 'pill-ok'; }
        else if (!detected && score >= 70) { level = 'Good'; cls = 'pill-ok'; }
        else if (!detected && score >= 40) { level = 'Partial'; cls = 'pill-warn'; }
        return { level: level, cls: cls, outOf11: outOf11, score: Math.round(score), label: level + ' · ' + outOf11 + '/11' };
      }
      async function load() {
        var root = document.getElementById('exec-root');
        try {
          var r = await fetch('/api/executors');
          var data = await r.json();
          if (!Array.isArray(data)) throw new Error(data.error || 'bad response');
          data.sort(function(a, b) {
            return (Number(b.suncPercentage)||0) - (Number(a.suncPercentage)||0);
          });
          var rows = data.map(function(ex) {
            var name = ex.title || ex.name || '?';
            var sup = supportFrom(ex);
            var det = ex.detected ? pill('pill-bad', 'Detected') : pill('pill-ok', 'Clear');
            var upd = ex.updateStatus ? pill('pill-ok', 'Updated') : pill('pill-warn', 'Outdated');
            var sunc = (ex.suncPercentage != null ? ex.suncPercentage : '—') + '%';
            return '<tr><td><strong>' + name + '</strong><div style="color:#777;font-size:11px">' + (ex.platform||'') +
              '</div></td><td>' + det + '</td><td>' + upd + '</td><td>' + pill(sup.cls, sup.label) +
              '</td><td style="color:#999">' + sunc + '</td></tr>';
          }).join('');
          root.innerHTML = '<div style="overflow-x:auto"><table><thead><tr><th>Executor</th><th>Detection</th><th>Update</th><th>Support</th><th>sUNC</th></tr></thead><tbody>' +
            rows + '</tbody></table></div>';
        } catch (e) {
          root.innerHTML = '<div class="warn-box">Failed to load: ' + (e.message || e) + '</div>';
        }
      }
      load();
    </script>`;
  return layout("Executors", "/executors", body);
}

function pageGuide() {
  const body = `
    <section class="panel" style="margin-top:22px">
      <h2>Recommendations</h2>
      <p class="sub">Risk reduction only — nothing guarantees you will not be banned.</p>
      <h3 style="font-size:15px;margin-top:8px">During ban waves</h3>
      <ul style="color:var(--muted);font-size:14px;padding-left:18px;margin:8px 0 16px">
        <li>Prefer Support Full/Good executors (high sUNC%) before running GH.</li>
        <li>Do not run blatant autofarm unattended on accounts you care about.</li>
        <li>Avoid rapid rejoin / queue-on-teleport loops.</li>
        <li>Take a 24–48h break after large community-wide ban reports.</li>
        <li>Load only from <strong style="color:var(--text)">greedyhudzell.xyz</strong>.</li>
      </ul>
      <h3 style="font-size:15px">Alt accounts</h3>
      <div class="warn-box">
        <strong>Important:</strong> An alt does <em>not</em> protect you from hardware (HWID), IP, or device-level bans.
      </div>
      <p style="color:var(--muted);font-size:14px;margin-bottom:8px">
        Some users look at <a href="https://althub.gg" target="_blank" rel="noopener">althub.gg</a>
        (<a href="https://discord.gg/althub" target="_blank" rel="noopener">discord.gg/althub</a>).
      </p>
      <div class="note-box">
        Not a paid promotion. We are not affiliated with AltHub and cannot verify reliability or safety.
      </div>
      <h3 style="font-size:15px;margin-top:16px">Community</h3>
      <p style="color:var(--muted);font-size:14px">
        Official GH Discord: <a href="${OFFICIAL_DISCORD}">${OFFICIAL_DISCORD.replace("https://", "")}</a>
      </p>
    </section>`;
  return layout("Guide", "/guide", body);
}

function pageTos() {
  const body = `
    <section class="panel tos" style="margin-top:22px">
      <h2>Terms of Service</h2>
      <p class="sub">Last updated: August 18, 2026 · English</p>
      <p>By accessing Greedy Hudzell websites, loaders, keys, Discord communities, or related software (the “Service”), you agree to these Terms.</p>
      <h3>1. Nature of the Service</h3>
      <p>The Service is provided “as is.” Automation and third-party executors carry a material risk of account penalties. You accept full responsibility for your accounts and devices.</p>
      <h3>2. License &amp; restrictions</h3>
      <p>You receive a limited, personal, non-transferable, revocable license when a valid key is required. You must not:</p>
      <ol>
        <li>Reverse engineer, decompile, deobfuscate, or otherwise attempt to derive source code, keys, APIs, or internal protection mechanisms of the Service, except where such restriction is prohibited by law.</li>
        <li>Claim authorship of Greedy Hudzell, its modules, UI, or branding, or represent yourself as the creator or official maintainer unless you are the rights holder.</li>
        <li>Resell, sublicense, or publicly redistribute paid builds, private keys, or non-public loaders without written permission.</li>
        <li>Advertise or solicit third-party services inside official Greedy Hudzell Discord channels unless staff explicitly allow it.</li>
        <li>Bypass key validation, impersonate staff, phish users, or disrupt infrastructure.</li>
      </ol>
      <h3>3. Keys &amp; access</h3>
      <p>Keys may be bound to a Roblox username, time-limited, rate-limited, and revoked for abuse.</p>
      <h3>4. No warranty / liability</h3>
      <p>No warranties. We are not liable for bans, lost progress, or damages from use of the Service or third-party executors, to the maximum extent permitted by law.</p>
      <h3>5. Common sense</h3>
      <p>Act in good faith. Do not harass staff or users or distribute malware under our name. Staff may refuse support or revoke access.</p>
      <h3>6. Contact</h3>
      <p>Official community: <a href="${OFFICIAL_DISCORD}">${OFFICIAL_DISCORD.replace("https://", "")}</a>.</p>
    </section>`;
  return layout("Terms of Service", "/tos", body);
}

function pageObfuscator() {
  const body = `
    <section class="panel" style="margin-top:22px">
      <h2>Lua obfuscator</h2>
      <p class="sub">Same black theme · syntax check understands <code style="color:var(--gold-soft)">--[[ ]]</code> block comments.</p>
      <textarea id="src" class="code-input" placeholder="-- paste Lua here"></textarea>
      <div class="row">
        <select id="mode">
          <option value="light">Light (minify-friendly)</option>
          <option value="strings">Table indirection + strings</option>
          <option value="longstr">Code inside [====[]====] style wrap</option>
        </select>
        <button class="btn" type="button" id="btn-syntax">Check syntax</button>
        <button class="btn btn-gold" type="button" id="btn-obf">Obfuscate</button>
      </div>
      <div id="msg"></div>
      <textarea id="out" class="code-input" style="min-height:180px;margin-top:8px" placeholder="Output…" readonly></textarea>
      <p style="margin-top:12px;font-size:12px;color:#666">
        If upstream luaobfuscator.com is configured on the worker, Obfuscate proxies to it.
        Syntax check runs locally on this worker and does <strong>not</strong> treat <code>--[[ ... ]]</code> as an error.
      </p>
    </section>
    <script>
      var msg = document.getElementById('msg');
      var src = document.getElementById('src');
      var out = document.getElementById('out');
      function show(html) { msg.innerHTML = html; }
      document.getElementById('btn-syntax').onclick = async function() {
        show('<p style="color:var(--muted);font-size:13px">Checking…</p>');
        try {
          var r = await fetch('/api/syntax-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: src.value })
          });
          var j = await r.json();
          if (j.ok) show('<div class="ok-box">Syntax OK' + (j.note ? ' — ' + j.note : '') + '</div>');
          else show('<div class="warn-box">Issues:\\n' + (j.issues || []).map(function(i){return i;}).join('\\n') + '</div>');
        } catch (e) {
          show('<div class="warn-box">' + e.message + '</div>');
        }
      };
      document.getElementById('btn-obf').onclick = async function() {
        show('<p style="color:var(--muted);font-size:13px">Working…</p>');
        try {
          var r = await fetch('/api/obfuscate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: src.value, mode: document.getElementById('mode').value })
          });
          var j = await r.json();
          if (j.error) {
            show('<div class="warn-box">' + j.error + '</div>');
            return;
          }
          out.value = j.code || j.result || '';
          show('<div class="ok-box">Done</div>');
        } catch (e) {
          show('<div class="warn-box">' + e.message + '</div>');
        }
      };
    </script>`;
  return layout("Obfuscator", "/obfuscator", body);
}

/**
 * Lightweight Lua-ish syntax heuristics.
 * IMPORTANT: --[[ ... ]] and --[=[ ... ]=] are valid comments, not errors.
 */
function syntaxCheckLua(code) {
  const issues = [];
  if (typeof code !== "string" || !code.length) {
    return { ok: false, issues: ["Empty input"] };
  }

  // Strip long comments --[=*[ ... ]=*] and short comments
  let stripped = code.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, " ");
  stripped = stripped.replace(/--[^\\n]*/g, " ");
  // Strip long strings [=*[ ... ]=*]
  stripped = stripped.replace(/\[(=*)\[[\s\S]*?\]\1\]/g, '""');
  // Strip normal strings (naive)
  stripped = stripped.replace(/"(?:\\.|[^"\\\\])*"/g, '""');
  stripped = stripped.replace(/'(?:\\.|[^'\\\\])*'/g, "''");

  // Balance check for common delimiters on stripped code
  const pairs = [
    ["(", ")", "parentheses"],
    ["{", "}", "braces"],
    ["[", "]", "brackets"],
  ];
  for (const [a, b, name] of pairs) {
    let depth = 0;
    for (const ch of stripped) {
      if (ch === a) depth++;
      if (ch === b) depth--;
      if (depth < 0) {
        issues.push(`Unbalanced ${name}`);
        break;
      }
    }
    if (depth > 0) issues.push(`Unclosed ${name}`);
  }

  // Keyword block balance (very rough)
  const openWords = (stripped.match(/\\b(function|if|for|while|repeat|do)\\b/g) || []).length;
  const endWords = (stripped.match(/\\bend\\b/g) || []).length;
  const untilWords = (stripped.match(/\\buntil\\b/g) || []).length;
  if (openWords > endWords + untilWords + 2) {
    issues.push("Possible missing end (heuristic)");
  }

  return {
    ok: issues.length === 0,
    issues,
    note: "Block comments --[[ ]] are treated as valid and ignored.",
  };
}

async function fetchWeaoExecutors() {
  const res = await fetch("https://weao.xyz/api/status/exploits", {
    headers: { "User-Agent": "WEAO-3PService", Accept: "application/json" },
  });
  if (!res.ok) throw new Error("weao " + res.status);
  return res.json();
}

async function getStatus(env) {
  try {
    if (env?.SITE_STATUS) {
      const raw = await env.SITE_STATUS.get("public");
      if (raw) return JSON.parse(raw);
    }
  } catch (_) {}
  return { ...DEFAULT_STATUS, updated_at: new Date().toISOString() };
}

async function setStatus(env, next) {
  if (!env?.SITE_STATUS) throw new Error("SITE_STATUS KV not bound");
  next.updated_at = new Date().toISOString();
  await env.SITE_STATUS.put("public", JSON.stringify(next));
  return next;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      // —— APIs ——
      if (path === "/api/status") {
        const status = await getStatus(env);
        return new Response(JSON.stringify(status, null, 2), {
          headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
        });
      }

      if (path === "/api/executors") {
        try {
          const data = await fetchWeaoExecutors();
          const enriched = (Array.isArray(data) ? data : []).map((ex) => ({
            ...ex,
            ghSupport: supportFromExploit(ex),
          }));
          return new Response(JSON.stringify(enriched), {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=120",
              ...cors,
            },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: String(e.message || e) }), {
            status: 502,
            headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
          });
        }
      }

      if (path === "/api/syntax-check" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const result = syntaxCheckLua(body.code || "");
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
        });
      }

      if (path === "/api/obfuscate" && request.method === "POST") {
        // Placeholder: wire to luaobfuscator.com with env.LUAOBF_KEY if present
        const body = await request.json().catch(() => ({}));
        if (!body.code) {
          return new Response(JSON.stringify({ error: "No code" }), {
            status: 400,
            headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
          });
        }
        if (env?.LUAOBF_KEY) {
          // Optional upstream — keep your existing proxy logic if already working
          try {
            const up = await fetch("https://api.luaobfuscator.com/obfuscate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: env.LUAOBF_KEY,
              },
              body: JSON.stringify({ script: body.code }),
            });
            const text = await up.text();
            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = { code: text };
            }
            if (!up.ok) {
              return new Response(
                JSON.stringify({ error: parsed.message || parsed.error || text || "upstream error" }),
                { status: 502, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } }
              );
            }
            return new Response(
              JSON.stringify({ code: parsed.code || parsed.result || parsed.script || text }),
              { headers: { "Content-Type": "application/json; charset=utf-8", ...cors } }
            );
          } catch (e) {
            return new Response(JSON.stringify({ error: String(e.message || e) }), {
              status: 502,
              headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
            });
          }
        }
        // Local fallback modes (no real VM obfuscation — wrap only)
        const mode = body.mode || "light";
        let code = body.code;
        if (mode === "longstr") {
          code = `return loadstring([====[\n${code}\n]====])()`;
        } else if (mode === "strings") {
          code = `-- strings mode requires upstream API\n` + code;
        }
        return new Response(JSON.stringify({ code, note: "local fallback; set LUAOBF_KEY for real obfuscation" }), {
          headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
        });
      }

      // Discord bot endpoint (leave ready)
      if (path === "/api/admin/status" && request.method === "POST") {
        const auth = request.headers.get("Authorization") || "";
        const secret = env?.ADMIN_SECRET || env?.BOT_SECRET;
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
          });
        }
        const patch = await request.json().catch(() => ({}));
        const cur = await getStatus(env);
        if (patch.ban_wave) cur.ban_wave = { ...cur.ban_wave, ...patch.ban_wave };
        if (patch.announcement !== undefined) cur.announcement = patch.announcement;
        if (patch.clear_announcement) cur.announcement = null;
        if (patch.ban_wave_clear) cur.ban_wave = { ...cur.ban_wave, active: false };
        if (patch.executors_override) {
          cur.executors_override = { ...cur.executors_override, ...patch.executors_override };
        }
        try {
          await setStatus(env, cur);
        } catch (e) {
          return new Response(JSON.stringify({ error: String(e.message || e), status: cur }), {
            status: 500,
            headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
          });
        }
        return new Response(JSON.stringify({ ok: true, status: cur }), {
          headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
        });
      }

      const status = await getStatus(env);
      const htmlHeaders = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=30" };

      if (path === "/" || path === "/index.html") return new Response(pageHome(status), { headers: htmlHeaders });
      if (path === "/status") return new Response(pageStatus(status), { headers: htmlHeaders });
      if (path === "/executors") return new Response(pageExecutors(), { headers: htmlHeaders });
      if (path === "/guide") return new Response(pageGuide(), { headers: htmlHeaders });
      if (path === "/tos" || path === "/terms") return new Response(pageTos(), { headers: htmlHeaders });
      if (path === "/obfuscator") return new Response(pageObfuscator(), { headers: htmlHeaders });

      return new Response(pageHome(status), { headers: htmlHeaders });
    } catch (err) {
      return new Response("Internal error: " + (err.message || err), { status: 500 });
    }
  },
};
