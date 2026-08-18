/**
 * Greedy Hudzell – public site (black / white / gold)
 * Deploy as Cloudflare Worker on greedyhudzell.xyz
 * Does NOT replace your key-system worker – merge routes or bind this to pages only.
 *
 * Routes:
 *   /              Home
 *   /status        Status
 *   /executors     WEAO-backed executor list
 *   /guide         Recommendations
 *   /tos           Terms of Service
 *   /api/status    JSON status (for future Discord bot)
 *   /api/executors JSON proxy to weao.xyz
 */

const GOLD = "#C9A227";
const GOLD_SOFT = "#E8C547";

const DEFAULT_STATUS = {
  ban_wave: {
    active: true,
    message:
      "Roblox ban wave is active. Use scripts at your own risk. Prefer safer executors and avoid blatant automation on main accounts.",
    color: "#C9A227",
    until: null,
    updated_at: new Date().toISOString(),
  },
  services: {
    api: "unknown",
    github: "unknown",
    keys: "unknown",
  },
  updated_at: new Date().toISOString(),
};

function layout(title, active, body, extraHead = "") {
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
  <meta name="description" content="Greedy Hudzell — official hub site. Status, executors, guide, terms."/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --bg: #0a0a0a;
      --bg2: #111111;
      --card: #141414;
      --card2: #1a1a1a;
      --border: #2a2a2a;
      --text: #f2f2f2;
      --muted: #9a9a9a;
      --gold: ${GOLD};
      --gold-soft: ${GOLD_SOFT};
      --danger: #e85d5d;
      --ok: #4caf7a;
      --warn: #d4a017;
      --radius: 16px;
      --radius-sm: 10px;
      --shadow: 0 12px 40px rgba(0,0,0,.45);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: Inter, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.55;
      background-image:
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(201,162,39,.12), transparent),
        radial-gradient(ellipse 60% 40% at 100% 100%, rgba(255,255,255,.03), transparent);
    }
    a { color: var(--gold-soft); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .wrap {
      width: min(980px, 94vw);
      margin: 0 auto;
      padding: 28px 0 80px;
    }

    /* top bar */
    .top {
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(14px);
      background: rgba(10,10,10,.78);
      border-bottom: 1px solid var(--border);
    }
    .top-inner {
      width: min(980px, 94vw);
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 0;
      flex-wrap: wrap;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      letter-spacing: .02em;
      color: var(--text);
      text-decoration: none;
    }
    .brand:hover { text-decoration: none; }
    .brand-mark {
      width: 34px; height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg, #1a1a1a, #2a2410);
      border: 1px solid var(--gold);
      display: grid; place-items: center;
      color: var(--gold);
      font-size: 14px;
      font-weight: 700;
    }
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .nav-link {
      color: var(--muted);
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 13px;
      font-weight: 500;
      transition: .2s ease;
      text-decoration: none;
    }
    .nav-link:hover {
      color: var(--text);
      border-color: var(--border);
      background: var(--card);
      text-decoration: none;
    }
    .nav-link.active {
      color: #0a0a0a;
      background: var(--gold);
      border-color: var(--gold);
    }

    /* banner */
    .banner {
      margin: 22px 0 0;
      border-radius: var(--radius);
      border: 1px solid var(--gold);
      background: linear-gradient(135deg, rgba(201,162,39,.14), rgba(20,20,20,.9));
      padding: 16px 18px;
      display: flex;
      gap: 14px;
      align-items: flex-start;
      animation: fadeUp .5s ease both;
    }
    .banner .dot {
      width: 10px; height: 10px; margin-top: 6px;
      border-radius: 50%;
      background: var(--gold);
      box-shadow: 0 0 0 4px rgba(201,162,39,.2);
      flex-shrink: 0;
      animation: pulse 1.8s ease infinite;
    }
    .banner strong { color: var(--gold-soft); display: block; margin-bottom: 4px; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }
    .banner p { color: var(--text); font-size: 14px; }

    /* hero */
    .hero {
      text-align: center;
      padding: 48px 12px 28px;
      animation: fadeUp .55s ease both;
    }
    .hero h1 {
      font-size: clamp(1.8rem, 4vw, 2.6rem);
      font-weight: 700;
      letter-spacing: -.02em;
      margin-bottom: 10px;
    }
    .hero h1 span { color: var(--gold); }
    .hero p {
      color: var(--muted);
      max-width: 520px;
      margin: 0 auto 22px;
      font-size: 15px;
    }
    .hero-line {
      width: 64px; height: 3px;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
      margin: 0 auto 22px;
      border-radius: 2px;
    }

    .btn-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--card);
      color: var(--text);
      cursor: pointer;
      transition: .2s ease;
      text-decoration: none;
    }
    .btn:hover { border-color: var(--gold); color: var(--gold-soft); text-decoration: none; transform: translateY(-1px); }
    .btn-gold {
      background: linear-gradient(135deg, var(--gold), #a8841a);
      color: #0a0a0a;
      border-color: var(--gold);
    }
    .btn-gold:hover { color: #0a0a0a; filter: brightness(1.06); }

    /* grid cards */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
      margin-top: 10px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 18px 18px 16px;
      box-shadow: var(--shadow);
      animation: fadeUp .55s ease both;
    }
    .card h3 {
      font-size: 14px;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--gold-soft);
      margin-bottom: 8px;
    }
    .card p, .card li { color: var(--muted); font-size: 14px; }
    .card ul { padding-left: 18px; }
    .card li { margin: 4px 0; }

    .panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 22px;
      margin-top: 18px;
      animation: fadeUp .55s ease both;
    }
    .panel h2 {
      font-size: 1.15rem;
      margin-bottom: 6px;
    }
    .panel .sub {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 16px;
    }

    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .tab {
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg2);
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .tab.on {
      background: rgba(201,162,39,.15);
      border-color: var(--gold);
      color: var(--gold-soft);
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    .pill-ok { background: rgba(76,175,122,.15); color: var(--ok); border: 1px solid rgba(76,175,122,.35); }
    .pill-warn { background: rgba(212,160,23,.15); color: var(--warn); border: 1px solid rgba(212,160,23,.35); }
    .pill-bad { background: rgba(232,93,93,.15); color: var(--danger); border: 1px solid rgba(232,93,93,.35); }
    .pill-muted { background: rgba(154,154,154,.12); color: var(--muted); border: 1px solid var(--border); }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid var(--border);
    }
    th { color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
    td { color: var(--text); }
    tr:hover td { background: rgba(255,255,255,.02); }

    .code {
      font-family: "JetBrains Mono", monospace;
      font-size: 12px;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 12px 14px;
      overflow-x: auto;
      color: var(--gold-soft);
      white-space: pre-wrap;
      word-break: break-all;
    }

    .warn-box {
      border: 1px solid rgba(232,93,93,.4);
      background: rgba(232,93,93,.08);
      border-radius: var(--radius-sm);
      padding: 12px 14px;
      color: #f0c0c0;
      font-size: 13px;
      margin: 12px 0;
    }
    .note-box {
      border: 1px solid rgba(201,162,39,.35);
      background: rgba(201,162,39,.08);
      border-radius: var(--radius-sm);
      padding: 12px 14px;
      color: #e8d9a8;
      font-size: 13px;
      margin: 12px 0;
    }

    .tos p { margin: 0 0 12px; color: var(--muted); font-size: 14px; }
    .tos h3 { margin: 18px 0 8px; font-size: 15px; color: var(--text); }
    .tos ol, .tos ul { margin: 0 0 12px 18px; color: var(--muted); font-size: 14px; }
    .tos li { margin: 6px 0; }

    /* Rainware footer card */
    .rainware {
      margin-top: 36px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: linear-gradient(160deg, #121212, #0e0e0e 60%, #15120a);
      padding: 22px;
      animation: fadeUp .6s ease both;
    }
    .rainware-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .rainware-head h3 {
      font-size: 1rem;
      color: var(--text);
    }
    .rainware-head h3 span { color: var(--gold); }
    .rainware-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .rw-item {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 12px;
    }
    .rw-item label {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .rw-item a, .rw-item code {
      font-size: 12px;
      color: var(--gold-soft);
      word-break: break-all;
    }
    .rainware-foot {
      margin-top: 14px;
      font-size: 11px;
      color: #6a6a6a;
      text-align: center;
    }

    footer.site {
      margin-top: 28px;
      text-align: center;
      color: #555;
      font-size: 12px;
    }

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
      th:nth-child(4), td:nth-child(4) { display: none; }
    }
  </style>
  ${extraHead}
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
    ${rainwareBlock()}
    <footer class="site">© Greedy Hudzell · Official site · Not affiliated with Roblox Corporation</footer>
  </main>
</body>
</html>`;
}

function rainwareBlock() {
  return `
  <section class="rainware" id="rainware">
    <div class="rainware-head">
      <h3><span>Rainware</span> · related project</h3>
      <span class="pill pill-warn">Paid script</span>
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
      <div class="rw-item" style="grid-column: 1 / -1;">
        <label>Loader (paid product)</label>
        <div class="code">loadstring(game:HttpGet("https://raw.githubusercontent.com/ShitScripts/rainware-loader/refs/heads/main/loader-ob.lua"))()</div>
      </div>
    </div>
    <p class="rainware-foot">
      Rainware owns Greedy Hudzell operationally; Greedy Hudzell remains a separate project with its own branding, keys, and distribution.
      Rainware is a paid product — do not expect free access.
    </p>
  </section>`;
}

function banBanner(status) {
  const bw = status?.ban_wave;
  if (!bw || !bw.active) return "";
  return `
  <div class="banner" role="status">
    <div class="dot"></div>
    <div>
      <strong>Ban wave notice</strong>
      <p>${escapeHtml(bw.message || "Elevated ban activity reported.")}</p>
    </div>
  </div>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageHome(status) {
  const body = `
    ${banBanner(status)}
    <section class="hero">
      <div class="hero-line"></div>
      <h1>Greedy <span>Hudzell</span></h1>
      <p>Official status, executor guidance, and load instructions. Use only links from this domain.</p>
      <div class="btn-row">
        <a class="btn btn-gold" href="https://discord.gg/rainware" target="_blank" rel="noopener">Discord</a>
        <a class="btn" href="/status">Live status</a>
        <a class="btn" href="/executors">Executors</a>
        <a class="btn" href="/guide">Safety guide</a>
      </div>
    </section>
    <div class="grid">
      <div class="card">
        <h3>Official load</h3>
        <p>Use the site loader only. Third-party pastes may be outdated or malicious.</p>
        <div class="code" style="margin-top:10px">loadstring(game:HttpGet("https://greedyhudzell.xyz/loader.lua"))()</div>
      </div>
      <div class="card">
        <h3>Keys</h3>
        <p>Keys are bound to your Roblox username and expire after the configured window. Check remaining time in the hub Info tab after unlock.</p>
      </div>
      <div class="card">
        <h3>During ban waves</h3>
        <ul>
          <li>Prefer updated, lower-risk executors</li>
          <li>Avoid 24/7 blatant farms on mains</li>
          <li>Read the Guide before long sessions</li>
        </ul>
      </div>
    </div>`;
  return layout("Home", "/", body);
}

function pageStatus(status) {
  const bw = status.ban_wave || {};
  const body = `
    ${banBanner(status)}
    <section class="panel" style="margin-top:22px">
      <h2>Service status</h2>
      <p class="sub">Public health snapshot. Discord bot can update announcements later.</p>
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
          <h3>Endpoints</h3>
          <ul>
            <li><a href="/api/status">/api/status</a></li>
            <li><a href="/api/executors">/api/executors</a></li>
            <li><a href="/loader.lua">/loader.lua</a> (key worker)</li>
          </ul>
        </div>
      </div>
    </section>`;
  return layout("Status", "/status", body);
}

function pageExecutors() {
  const body = `
    <section class="panel" style="margin-top:22px">
      <h2>Executor status</h2>
      <p class="sub">Data from WEAO · recommend labels are derived (updated + not detected = better). Always verify yourself.</p>
      <div id="exec-root">
        <p style="color:var(--muted);font-size:14px">Loading…</p>
      </div>
      <p style="margin-top:14px;font-size:12px;color:#666">Source: weao.xyz · User-Agent required by their API. Not affiliated with WEAO.</p>
    </section>
    <script>
      function pill(cls, text) {
        return '<span class="pill ' + cls + '">' + text + '</span>';
      }
      function recommend(ex) {
        if (ex.detected === true) return { cls: 'pill-bad', text: 'Avoid' };
        if (ex.updateStatus === false) return { cls: 'pill-warn', text: 'Caution' };
        if (ex.updateStatus === true && ex.detected === false) return { cls: 'pill-ok', text: 'OK' };
        return { cls: 'pill-muted', text: 'Unknown' };
      }
      async function load() {
        const root = document.getElementById('exec-root');
        try {
          const r = await fetch('/api/executors');
          const data = await r.json();
          if (!Array.isArray(data)) throw new Error(data.error || 'bad response');
          let rows = data.map(ex => {
            const name = ex.title || ex.name || '?';
            const rec = recommend(ex);
            const det = ex.detected ? pill('pill-bad', 'Detected') : pill('pill-ok', 'Clear');
            const upd = ex.updateStatus ? pill('pill-ok', 'Updated') : pill('pill-warn', 'Outdated');
            const free = ex.free === true ? 'Free' : (ex.cost || 'Paid');
            return '<tr><td><strong>' + name + '</strong><div style="color:#777;font-size:11px">' + (ex.platform || '') + '</div></td><td>' + det + '</td><td>' + upd + '</td><td>' + pill(rec.cls, rec.text) + '</td><td style="color:#999">' + free + '</td></tr>';
          }).join('');
          root.innerHTML = '<div style="overflow-x:auto"><table><thead><tr><th>Executor</th><th>Detection</th><th>Update</th><th>Recommend</th><th>Cost</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
        } catch (e) {
          root.innerHTML = '<div class="warn-box">Failed to load executor list: ' + (e.message || e) + '</div>';
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
      <p class="sub">Practical risk reduction. Nothing here guarantees you will not be banned.</p>

      <h3 style="margin-top:8px;font-size:15px">During ban waves</h3>
      <ul style="color:var(--muted);font-size:14px;padding-left:18px;margin:8px 0 16px">
        <li>Do not run blatant autofarm unattended for long periods on accounts you care about.</li>
        <li>Avoid rapid rejoin / queue-on-teleport loops.</li>
        <li>Prefer executors marked updated and not detected on the Executors page.</li>
        <li>Take a 24–48h break after large community-wide ban reports.</li>
        <li>Load only from <strong style="color:var(--text)">greedyhudzell.xyz</strong>.</li>
      </ul>

      <h3 style="font-size:15px">Alt accounts</h3>
      <div class="warn-box">
        <strong>Important:</strong> An alt does <em>not</em> protect you from hardware (HWID), IP, or device-level bans.
        If Roblox applies those enforcement types, related accounts and devices can still be affected.
      </div>
      <p style="color:var(--muted);font-size:14px;margin-bottom:8px">
        Some users look for alt providers. One publicly known option is
        <a href="https://althub.gg" target="_blank" rel="noopener">althub.gg</a>
        (<a href="https://discord.gg/althub" target="_blank" rel="noopener">discord.gg/althub</a>).
      </p>
      <div class="note-box">
        This is not a paid promotion. We are not affiliated with AltHub, we were not paid to mention them,
        and we cannot verify their reliability, safety, or ToS compliance. Use third-party account services entirely at your own risk.
      </div>

      <h3 style="font-size:15px;margin-top:16px">General</h3>
      <ul style="color:var(--muted);font-size:14px;padding-left:18px">
        <li>Keep keys private; keys are username-bound.</li>
        <li>Do not share cracked loaders or mirror scripts on random paste sites.</li>
        <li>Report issues in the official Discord instead of random servers.</li>
      </ul>
    </section>`;
  return layout("Guide", "/guide", body);
}

function pageTos() {
  const body = `
    <section class="panel tos" style="margin-top:22px">
      <h2>Terms of Service</h2>
      <p class="sub">Last updated: August 18, 2026 · English</p>

      <p>
        By accessing Greedy Hudzell websites, loaders, keys, Discord communities, or related software
        (collectively, the “Service”), you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h3>1. Nature of the Service</h3>
      <p>
        The Service is provided strictly “as is” and “as available.” Roblox automation and third-party executors
        carry a material risk of account penalties, including permanent bans. You accept full responsibility for
        any action taken with your accounts, devices, and network.
      </p>

      <h3>2. Eligibility &amp; compliance</h3>
      <p>
        You are solely responsible for complying with Roblox Terms of Use, applicable laws, and any platform
        rules where you use the Service. We do not encourage violation of third-party terms; you choose how to use tools you obtain.
      </p>

      <h3>3. License &amp; restrictions</h3>
      <p>Subject to a valid key (where required), you receive a limited, personal, non-transferable, revocable license to use the official client software. You must not:</p>
      <ol>
        <li>Reverse engineer, decompile, deobfuscate, or otherwise attempt to derive source code, keys, APIs, or internal protection mechanisms of the Service, except to the limited extent such restriction is prohibited by law.</li>
        <li>Claim authorship of Greedy Hudzell, its modules, UI, or branding, or represent yourself as the creator, owner, or official maintainer unless you are the rights holder.</li>
        <li>Resell, sublicense, lease, or publicly redistribute paid builds, private keys, or non-public loaders without written permission.</li>
        <li>Advertise, solicit, or promote third-party services, sellers, or competing products inside official Greedy Hudzell / Rainware Discord channels, tickets, or related community spaces, unless staff explicitly allow it.</li>
        <li>Attempt to bypass key validation, impersonate staff, phishing, or disrupt infrastructure.</li>
        <li>Use the Service in any manner that causes disproportionate harm to other users or the Service (spam, abuse of APIs, etc.).</li>
      </ol>

      <h3>4. Keys &amp; access</h3>
      <p>
        Keys may be bound to a Roblox username, limited in duration, rate-limited, and revoked for abuse or ToS breaches.
        Access is not guaranteed after expiry, chargeback, or security incidents.
      </p>

      <h3>5. No warranty</h3>
      <p>
        We disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose,
        and non-infringement. We do not warrant that the Service will be uninterrupted, undetected, or free of errors,
        or that it will not result in enforcement actions by Roblox or other parties.
      </p>

      <h3>6. Limitation of liability</h3>
      <p>
        To the maximum extent permitted by law, we are not liable for lost accounts, lost progress, lost profits,
        data loss, device issues, or indirect damages arising from use of the Service or third-party executors.
      </p>

      <h3>7. Third-party links</h3>
      <p>
        Links to executors, alt services, games, or other sites are provided for convenience only.
        We do not control and are not responsible for third-party content, pricing, or practices.
      </p>

      <h3>8. Common sense</h3>
      <p>
        Act in good faith. Do not harass staff or users, do not spread malware under our name, and do not use the
        Service to attack others. Staff may refuse support or revoke access for behavior that undermines the community.
      </p>

      <h3>9. Changes</h3>
      <p>
        We may update these Terms at any time by posting a revised version on this page. Continued use after changes
        constitutes acceptance.
      </p>

      <h3>10. Contact</h3>
      <p>
        Official community: <a href="https://discord.gg/rainware" target="_blank" rel="noopener">discord.gg/rainware</a>.
      </p>
    </section>`;
  return layout("Terms of Service", "/tos", body);
}

async function fetchWeaoExecutors() {
  const res = await fetch("https://weao.xyz/api/status/exploits", {
    headers: {
      "User-Agent": "WEAO-3PService",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error("weao " + res.status);
  return res.json();
}

async function getStatus(env) {
  // Optional: bind KV/D1 as STATUS later for Discord bot writes
  try {
    if (env && env.SITE_STATUS) {
      const raw = await env.SITE_STATUS.get("public");
      if (raw) return JSON.parse(raw);
    }
  } catch (_) {}
  return { ...DEFAULT_STATUS, updated_at: new Date().toISOString() };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    try {
      if (path === "/api/status") {
        const status = await getStatus(env);
        return new Response(JSON.stringify(status, null, 2), {
          headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
        });
      }

      if (path === "/api/executors") {
        try {
          const data = await fetchWeaoExecutors();
          return new Response(JSON.stringify(data), {
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

      const status = await getStatus(env);
      const htmlHeaders = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      };

      if (path === "/" || path === "/index.html") {
        return new Response(pageHome(status), { headers: htmlHeaders });
      }
      if (path === "/status") {
        return new Response(pageStatus(status), { headers: htmlHeaders });
      }
      if (path === "/executors") {
        return new Response(pageExecutors(), { headers: htmlHeaders });
      }
      if (path === "/guide") {
        return new Response(pageGuide(), { headers: htmlHeaders });
      }
      if (path === "/tos" || path === "/terms") {
        return new Response(pageTos(), { headers: htmlHeaders });
      }

      // Let other paths fall through if you merge with key worker
      return new Response(pageHome(status), { headers: htmlHeaders });
    } catch (err) {
      return new Response("Internal error: " + (err.message || err), { status: 500 });
    }
  },
};
