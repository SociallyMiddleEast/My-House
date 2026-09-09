<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Connections — Home Control</title>
<script>(function(){try{var s=JSON.parse(localStorage.getItem('hc_settings_v1')||'{}');var t=s.theme||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();</script>
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body data-page="connections">
<div class="shell" id="shell">
  <aside class="sidebar" id="sidebar-mount"></aside>
  <main class="main">
    <div class="topbar" id="topbar-mount"></div>

    <div class="page-head">
      <div>
        <h1>Connections</h1>
        <div class="sub">This site never stores API secrets — only the backend proxy does.</div>
      </div>
    </div>

    <div class="callout" style="margin-bottom:22px">
      DeyeCloud, Tuya, LG ThinQ, and SmartThings all require a signed, secret-holding request to fetch data or send commands — something a public GitHub Pages site cannot safely do on its own. This dashboard instead talks to a small backend proxy you deploy yourself (see <code>/server</code> in the project — Render, Railway, and Fly.io all have free tiers). The proxy holds your real API keys as environment variables; the browser only ever knows the proxy's URL.
    </div>

    <div class="section-title">Data source</div>
    <div class="panel">
      <label class="field">
        <span class="lbl">Mode</span>
        <div class="seg" id="mode-tabs">
          <button class="seg-btn" data-mode="demo">Demo data</button>
          <button class="seg-btn" data-mode="live">Live proxy</button>
        </div>
      </label>

      <label class="field">
        <span class="lbl">Proxy base URL</span>
        <input class="input" id="proxy-url" placeholder="https://your-proxy.onrender.com">
        <span class="hint">The deployed URL of the /server app in this project.</span>
      </label>

      <label class="field">
        <span class="lbl">Proxy access key <span class="muted" style="font-family:var(--font-body)">(optional but recommended)</span></span>
        <input class="input" id="proxy-key" placeholder="matches PROXY_API_KEY on the server">
        <span class="hint">Sent as the x-proxy-key header, so the proxy — which can control real devices — isn't open to the public internet.</span>
      </label>

      <div style="display:flex; gap:10px; align-items:center; margin-top:4px;">
        <button class="btn primary" id="conn-save"><svg><use href="#i-check"/></svg>Save</button>
        <button class="btn" id="conn-test"><svg><use href="#i-refresh"/></svg>Test connection</button>
        <span id="conn-test-result" class="status-pill hidden"></span>
      </div>
    </div>

    <div class="section-title">Integrations</div>
    <div style="display:flex; flex-direction:column; gap:10px;" id="integrations-mount"></div>

  </main>
</div>

<script src="assets/js/config.js"></script>
<script src="assets/js/api.js"></script>
<script src="assets/js/devices.js"></script>
<script src="assets/js/nav.js"></script>
<script src="assets/js/connections.js"></script>
</body>
</html>
