/**
 * greedyhudzell.xyz — public site Worker (black / white, subtle gold)
 * Repo: mixask/greedyhudzell  →  deploy this as src/index.js (or merge routes)
 *
 * GH repo (mixask/GH) stays Lua only — do not put this file there.
 *
 * Routes: / /status /executors /guide /tos /obfuscator
 * API: /api/status /api/executors /api/syntax-check /api/obfuscate /api/admin/status
 */

const OFFICIAL_DISCORD = "https://discord.gg/sbVuaT9a2T";

const DEFAULT_STATUS = {
  ban_wave: {
    active: true,
    message:
      "Roblox ban wave is active. Use scripts at your own risk. Prefer high sUNC executors.",
    updated_at: new Date().toISOString(),
  },
  announcement: null,
  services: { api: "ok" },
  updated_at: new Date().toISOString(),
};

function css() {
  return `
:root {
  --bg: #080808;
  --bg2: #0e0e0e;
  --card: #121212;
  --border: #242424;
  --border2: #333;
  --text: #ececec;
  --muted: #8a8a8a;
  --accent: #c4a035;
  --accent-dim: rgba(196,160,53,.12);
  --danger: #d96060;
  --ok: #5aad7a;
  --warn: #c9a227;
  --radius: 14px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Inter, system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  line-height: 1.5;
  background-image: radial-gradient(ellipse 70% 40% at 50% -10%, rgba(255,255,255,.04), transparent);
}
a { color: #d0d0d0; text-decoration: none; }
a:hover { color: #fff; }
.wrap { width: min(960px, 94vw); margin: 0 auto; padding: 24px 0 72px; }

/* top tabs */
.top {
  position: sticky; top: 0; z-index: 40;
  background: rgba(8,8,8,.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.top-inner {
  width: min(960px, 94vw); margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 12px 0; flex-wrap: wrap;
}
.brand {
  display: flex; align-items: center; gap: 10px;
  font-weight: 700; color: var(--text); text-decoration: none; font-size: 15px;
}
.brand:hover { color: #fff; }
.brand-mark {
  width: 32px; height: 32px; border-radius: 9px;
  background: #161616; border: 1px solid var(--border2);
  display: grid; place-items: center; font-size: 12px; font-weight: 700; color: #bbb;
}
.nav { display: flex; flex-wrap: wrap; gap: 4px; }
.nav a {
  color: var(--muted); padding: 7px 12px; border-radius: 999px;
  font-size: 12px; font-weight: 500; border: 1px solid transparent;
}
.nav a:hover { color: var(--text); background: var(--card); border-color: var(--border); }
.nav a.active {
  color: #fff; background: #1a1a1a; border-color: var(--border2);
  box-shadow: inset 0 0 0 1px rgba(196,160,53,.35);
}

.banner {
  margin-top: 18px; padding: 14px 16px; border-radius: var(--radius);
  border: 1px solid var(--border2); background: var(--card);
  display: flex; gap: 12px; align-items: flex-start;
}
.banner .dot {
  width: 8px; height: 8px; margin-top: 6px; border-radius: 50%;
  background: var(--warn); flex-shrink: 0;
}
.banner strong {
  display: block; font-size: 11px; text-transform: uppercase;
  letter-spacing: .06em; color: #b0b0b0; margin-bottom: 4px;
}
.banner p { font-size: 13px; color: var(--text); }

.hero { text-align: center; padding: 40px 8px 20px; }
.hero h1 { font-size: clamp(1.7rem, 3.5vw, 2.3rem); font-weight: 700; margin-bottom: 8px; }
.hero h1 em { font-style: normal; color: #c8c8c8; }
.hero p { color: var(--muted); max-width: 480px; margin: 0 auto 18px; font-size: 14px; }
.btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 9px 16px; border-radius: 999px; font-size: 12px; font-weight: 600;
  border: 1px solid var(--border2); background: var(--card); color: var(--text);
  cursor: pointer;
}
.btn:hover { border-color: #444; background: #181818; color: #fff; }
.btn-primary { background: #1c1c1c; border-color: #3a3a3a; }
.btn-primary:hover { border-color: rgba(196,160,53,.5); }

.grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px; margin-top: 8px;
}
.card, .panel {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px 18px;
}
.panel { margin-top: 16px; }
.panel h2 { font-size: 1.05rem; margin-bottom: 4px; }
.panel .sub { color: var(--muted); font-size: 13px; margin-bottom: 14px; }
.card h3 {
  font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
  color: #9a9a9a; margin-bottom: 8px;
}
.card p, .card li { color: var(--muted); font-size: 13px; }

.pill {
  display: inline-flex; padding: 3px 9px; border-radius: 999px;
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em;
  border: 1px solid var(--border);
}
.pill-ok { color: var(--ok); background: rgba(90,173,122,.1); border-color: rgba(90,173,122,.3); }
.pill-warn { color: var(--warn); background: rgba(201,162,39,.1); border-color: rgba(201,162,39,.3); }
.pill-bad { color: var(--danger); background: rgba(217,96,96,.1); border-color: rgba(217,96,96,.3); }
.pill-muted { color: var(--muted); background: #161616; }

table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 9px 6px; border-bottom: 1px solid var(--border); }
th {
  color: var(--muted); font-size: 10px; text-transform: uppercase;
  letter-spacing: .05em; font-weight: 600;
}
.sec-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
  color: #888; margin: 14px 0 8px;
}

.code {
  font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px;
  background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;
  padding: 10px 12px; color: #c8c8c8; word-break: break-all; white-space: pre-wrap;
}
textarea.code-input {
  width: 100%; min-height: 200px;
  font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12px;
  background: #0a0a0a; color: var(--text); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px; resize: vertical;
}
textarea.code-input:focus { outline: none; border-color: #444; }
select.field {
  background: var(--bg2); color: var(--text); border: 1px solid var(--border);
  border-radius: 999px; padding: 8px 12px; font-size: 12px;
}
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0; }

.box {
  border-radius: 10px; padding: 10px 12px; font-size: 13px; margin: 10px 0;
  border: 1px solid var(--border);
}
.box-ok { background: rgba(90,173,122,.08); border-color: rgba(90,173,122,.3); color: #b8dcc8; }
.box-warn { background: rgba(217,96,96,.08); border-color: rgba(217,96,96,.3); color: #e8b0b0; }
.box-note { background: #141414; color: #a8a8a8; }

.rainware {
  margin-top: 28px; padding: 18px; border-radius: var(--radius);
  border: 1px solid var(--border); background: #0f0f0f;
}
.rainware h3 { font-size: 14px; margin-bottom: 10px; color: #ccc; }
.rainware-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;
}
.rw {
  background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: 10px;
}
.rw label {
  display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .06em;
  color: #666; margin-bottom: 4px;
}
.rw a, .rw code { font-size: 12px; color: #bbb; word-break: break-all; }
.rainware-foot { margin-top: 12px; font-size: 11px; color: #555; text-align: center; }

.tos p, .tos li { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
.tos h3 { font-size: 14px; margin: 16px 0 6px; color: var(--text); }
.tos ol { margin-left: 18px; }

footer.site {
  margin-top: 28px; text-align: center; font-size: 11px; color: #555;
}
footer.site a { color: #777; }

@media (max-width: 640px) {
  th:nth-child(5), td:nth-child(5) { display: none; }
}
`;
}

function layout(title, active, body, { rainware = false } = {}) {
  const tabs = [
    ["/", "Home"],
    ["/status", "Status"],
    ["/executors", "Executors"],
    ["/guide", "Guide"],
    ["/tos", "ToS"],
    ["/obfuscator", "Obfuscator"],
  ]
    .map(
      ([href, label]) =>
        `<a href="${href}" class="${active === href ? "active" : ""}">${label}</a>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} · Greedy Hudzell</title>
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
      <nav class="nav">${tabs}</nav>
    </div>
  </header>
  <main class="wrap">
    ${body}
    ${rainware ? rainwareBlock() : ""}
    <footer class="site">
      © Greedy Hudzell · <a href="${OFFICIAL_DISCORD}">discord.gg/sbVuaT9a2T</a> · Not affiliated with Roblox
    </footer>
  </main>
</body>
</html>`;
}

function rainwareBlock() {
  return `
<section class="rainware">
  <h3>Rainware · separate project <span class="pill pill-warn">Paid</span></h3>
  <div class="rainware-grid">
    <div class="rw"><label>Discord</label><a href="https://discord.gg/rainware" target="_blank" rel="noopener">discord.gg/rainware</a></div>
    <div class="rw"><label>Game</label><a href="https://www.roblox.com/games/10595058975/Arcane-Lineage" target="_blank" rel="noopener">Arcane Lineage</a></div>
    <div class="rw" style="grid-column:1/-1"><label>Loader</label>
      <div class="code">loadstring(game:HttpGet("https://raw.githubusercontent.com/ShitScripts/rainware-loader/refs/heads/main/loader-ob.lua"))()</div>
    </div>
  </div>
  <p class="rainware-foot">Rainware is separate. GH remains its own product. Official GH Discord: discord.gg/sbVuaT9a2T</p>
</section>`;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function banBanner(status) {
  let html = "";
  const bw = status?.ban_wave;
  if (bw?.active) {
    html += `<div class="banner"><div class="dot"></div><div>
      <strong>Ban wave</strong><p>${esc(bw.message || "Elevated risk.")}</p>
    </div></div>`;
  }
  if (status?.announcement?.message) {
    html += `<div class="banner" style="margin-top:10px"><div class="dot"></div><div>
      <strong>Announcement</strong><p>${esc(status.announcement.message)}</p>
    </div></div>`;
  }
  return html;
}

function isExternal(ex) {
  return String(ex.extype || ex.type || "").toLowerCase().includes("external");
}

function supportFromExploit(ex) {
  if (isExternal(ex)) {
    return {
      level: "External",
      cls: "pill-muted",
      label: "External",
      suncLabel: "External",
      outOf11: null,
      ghOk: false,
    };
  }
  const sunc = Number(ex.suncPercentage);
  const has = Number.isFinite(sunc);
  const score = has ? sunc : 0;
  let out = has ? Math.round((score / 100) * 11) : 0;
  if (ex.detected === true) out = Math.min(out, Math.max(0, out - 3));
  if (ex.updateStatus === false) out = Math.min(out, Math.max(0, out - 2));
  out = Math.max(0, Math.min(11, out));

  let level = "Poor";
  let cls = "pill-bad";
  let ghOk = false;
  if (has && score >= 95 && !ex.detected) {
    level = "Full";
    cls = "pill-ok";
    ghOk = true;
  } else if (has && score >= 80 && !ex.detected) {
    level = "Good";
    cls = "pill-ok";
    ghOk = true;
  } else if (has && score >= 50) {
    level = "Partial";
    cls = "pill-warn";
    ghOk = score >= 70 && !ex.detected;
  }
  return {
    level,
    cls,
    label: `${level} · ${out}/11`,
    suncLabel: has ? `${Math.round(score)}%` : "N/A",
    outOf11: out,
    ghOk,
  };
}

function pageHome(status) {
  return layout(
    "Home",
    "/",
    `
    ${banBanner(status)}
    <section class="hero">
      <h1>Greedy <em>Hudzell</em></h1>
      <p>Official status, executor support, and load path. Only trust this domain.</p>
      <div class="btns">
        <a class="btn btn-primary" href="${OFFICIAL_DISCORD}" target="_blank" rel="noopener">Discord</a>
        <a class="btn" href="/status">Status</a>
        <a class="btn" href="/executors">Executors</a>
        <a class="btn" href="/obfuscator">Obfuscator</a>
      </div>
    </section>
    <div class="grid">
      <div class="card">
        <h3>Load</h3>
        <div class="code">loadstring(game:HttpGet("https://greedyhudzell.xyz/loader.lua"))()</div>
      </div>
      <div class="card">
        <h3>Keys</h3>
        <p>Username-bound. Remaining time is shown in the hub after unlock.</p>
      </div>
      <div class="card">
        <h3>Support</h3>
        <p>Use executors with high sUNC% (Support Full/Good) before running GH.</p>
      </div>
    </div>`,
    { rainware: true }
  );
}

function pageStatus(status) {
  const bw = status.ban_wave || {};
  return layout(
    "Status",
    "/status",
    `
    ${banBanner(status)}
    <section class="panel">
      <h2>Status</h2>
      <p class="sub">Public snapshot for users and Discord bot.</p>
      <div class="grid">
        <div class="card">
          <h3>Ban wave</h3>
          <p><span class="pill ${bw.active ? "pill-warn" : "pill-ok"}">${bw.active ? "Active" : "Clear"}</span></p>
          <p style="margin-top:8px">${esc(bw.message || "—")}</p>
        </div>
        <div class="card">
          <h3>Updated</h3>
          <p style="font-family:monospace;font-size:12px;color:var(--muted)">${esc(status.updated_at || "—")}</p>
        </div>
        <div class="card">
          <h3>API</h3>
          <p><a href="/api/status">/api/status</a><br/><a href="/api/executors">/api/executors</a></p>
        </div>
      </div>
    </section>`
  );
}

function pageExecutors() {
  return layout(
    "Executors",
    "/executors",
    `
    <section class="panel">
      <h2>Executor support</h2>
      <p class="sub">Support ranks by sUNC% (higher = better → X/11). Externals show “External”.</p>
      <div id="exec-root"><p style="color:var(--muted);font-size:13px">Loading…</p></div>
      <p style="margin-top:12px;font-size:11px;color:#555">Source: weao.xyz</p>
    </section>
    <script>
    function isExternal(ex) {
      return String(ex.extype || ex.type || '').toLowerCase().indexOf('external') !== -1;
    }
    function supportFrom(ex) {
      if (isExternal(ex)) return { cls: 'pill-muted', label: 'External', suncLabel: 'External' };
      var sunc = Number(ex.suncPercentage), has = isFinite(sunc), score = has ? sunc : 0;
      var out = has ? Math.round((score / 100) * 11) : 0;
      if (ex.detected === true) out = Math.min(out, Math.max(0, out - 3));
      if (ex.updateStatus === false) out = Math.min(out, Math.max(0, out - 2));
      out = Math.max(0, Math.min(11, out));
      var level = 'Poor', cls = 'pill-bad';
      if (has && score >= 95 && !ex.detected) { level = 'Full'; cls = 'pill-ok'; }
      else if (has && score >= 80 && !ex.detected) { level = 'Good'; cls = 'pill-ok'; }
      else if (has && score >= 50) { level = 'Partial'; cls = 'pill-warn'; }
      return { cls: cls, label: level + ' · ' + out + '/11', suncLabel: has ? Math.round(score) + '%' : 'N/A' };
    }
    function pill(c, t) { return '<span class="pill ' + c + '">' + t + '</span>'; }
    function rows(list) {
      return list.map(function(ex) {
        var sup = supportFrom(ex);
        return '<tr><td><strong>' + (ex.title || '?') + '</strong><div style="color:#666;font-size:11px">' +
          (ex.platform || '') + (isExternal(ex) ? ' · external' : '') + '</div></td><td>' +
          (ex.detected ? pill('pill-bad','Detected') : pill('pill-ok','Clear')) + '</td><td>' +
          (ex.updateStatus ? pill('pill-ok','Updated') : pill('pill-warn','Outdated')) + '</td><td>' +
          pill(sup.cls, sup.label) + '</td><td style="color:#888">' + sup.suncLabel + '</td></tr>';
      }).join('');
    }
    fetch('/api/executors').then(function(r){ return r.json(); }).then(function(data) {
      if (!Array.isArray(data)) throw new Error(data.error || 'bad data');
      data.sort(function(a,b) {
        var ae = isExternal(a) ? 1 : 0, be = isExternal(b) ? 1 : 0;
        if (ae !== be) return ae - be;
        return (Number(b.suncPercentage)||0) - (Number(a.suncPercentage)||0);
      });
      var inj = data.filter(function(x){ return !isExternal(x); });
      var ext = data.filter(isExternal);
      var head = '<table><thead><tr><th>Name</th><th>Detection</th><th>Update</th><th>Support</th><th>sUNC</th></tr></thead><tbody>';
      document.getElementById('exec-root').innerHTML =
        '<div class="sec-title">Executors</div><div style="overflow-x:auto">' + head + rows(inj) + '</tbody></table></div>' +
        '<div class="sec-title">Externals</div><div style="overflow-x:auto">' + head + rows(ext) + '</tbody></table></div>';
    }).catch(function(e) {
      document.getElementById('exec-root').innerHTML = '<div class="box box-warn">' + e.message + '</div>';
    });
    </script>`
  );
}

function pageGuide() {
  return layout(
    "Guide",
    "/guide",
    `
    <section class="panel">
      <h2>Guide</h2>
      <p class="sub">Risk reduction only — nothing is risk-free.</p>
      <ul style="margin:0 0 12px 18px;color:var(--muted);font-size:13px">
        <li>Prefer Support Full/Good (high sUNC%) before GH.</li>
        <li>Avoid unattended blatant autofarm on main accounts.</li>
        <li>Avoid rapid rejoin loops during ban waves.</li>
        <li>Load only from greedyhudzell.xyz.</li>
      </ul>
      <div class="box box-warn"><strong>Alts:</strong> do not protect against HWID / IP bans.</div>
      <p style="color:var(--muted);font-size:13px;margin-top:10px">
        Some users mention <a href="https://althub.gg" target="_blank" rel="noopener">althub.gg</a>
        — not affiliated; not a paid promo.
      </p>
      <p style="color:var(--muted);font-size:13px;margin-top:12px">
        Official Discord: <a href="${OFFICIAL_DISCORD}">discord.gg/sbVuaT9a2T</a>
      </p>
    </section>`
  );
}

function pageTos() {
  return layout(
    "ToS",
    "/tos",
    `
    <section class="panel tos">
      <h2>Terms of Service</h2>
      <p class="sub">English · August 2026</p>
      <p>By using Greedy Hudzell websites, loaders, keys, or related software (“Service”), you agree to these Terms.</p>
      <h3>1. Nature of the Service</h3>
      <p>Provided “as is.” Automation and third-party executors carry ban risk. You accept full responsibility for your accounts and devices.</p>
      <h3>2. Restrictions</h3>
      <ol>
        <li>Do not reverse engineer, decompile, or deobfuscate the Service except where prohibited restrictions are disallowed by law.</li>
        <li>Do not claim authorship of Greedy Hudzell or represent yourself as its creator or official maintainer unless you are the rights holder.</li>
        <li>Do not resell private keys or non-public loaders without permission.</li>
        <li>Do not advertise third-party services in official GH Discord channels without staff approval.</li>
        <li>Do not bypass key validation, phish users, or disrupt infrastructure.</li>
      </ol>
      <h3>3. Keys</h3>
      <p>Keys may be username-bound, time-limited, and revoked for abuse.</p>
      <h3>4. No warranty</h3>
      <p>No warranties. No liability for bans or damages to the maximum extent permitted by law.</p>
      <h3>5. Common sense</h3>
      <p>Act in good faith. Staff may refuse support or revoke access.</p>
      <h3>6. Contact</h3>
      <p><a href="${OFFICIAL_DISCORD}">discord.gg/sbVuaT9a2T</a></p>
    </section>`
  );
}

function pageObfuscator() {
  // Same shell + nav tabs as every other page — enter via tab, leave via any other tab
  return layout(
    "Obfuscator",
    "/obfuscator",
    `
    <section class="panel">
      <h2>Lua obfuscator</h2>
      <p class="sub">Same site tabs as Home — use the top nav to leave. Syntax check allows <code>--[[ ]]</code>.</p>
      <textarea id="src" class="code-input" placeholder="-- paste Lua here"></textarea>
      <div class="row">
        <select id="mode" class="field">
          <option value="light">Light</option>
          <option value="strings">Strings / table</option>
          <option value="longstr">Long-string wrap</option>
        </select>
        <button type="button" class="btn" id="btn-syntax">Check syntax</button>
        <button type="button" class="btn btn-primary" id="btn-obf">Obfuscate</button>
        <a class="btn" href="/">← Home</a>
      </div>
      <div id="msg"></div>
      <textarea id="out" class="code-input" style="min-height:160px" placeholder="Output…" readonly></textarea>
    </section>
    <script>
    (function(){
      var msg = document.getElementById('msg');
      var src = document.getElementById('src');
      var out = document.getElementById('out');
      function show(h){ msg.innerHTML = h; }
      document.getElementById('btn-syntax').onclick = async function(){
        show('<p style="color:var(--muted);font-size:12px">Checking…</p>');
        try {
          var r = await fetch('/api/syntax-check', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ code: src.value })
          });
          var j = await r.json();
          if (j.ok) show('<div class="box box-ok">Syntax OK' + (j.note ? ' — ' + j.note : '') + '</div>');
          else show('<div class="box box-warn">' + (j.issues||[]).join('<br>') + '</div>');
        } catch(e) { show('<div class="box box-warn">' + e.message + '</div>'); }
      };
      document.getElementById('btn-obf').onclick = async function(){
        show('<p style="color:var(--muted);font-size:12px">Working…</p>');
        out.value = '';
        try {
          var r = await fetch('/api/obfuscate', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ code: src.value, mode: document.getElementById('mode').value })
          });
          var t = await r.text();
          var j = {};
          try { j = JSON.parse(t); } catch(_) {
            show('<div class="box box-warn">Bad response: ' + t.slice(0,200) + '</div>');
            return;
          }
          if (!r.ok || j.error) {
            show('<div class="box box-warn">' + (j.error || ('HTTP ' + r.status)) + '</div>');
            return;
          }
          out.value = j.code || j.result || '';
          show('<div class="box box-ok">Done' + (j.note ? ' — ' + j.note : '') + '</div>');
        } catch(e) { show('<div class="box box-warn">' + e.message + '</div>'); }
      };
    })();
    </script>`
  );
}

function syntaxCheckLua(code) {
  const issues = [];
  if (typeof code !== "string" || !code.trim()) {
    return { ok: false, issues: ["Empty input"] };
  }
  let s = code;
  s = s.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, " ");
  s = s.replace(/--[^\n]*/g, " ");
  s = s.replace(/\[(=*)\[[\s\S]*?\]\1\]/g, '""');
  s = s.replace(/"(?:\\.|[^"\\])*"/g, '""');
  s = s.replace(/'(?:\\.|[^'\\])*'/g, "''");
  for (const [a, b, name] of [
    ["(", ")", "parentheses"],
    ["{", "}", "braces"],
  ]) {
    let d = 0;
    for (const ch of s) {
      if (ch === a) d++;
      if (ch === b) d--;
      if (d < 0) {
        issues.push("Unbalanced " + name);
        break;
      }
    }
    if (d > 0) issues.push("Unclosed " + name);
  }
  return {
    ok: issues.length === 0,
    issues,
    note: "Block comments --[[ ]] are valid and ignored",
  };
}

async function fetchWeao() {
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

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      ...extra,
    },
  });
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
      // Keep existing key/loader routes if this file is the ONLY worker:
      // merge your /validate /loader.lua handlers ABOVE this site block in production.

      if (path === "/api/status") return json(await getStatus(env));

      if (path === "/api/executors") {
        try {
          const data = await fetchWeao();
          const enriched = (Array.isArray(data) ? data : []).map((ex) => ({
            ...ex,
            ghSupport: supportFromExploit(ex),
            isExternal: isExternal(ex),
          }));
          return json(enriched, 200, { "Cache-Control": "public, max-age=120" });
        } catch (e) {
          return json({ error: String(e.message || e) }, 502);
        }
      }

      if (path === "/api/syntax-check" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        return json(syntaxCheckLua(body.code || ""));
      }

      if (path === "/api/obfuscate" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const code = body.code || body.script || "";
        if (!code) return json({ error: "Missing code" }, 400);

        const key = env?.LUAOBF_KEY || env?.LUA_OBFUSCATOR_KEY;
        if (!key) {
          const mode = body.mode || "light";
          let out = code;
          if (mode === "longstr") out = `return assert(loadstring([====[\n${code}\n]====]))()`;
          return json({
            code: out,
            note: "LUAOBF_KEY not set — local fallback only",
          });
        }

        try {
          const up = await fetch("https://api.luaobfuscator.com/v1/obfuscate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: key,
              Authorization: key,
            },
            body: JSON.stringify({ script: code, code }),
          });
          const text = await up.text();
          let parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch (_) {}
          if (!up.ok) {
            return json(
              {
                error:
                  (parsed && (parsed.message || parsed.error)) ||
                  text.trim() ||
                  "Upstream HTTP " + up.status,
              },
              502
            );
          }
          const result =
            (parsed && (parsed.code || parsed.result || parsed.script || parsed.obfuscated)) ||
            (text && !text.trim().startsWith("{") ? text : "");
          if (!result || !String(result).trim()) {
            return json(
              {
                error: "Upstream returned empty result — check LUAOBF_KEY / API path",
                raw: String(text).slice(0, 200),
              },
              502
            );
          }
          return json({ code: result });
        } catch (e) {
          return json({ error: String(e.message || e) }, 502);
        }
      }

      if (path === "/api/admin/status" && request.method === "POST") {
        const auth = request.headers.get("Authorization") || "";
        const secret = env?.ADMIN_SECRET || env?.BOT_SECRET;
        if (!secret || auth !== "Bearer " + secret) return json({ error: "unauthorized" }, 401);
        const patch = await request.json().catch(() => ({}));
        const cur = await getStatus(env);
        if (patch.ban_wave) cur.ban_wave = { ...cur.ban_wave, ...patch.ban_wave };
        if (patch.announcement !== undefined) cur.announcement = patch.announcement;
        if (patch.clear_announcement) cur.announcement = null;
        if (patch.ban_wave_clear) cur.ban_wave = { ...cur.ban_wave, active: false };
        try {
          await setStatus(env, cur);
        } catch (e) {
          return json({ error: String(e.message || e), status: cur }, 500);
        }
        return json({ ok: true, status: cur });
      }

      const status = await getStatus(env);
      const html = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=30" };

      if (path === "/" || path === "/index.html") return new Response(pageHome(status), { headers: html });
      if (path === "/status") return new Response(pageStatus(status), { headers: html });
      if (path === "/executors") return new Response(pageExecutors(), { headers: html });
      if (path === "/guide") return new Response(pageGuide(), { headers: html });
      if (path === "/tos" || path === "/terms") return new Response(pageTos(), { headers: html });
      if (path === "/obfuscator") return new Response(pageObfuscator(), { headers: html });

      return new Response(pageHome(status), { headers: html });
    } catch (err) {
      return new Response("Internal error: " + (err.message || err), { status: 500 });
    }
  },
};
