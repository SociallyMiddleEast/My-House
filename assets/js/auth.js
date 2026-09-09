/* ==========================================================================
   Login gate. Read the big caveat once, seriously: this check happens
   entirely in this file, in the browser. Anyone with dev tools can read
   the stored password hash or just skip the check. It's a privacy screen —
   enough to stop a family member from casually opening the dashboard — not
   protection against anyone who knows how to open a console. The real
   protections (DeyeCloud/Tuya secrets, the proxy's PROXY_API_KEY, your
   Google account's own permissions) are untouched by this either way.

   The gate only activates once a username/password has been set up on the
   Settings page. Until then every page behaves exactly as before.
   ========================================================================== */

const HC_AUTH_KEY = 'hc_auth_v1';
const HC_SESSION_KEY = 'hc_session_ok';

async function hcHashPassword(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hcAuthSettings() {
  try { return JSON.parse(localStorage.getItem(HC_AUTH_KEY) || 'null'); }
  catch (e) { return null; }
}

function hcAuthEnabled() {
  const a = hcAuthSettings();
  return !!(a && a.enabled);
}

function hcIsLoggedIn() {
  return sessionStorage.getItem(HC_SESSION_KEY) === '1' || localStorage.getItem(HC_SESSION_KEY) === '1';
}

async function hcSetupAuth(username, password) {
  const passwordHash = await hcHashPassword(password);
  localStorage.setItem(HC_AUTH_KEY, JSON.stringify({ enabled: true, username, passwordHash }));
}

function hcDisableAuth() {
  localStorage.removeItem(HC_AUTH_KEY);
  sessionStorage.removeItem(HC_SESSION_KEY);
  localStorage.removeItem(HC_SESSION_KEY);
}

function hcLogout() {
  sessionStorage.removeItem(HC_SESSION_KEY);
  localStorage.removeItem(HC_SESSION_KEY);
  location.reload();
}

function hcShowLoginOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'auth-overlay';
  overlay.innerHTML = `
    <form class="panel auth-card" id="hc-auth-form">
      <div class="brand" style="padding:0 0 18px;">
        <svg><use href="#i-bolt"/></svg>
        <div>
          <div class="brand-name">Home Control</div>
          <div class="brand-sub">sign in</div>
        </div>
      </div>
      <label class="field">
        <span class="lbl">Username</span>
        <input class="input" id="auth-username" autocomplete="username">
      </label>
      <label class="field">
        <span class="lbl">Password</span>
        <input class="input" type="password" id="auth-password" autocomplete="current-password">
      </label>
      <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-muted); margin-bottom:16px;">
        <input type="checkbox" id="auth-remember"> Remember me on this device
      </label>
      <div id="auth-error" class="hidden" style="color:var(--bad); font-size:12px; margin-bottom:12px;"></div>
      <button type="submit" class="btn primary" style="width:100%; justify-content:center;">Sign in</button>
      <p class="muted" style="font-size:11px; margin-top:16px; line-height:1.5;">
        Forgot it? This can't be reset from here — open dev tools (F12) → Console, run
        <code style="font-family:var(--font-mono);">localStorage.removeItem('hc_auth_v1')</code>, then refresh.
      </p>
    </form>`;
  document.body.appendChild(overlay);

  const form = document.getElementById('hc-auth-form');
  const errorEl = document.getElementById('auth-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = hcAuthSettings();
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value;
    const hash = await hcHashPassword(p);
    if (a && u === a.username && hash === a.passwordHash) {
      sessionStorage.setItem(HC_SESSION_KEY, '1');
      if (document.getElementById('auth-remember').checked) localStorage.setItem(HC_SESSION_KEY, '1');
      document.documentElement.removeAttribute('data-authgate');
      overlay.remove();
    } else {
      errorEl.textContent = 'Wrong username or password.';
      errorEl.classList.remove('hidden');
    }
  });

  document.getElementById('auth-username').focus();
}

(function hcAuthInit() {
  if (document.documentElement.getAttribute('data-authgate') === 'locked') {
    hcShowLoginOverlay();
  }
})();
