(function hcSettingsPage() {

  /* ============================== Account ============================== */

  function renderAccount() {
    const enabled = hcAuthEnabled();
    const statusEl = document.getElementById('auth-current-status');
    const loggedIn = hcIsLoggedIn();
    statusEl.innerHTML = enabled
      ? `<span class="dot ${loggedIn ? 'good' : 'neutral'}"></span>Login is on${loggedIn ? ' — you are signed in' : ''}`
      : `<span class="dot neutral"></span>Login is off — every page is open`;
    document.getElementById('acc-disable').classList.toggle('hidden', !enabled);
    document.getElementById('acc-logout').classList.toggle('hidden', !loggedIn);
    document.getElementById('acc-save').textContent = enabled ? 'Update login' : 'Set up login';
    if (enabled) {
      const a = hcAuthSettings();
      document.getElementById('acc-username').value = a.username;
    }
  }

  document.getElementById('acc-save').addEventListener('click', async () => {
    const u = document.getElementById('acc-username').value.trim();
    const p = document.getElementById('acc-password').value;
    if (!u || !p) return;
    await hcSetupAuth(u, p);
    sessionStorage.setItem(HC_SESSION_KEY, '1'); // don't lock yourself out mid-setup
    document.getElementById('acc-password').value = '';
    renderAccount();
  });

  document.getElementById('acc-disable').addEventListener('click', () => {
    if (!window.confirm('Turn off login? Every page becomes open to anyone with the URL.')) return;
    hcDisableAuth();
    renderAccount();
  });

  document.getElementById('acc-logout').addEventListener('click', () => hcLogout());

  renderAccount();

  /* ============================== Data source + Integrations ============================== */

  const INTEGRATIONS = [
    { key: 'deye', label: 'DeyeCloud', color: '#E8A33D', manual: false,
      desc: 'Solar inverter monitoring — PV power, battery SOC, grid flow, and generation history for the Energy page.',
      link: 'https://github.com/DeyeCloudDevelopers/deye-openapi-client-sample-code', linkLabel: 'DeyeCloud API sample code & docs' },
    { key: 'tuya', label: 'Tuya', color: '#E8A33D', manual: false,
      desc: 'Lights, plugs, and other Tuya-linked devices in House Control.',
      link: 'https://iot.tuya.com', linkLabel: 'Tuya IoT Platform' },
    { key: 'lg', label: 'LG ThinQ', color: '#E2604A', manual: false,
      desc: 'LG air conditioners and appliances in House Control.',
      link: 'https://smartsolution.developer.lge.com', linkLabel: 'LG Smart Solution API' },
    { key: 'smartthings', label: 'SmartThings', color: '#4FA6E8', manual: false,
      desc: 'Any device linked through a SmartThings account.',
      link: 'https://developer.smartthings.com', linkLabel: 'SmartThings developer docs' },
    { key: 'philips', label: 'Philips Coolhome', color: '#2E93A6', manual: true,
      desc: 'Philips-branded air conditioners. Coolhome has no public developer API, so these tiles stay local — set them from the Coolhome app and mirror the state here if you want it reflected.' },
    { key: 'eureka', label: 'Eureka', color: '#8862D6', manual: true,
      desc: 'Eureka robot vacuums. Eureka has no public developer API, so this tile stays local — set it from the eureka robot app.' }
  ];

  function cardMarkup(i, settings) {
    const control = i.manual
      ? `<span class="muted" style="font-size:12px; white-space:nowrap;">shown for reference</span>`
      : `<button class="switch teal ${settings.services[i.key] ? 'on' : ''}" data-service="${i.key}" aria-label="Enable ${i.label}"></button>`;
    return `
      <div class="panel" style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
            <span class="dot" style="background:${i.color}"></span>
            <strong style="font-size:14px;">${i.label}</strong>
            ${i.manual ? '<span class="badge">no public API</span>' : ''}
          </div>
          <div class="muted" style="font-size:13px; max-width:540px;">${i.desc}</div>
          ${i.link ? `<a href="${i.link}" target="_blank" rel="noopener" style="font-size:12px; color:var(--teal); display:inline-block; margin-top:7px; text-decoration:underline;">${i.linkLabel}</a>` : ''}
        </div>
        ${control}
      </div>`;
  }

  function renderDataSource() {
    const s = hcLoadSettings();
    document.querySelectorAll('#mode-tabs .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === s.mode));
    document.getElementById('proxy-url').value = s.proxyUrl;
    document.getElementById('proxy-key').value = s.proxyKey;
    document.getElementById('integrations-mount').innerHTML = INTEGRATIONS.map(i => cardMarkup(i, s)).join('');
  }

  function refreshSidebar() {
    const mount = document.getElementById('sidebar-mount');
    if (mount) mount.innerHTML = hcRenderSidebar('settings');
  }

  function currentFormValues() {
    const activeMode = document.querySelector('#mode-tabs .seg-btn.active').dataset.mode;
    return {
      mode: activeMode,
      proxyUrl: document.getElementById('proxy-url').value.trim(),
      proxyKey: document.getElementById('proxy-key').value.trim()
    };
  }

  document.getElementById('mode-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    document.querySelectorAll('#mode-tabs .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
  });

  document.getElementById('integrations-mount').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-service]');
    if (!btn) return;
    const key = btn.dataset.service;
    const s = hcLoadSettings();
    const next = !s.services[key];
    hcSaveSettings({ services: { [key]: next } });
    btn.classList.toggle('on', next);
    refreshSidebar();
  });

  document.getElementById('conn-save').addEventListener('click', () => {
    hcSaveSettings(currentFormValues());
    refreshSidebar();
    const btn = document.getElementById('conn-save');
    const original = btn.innerHTML;
    btn.innerHTML = `<svg><use href="#i-check"/></svg>Saved`;
    setTimeout(() => { btn.innerHTML = original; }, 1300);
  });

  document.getElementById('conn-test').addEventListener('click', async () => {
    hcSaveSettings(currentFormValues());
    const pill = document.getElementById('conn-test-result');
    pill.classList.remove('hidden');
    pill.innerHTML = `<span class="dot"></span>Testing…`;
    const result = await hcPingProxy();
    pill.innerHTML = result.ok
      ? `<span class="dot good"></span>Reachable`
      : `<span class="dot bad"></span>${result.message}`;
    refreshSidebar();
  });

  renderDataSource();

  /* ============================== Google Sheets ============================== */

  const shStatus = document.getElementById('sh-status');
  function setSheetStatus(kind, message) {
    shStatus.classList.remove('hidden');
    const dotClass = kind === 'ok' ? 'good' : kind === 'error' ? 'bad' : 'neutral';
    shStatus.innerHTML = `<span class="dot ${dotClass}"></span>${message}`;
  }

  document.getElementById('sh-client-id').value = hcLoadSheetSettings().clientId || '';
  document.getElementById('sh-sheet-id').value = hcLoadSheetSettings().sheetId || '';
  if (hcSheetsConfigured()) setSheetStatus('idle', 'Saved — click Connect Google to verify');

  document.getElementById('sh-save').addEventListener('click', () => {
    hcSaveSheetSettings({
      clientId: document.getElementById('sh-client-id').value.trim(),
      sheetId: document.getElementById('sh-sheet-id').value.trim()
    });
    setSheetStatus('idle', 'Saved — click Connect Google');
  });

  document.getElementById('sh-connect').addEventListener('click', () => {
    setSheetStatus('busy', 'Connecting…');
    hcConnectGoogle((err) => {
      if (err) { setSheetStatus('error', typeof err === 'string' ? err : 'Connection failed'); return; }
      setSheetStatus('ok', 'Connected — Pantry and Expenses will sync next time you open them');
    });
  });

  /* ============================== Custom gauges ============================== */

  document.getElementById('gf-icon-picker').innerHTML = HC_GAUGE_ICONS.map((icon, i) => `
    <label style="cursor:pointer;">
      <input type="radio" name="gf-icon" value="${icon}" ${i === 0 ? 'checked' : ''} style="display:none;">
      <span class="icon-swatch">
        <svg><use href="#${icon}"/></svg>
      </span>
    </label>`).join('');

  document.getElementById('gf-color-picker').innerHTML = HC_GAUGE_COLORS.map((c, i) => `
    <label style="cursor:pointer;" title="${c.label}">
      <input type="radio" name="gf-color" value="${c.value}" ${i === 0 ? 'checked' : ''} style="display:none;">
      <span style="display:block; width:26px; height:26px; border-radius:6px; background:${c.value}; border:1px solid var(--line);"></span>
    </label>`).join('');

  // Highlight the checked icon/color swatch
  function wireSwatchHighlight(pickerId, inputName) {
    const picker = document.getElementById(pickerId);
    function refresh() {
      picker.querySelectorAll('label').forEach(l => {
        const checked = l.querySelector('input').checked;
        l.style.outline = checked ? '2px solid var(--indigo)' : 'none';
        l.style.borderRadius = '8px';
      });
    }
    picker.addEventListener('change', refresh);
    refresh();
  }
  wireSwatchHighlight('gf-icon-picker', 'gf-icon');
  wireSwatchHighlight('gf-color-picker', 'gf-color');

  function renderGauges() {
    const list = hcLoadGauges();
    const mount = document.getElementById('gauge-list-mount');
    if (!list.length) {
      mount.innerHTML = `<p class="muted" style="font-size:13px;">No custom gauges yet.</p>`;
      return;
    }
    mount.innerHTML = list.map(g => `
      <div class="pantry-row" data-id="${g.id}">
        <span class="dot" style="background:${g.color}"></span>
        <span class="name"><svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;"><use href="#${g.icon}"/></svg>${g.label}</span>
        <span class="badge">${g.section === 'climate' ? 'Climate' : 'Utilities'}</span>
        <span class="qty-stepper">
          <input class="input" type="number" step="0.1" value="${g.value}" data-gauge-value style="width:70px; text-align:right;">
          <span class="muted">${g.unit || ''}</span>
        </span>
        <span class="row-actions">
          <button data-action="save" aria-label="Save"><svg><use href="#i-check"/></svg></button>
          <button data-action="delete" aria-label="Delete"><svg><use href="#i-close"/></svg></button>
        </span>
      </div>`).join('');
  }

  document.getElementById('gauge-list-mount').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const row = btn.closest('[data-id]');
    const id = row.dataset.id;
    if (btn.dataset.action === 'save') {
      const value = Number(row.querySelector('[data-gauge-value]').value) || 0;
      hcUpdateGauge(id, { value });
      const original = btn.innerHTML;
      btn.style.color = 'var(--good)';
      setTimeout(() => { btn.style.color = ''; }, 900);
    } else if (btn.dataset.action === 'delete') {
      if (!window.confirm('Remove this gauge?')) return;
      hcDeleteGauge(id);
      renderGauges();
    }
  });

  document.getElementById('gf-add').addEventListener('click', () => {
    const label = document.getElementById('gf-label').value.trim();
    if (!label) { document.getElementById('gf-label').focus(); return; }
    hcAddGauge({
      label,
      unit: document.getElementById('gf-unit').value.trim(),
      value: Number(document.getElementById('gf-value').value) || 0,
      section: document.getElementById('gf-section').value,
      icon: document.querySelector('input[name="gf-icon"]:checked').value,
      color: document.querySelector('input[name="gf-color"]:checked').value,
      showBar: document.getElementById('gf-showbar').checked
    });
    document.getElementById('gf-label').value = '';
    document.getElementById('gf-unit').value = '';
    document.getElementById('gf-value').value = 0;
    renderGauges();
  });

  renderGauges();
})();
