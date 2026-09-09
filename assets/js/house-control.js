(function hcHouseControlPage() {
  let currentFloor = 1;

  const TYPE_ICON = { ac: 'i-snow', light: 'i-bulb', vacuum: 'i-vacuum', plug: 'i-outlet' };

  function roomsForFloor(floor) {
    const devices = window.HC_DEVICES.filter(d => d.floor === floor);
    const order = [];
    devices.forEach(d => { if (!order.includes(d.room)) order.push(d.room); });
    return order.map(room => ({ room, devices: devices.filter(d => d.room === room) }));
  }

  function tileMarkup(d) {
    const platform = window.HC_PLATFORMS[d.platform];
    const on = !!d.state.on;
    const icon = TYPE_ICON[d.type] || 'i-outlet';
    const stepper = d.type === 'ac'
      ? `<div class="dt-stepper">
           <button data-action="temp-dn" data-id="${d.id}">−</button>
           <span data-temp-val>${d.state.temp}°</span>
           <button data-action="temp-up" data-id="${d.id}">+</button>
         </div>`
      : '';
    const note = platform.manual
      ? `<div class="dt-note"><svg><use href="#i-info"/></svg>${platform.note}</div>`
      : '';
    return `
      <div class="device-tile ${on ? 'on' : ''}" style="--accent:${platform.color}" data-id="${d.id}">
        <div class="dt-head">
          <div class="dt-icon"><svg><use href="#${icon}"/></svg></div>
          <div style="min-width:0;">
            <div class="dt-name">${d.name}</div>
            <div class="dt-room">${d.room}</div>
          </div>
        </div>
        <div class="dt-controls">
          <span class="badge"><span class="dot" style="background:${platform.color}"></span>${platform.label}${platform.manual ? ' (no API)' : ''}</span>
          <button class="switch ${on ? 'on' : ''}" data-action="toggle" data-id="${d.id}" aria-label="Toggle ${d.name}"></button>
        </div>
        ${stepper}
        ${note}
      </div>`;
  }

  function render() {
    const mount = document.getElementById('rooms-mount');
    const groups = roomsForFloor(currentFloor);
    const totalDevices = groups.reduce((n, g) => n + g.devices.length, 0);
    document.getElementById('hc-sub').textContent =
      `${totalDevices} device${totalDevices === 1 ? '' : 's'} across ${groups.length} room${groups.length === 1 ? '' : 's'} on this floor`;

    mount.innerHTML = groups.map(g => `
      <div class="room-title">${g.room} <span class="count">${g.devices.filter(d => d.state.on).length} / ${g.devices.length} on</span></div>
      <div class="device-grid">${g.devices.map(tileMarkup).join('')}</div>
    `).join('');

    document.getElementById('hc-demo-callout').classList.toggle('hidden', hcIsLive());
  }

  function findDevice(id) { return window.HC_DEVICES.find(d => d.id === id); }

  async function handleToggle(id) {
    const d = findDevice(id);
    d.state.on = !d.state.on;
    render(); // optimistic UI
    const result = await hcSendDeviceCommand(d, { on: d.state.on });
    if (!result.ok) {
      d.state.on = !d.state.on; // revert
      render();
    } else {
      hcLogActivity(`${d.name} turned ${d.state.on ? 'on' : 'off'}`);
    }
  }

  async function handleTemp(id, delta) {
    const d = findDevice(id);
    if (!d.state.on) return;
    d.state.temp = Math.max(16, Math.min(30, d.state.temp + delta));
    render();
    await hcSendDeviceCommand(d, { temp: d.state.temp });
    hcLogActivity(`${d.name} set to ${d.state.temp}°`);
  }

  document.getElementById('rooms-mount').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'toggle') handleToggle(id);
    if (btn.dataset.action === 'temp-up') handleTemp(id, 1);
    if (btn.dataset.action === 'temp-dn') handleTemp(id, -1);
  });

  document.getElementById('floor-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    currentFloor = Number(btn.dataset.floor);
    document.querySelectorAll('#floor-tabs .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    render();
  });

  document.getElementById('hc-sync').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    if (!hcIsLive()) {
      btn.innerHTML = `<svg><use href="#i-check"/></svg>Demo — nothing to sync`;
      setTimeout(() => { btn.innerHTML = original; }, 1400);
      return;
    }
    btn.disabled = true;
    const platforms = [...new Set(window.HC_DEVICES.map(d => d.platform))].filter(p => !window.HC_PLATFORMS[p].manual);
    let ok = 0, fail = 0;
    for (const platform of platforms) {
      if (!hcServiceEnabled(platform)) continue;
      try {
        const list = await hcProxyFetch(`/api/${platform}/devices`);
        (list.devices || []).forEach(remote => {
          const local = findDevice(remote.id);
          if (local) Object.assign(local.state, remote.state);
        });
        ok++;
      } catch (err) { fail++; }
    }
    render();
    btn.disabled = false;
    btn.innerHTML = fail ? `<svg><use href="#i-close"/></svg>${fail} failed` : `<svg><use href="#i-check"/></svg>Synced`;
    setTimeout(() => { btn.innerHTML = original; }, 1600);
  });

  render();
})();
