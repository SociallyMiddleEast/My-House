/* ==========================================================================
   Injects the icon sprite + sidebar/topbar shell into every page.
   Each page just needs: <body data-page="energy"> ... <aside id="sidebar-mount">
   and <div id="topbar-mount"> in place, and to include this script.
   ========================================================================== */

const HC_ICON_SPRITE = `
<svg style="display:none" xmlns="http://www.w3.org/2000/svg">
<defs>
<symbol id="i-bolt" viewBox="0 0 24 24"><polygon points="13,2 4,14 11,14 9,22 20,9 12,9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></symbol>
<symbol id="i-layout" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol>
<symbol id="i-house" viewBox="0 0 24 24"><path d="M4 12 L12 4.5 L20 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 10.5 V19.5 H17.5 V10.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="10" y="14.5" width="4" height="5" fill="none" stroke="currentColor" stroke-width="1.4"/></symbol>
<symbol id="i-plug" viewBox="0 0 24 24"><line x1="9" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="15" y1="3" x2="15" y2="9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6 9h12v3a6 6 0 0 1-12 0V9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="19.2" y1="12" x2="21.4" y2="12"/><line x1="17.2" y1="17.2" x2="18.7" y2="18.7"/><line x1="12" y1="19.2" x2="12" y2="21.4"/><line x1="6.8" y1="17.2" x2="5.3" y2="18.7"/><line x1="4.8" y1="12" x2="2.6" y2="12"/><line x1="6.8" y1="6.8" x2="5.3" y2="5.3"/><line x1="12" y1="4.8" x2="12" y2="2.6"/><line x1="17.2" y1="6.8" x2="18.7" y2="5.3"/></g></symbol>
<symbol id="i-battery" viewBox="0 0 24 24"><rect x="2.5" y="7" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="20" y="10" width="2" height="4" rx="0.6" fill="currentColor"/></symbol>
<symbol id="i-tower" viewBox="0 0 24 24"><path d="M12 3 L6.5 21 M12 3 L17.5 21 M8.4 12.5h7.2 M9.7 8h4.6 M7.2 17h9.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></symbol>
<symbol id="i-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><polyline points="4 12 9.5 17.5 20 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><polyline points="18 3 18 7 14 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><polyline points="6 21 6 17 10 17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-snow" viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="4" x2="12" y2="20"/><line x1="5.1" y1="7.8" x2="18.9" y2="16.2"/><line x1="5.1" y1="16.2" x2="18.9" y2="7.8"/></g></symbol>
<symbol id="i-bulb" viewBox="0 0 24 24"><circle cx="12" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="9.6" y1="18.5" x2="14.4" y2="18.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="10.2" y1="15.3" x2="10.2" y2="18.5" stroke="currentColor" stroke-width="1.4"/><line x1="13.8" y1="15.3" x2="13.8" y2="18.5" stroke="currentColor" stroke-width="1.4"/></symbol>
<symbol id="i-vacuum" viewBox="0 0 24 24"><circle cx="12" cy="12.5" r="8.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12.5" r="2.2" fill="currentColor"/><line x1="12" y1="4.3" x2="12" y2="6.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></symbol>
<symbol id="i-outlet" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="14" y1="9" x2="14" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10 15.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.4"/></symbol>
<symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.2 2.4"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="11" x2="12" y2="16.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="7.8" r="1.05" fill="currentColor"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M19.5 14.2A8 8 0 1 1 10.8 4.6a6.4 6.4 0 0 0 8.7 9.6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></symbol>
<symbol id="i-droplet" viewBox="0 0 24 24"><path d="M12 3.4C9.2 7.6 6.6 11.1 6.6 14.3a5.4 5.4 0 0 0 10.8 0C17.4 11.1 14.8 7.6 12 3.4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></symbol>
<symbol id="i-cloud" viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 0 0 .5-7.97 5.5 5.5 0 0 0-10.6 1.5A3.5 3.5 0 0 0 7 18z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></symbol>
<symbol id="i-generator" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><polygon points="13,9.3 9.3,14.2 11.8,14.2 10.8,17.7 14.9,13 12.1,13" fill="currentColor"/></symbol>
<symbol id="i-away" viewBox="0 0 24 24"><path d="M9 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M13 8.2l3.8 3.8-3.8 3.8M16.6 12H9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-gas" viewBox="0 0 24 24"><rect x="7" y="9" width="10" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9.5 9V6.5a2.5 2.5 0 0 1 5 0V9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="10.3" y1="4.3" x2="13.7" y2="4.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
<symbol id="i-barrel" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="5" y1="9.3" x2="19" y2="9.3" stroke="currentColor" stroke-width="1.4"/><line x1="5" y1="14.7" x2="19" y2="14.7" stroke="currentColor" stroke-width="1.4"/></symbol>
</defs>
</svg>`;

const HC_NAV_ITEMS = [
  { id: 'overview',      href: 'index.html',          label: 'Overview',       icon: 'i-layout' },
  { id: 'energy',        href: 'energy.html',         label: 'Energy',         icon: 'i-bolt',  accent: 'amber' },
  { id: 'house-control', href: 'house-control.html',  label: 'House control',  icon: 'i-house', accent: 'teal' },
  { id: 'connections',   href: 'connections.html',    label: 'Connections',    icon: 'i-plug' }
];

function hcCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function hcSetTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  hcSaveSettings({ theme });
  document.querySelectorAll('.theme-toggle use').forEach(el => el.setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon'));
  document.querySelectorAll('.theme-toggle').forEach(btn => btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`));
}

function hcToggleTheme() { hcSetTheme(hcCurrentTheme() === 'dark' ? 'light' : 'dark'); }

function hcThemeToggleMarkup(id) {
  const theme = hcCurrentTheme();
  return `<button class="theme-toggle" id="${id}" aria-label="Switch to ${theme === 'dark' ? 'light' : 'dark'} theme">
    <svg><use href="#${theme === 'dark' ? 'i-sun' : 'i-moon'}"/></svg>
  </button>`;
}

function hcRenderSidebar(active) {
  const items = HC_NAV_ITEMS.map(item => {
    const isActive = item.id === active;
    const cls = ['nav-item'];
    if (isActive) { cls.push('active'); if (item.accent === 'teal') cls.push('teal'); }
    return `<a class="${cls.join(' ')}" href="${item.href}"><svg><use href="#${item.icon}"/></svg>${item.label}</a>`;
  }).join('');

  const live = hcIsLive();
  const ping = hcLoadSettings().lastPing;
  let dotClass = 'neutral', label = 'Demo data';
  if (live) {
    if (ping && ping.ok) { dotClass = 'good'; label = 'Live — proxy connected'; }
    else if (ping && !ping.ok) { dotClass = 'bad'; label = 'Live — proxy unreachable'; }
    else { label = 'Live — not tested yet'; }
  }

  return `
    <div class="brand">
      <svg><use href="#i-bolt"/></svg>
      <div>
        <div class="brand-name">Home Control</div>
        <div class="brand-sub">energy &amp; devices</div>
      </div>
    </div>
    <nav class="nav">${items}</nav>
    <div class="sidebar-foot">
      <div class="grid-chip"><span class="dot ${dotClass}"></span>${label}</div>
      ${hcThemeToggleMarkup('theme-toggle-desktop')}
    </div>`;
}

function hcRenderTopbar(active) {
  const current = HC_NAV_ITEMS.find(i => i.id === active);
  return `
    <button class="topbar-toggle" id="hc-nav-toggle" aria-label="Open navigation">
      <svg><use href="#i-menu"/></svg>
    </button>
    <div class="brand-name" style="font-size:14px">${current ? current.label : 'Home Control'}</div>
    ${hcThemeToggleMarkup('theme-toggle-mobile')}`;
}

(function hcInitShell() {
  document.body.insertAdjacentHTML('afterbegin', HC_ICON_SPRITE);

  if (!document.documentElement.getAttribute('data-theme')) {
    const stored = hcLoadSettings().theme;
    const fallback = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', stored || fallback);
  }

  const active = document.body.dataset.page || 'overview';
  const sidebarMount = document.getElementById('sidebar-mount');
  const topbarMount = document.getElementById('topbar-mount');
  if (sidebarMount) sidebarMount.innerHTML = hcRenderSidebar(active);
  if (topbarMount) topbarMount.innerHTML = hcRenderTopbar(active);

  document.querySelectorAll('.theme-toggle').forEach(btn => btn.addEventListener('click', hcToggleTheme));

  const toggle = document.getElementById('hc-nav-toggle');
  const shell = document.getElementById('shell');
  if (toggle && shell) {
    toggle.addEventListener('click', () => {
      const open = shell.classList.toggle('nav-open');
      toggle.innerHTML = `<svg><use href="#${open ? 'i-close' : 'i-menu'}"/></svg>`;
    });
    shell.addEventListener('click', (e) => {
      if (shell.classList.contains('nav-open') && e.target === shell) {
        shell.classList.remove('nav-open');
        toggle.innerHTML = `<svg><use href="#i-menu"/></svg>`;
      }
    });
  }
})();
