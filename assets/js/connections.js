(function hcConnectionsPage() {

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
    { key: 'philips', label: 'Philips Coolhome', color: '#8FD0E0', manual: true,
      desc: 'Philips-branded air conditioners. Coolhome has no public developer API, so these tiles stay local — set them from the Coolhome app and mirror the state here if you want it reflected.' },
    { key: 'eureka', label: 'Eureka', color: '#B48FE8', manual: true,
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

  function render() {
    const s = hcLoadSettings();
    document.querySelectorAll('#mode-tabs .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === s.mode));
    document.getElementById('proxy-url').value = s.proxyUrl;
    document.getElementById('proxy-key').value = s.proxyKey;
    document.getElementById('integrations-mount').innerHTML = INTEGRATIONS.map(i => cardMarkup(i, s)).join('');
  }

  function refreshSidebar() {
    const mount = document.getElementById('sidebar-mount');
    if (mount) mount.innerHTML = hcRenderSidebar('connections');
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

  render();
})();
