(function hcHouseControlPage() {
  let currentFloor = 1;
  let devices = hcLoadDevices();
  let editingId = null;

  const TYPE_ICON = { ac: 'i-snow', light: 'i-bulb', vacuum: 'i-vacuum', plug: 'i-outlet' };

  function persist() { hcSaveDevices(devices); }

  function roomsForFloor(floor) {
    const onFloor = devices.filter(d => d.floor === floor);
    const order = [];
    onFloor.forEach(d => { if (!order.includes(d.room)) order.push(d.room); });
    return order.map(room => ({ room, devices: onFloor.filter(d => d.room === room) }));
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
          <div style="min-width:0; flex:1;">
            <div class="dt-name">${d.name}</div>
            <div class="dt-room">${d.room}</div>
          </div>
          <span class="row-actions">
            <button data-action="edit" data-id="${d.id}" aria-label="Edit ${d.name}"><svg><use href="#i-edit"/></svg></button>
          </span>
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

    mount.innerHTML = groups.length ? groups.map(g => `
      <div class="room-title">${g.room} <span class="count">${g.devices.filter(d => d.state.on).length} / ${g.devices.length} on</span></div>
      <div class="device-grid">${g.devices.map(tileMarkup).join('')}</div>
    `).join('') : `<p class="muted" style="font-size:13px;">No devices on this floor yet — add one above.</p>`;

    document.getElementById('hc-demo-callout').classList.toggle('hidden', hcIsLive());
  }

  function findDevice(id) { return devices.find(d => d.id === id); }

  /* ---------------------------- toggle / temp ---------------------------- */

  async function handleToggle(id) {
    const d = findDevice(id);
    d.state.on = !d.state.on;
    persist();
    render(); // optimistic UI
    const result = await hcSendDeviceCommand(d, { on: d.state.on });
    if (!result.ok) {
      d.state.on = !d.state.on; // revert
      persist();
      render();
    } else {
      hcLogActivity(`${d.name} turned ${d.state.on ? 'on' : 'off'}`);
    }
  }

  async function handleTemp(id, delta) {
    const d = findDevice(id);
    if (!d.state.on) return;
    d.state.temp = Math.max(16, Math.min(30, d.state.temp + delta));
    persist();
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
    if (btn.dataset.action === 'edit') openForm(findDevice(id));
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
    const platforms = [...new Set(devices.map(d => d.platform))].filter(p => !window.HC_PLATFORMS[p].manual);
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
    persist();
    render();
    btn.disabled = false;
    btn.innerHTML = fail ? `<svg><use href="#i-close"/></svg>${fail} failed` : `<svg><use href="#i-check"/></svg>Synced`;
    setTimeout(() => { btn.innerHTML = original; }, 1600);
  });

  /* ---------------------------- add / edit device form ---------------------------- */

  const form = document.getElementById('device-form-panel');
  const fields = {
    name: document.getElementById('df-name'),
    floor: document.getElementById('df-floor'),
    room: document.getElementById('df-room'),
    type: document.getElementById('df-type'),
    platform: document.getElementById('df-platform'),
    id: document.getElementById('df-id'),
    on: document.getElementById('df-on'),
    temp: document.getElementById('df-temp'),
    brightness: document.getElementById('df-brightness')
  };

  function refreshExtraFields() {
    const type = fields.type.value;
    document.getElementById('df-temp-field').classList.toggle('hidden', type !== 'ac');
    document.getElementById('df-brightness-field').classList.toggle('hidden', type !== 'light');
  }
  fields.type.addEventListener('change', refreshExtraFields);

  function openForm(d) {
    editingId = d ? d.id : null;
    document.getElementById('df-title').textContent = d ? 'Edit device' : 'Add device';
    document.getElementById('df-delete').classList.toggle('hidden', !d);

    document.getElementById('df-room-options').innerHTML =
      [...new Set(devices.map(x => x.room))].map(r => `<option value="${r}">`).join('');

    fields.name.value = d ? d.name : '';
    fields.floor.value = d ? d.floor : currentFloor;
    fields.room.value = d ? d.room : '';
    fields.type.value = d ? d.type : 'light';
    fields.platform.value = d ? d.platform : 'tuya';
    fields.id.value = d ? d.id : '';
    fields.on.value = d ? String(!!d.state.on) : 'false';
    fields.temp.value = d && d.state.temp !== undefined ? d.state.temp : 23;
    fields.brightness.value = d && d.state.brightness !== undefined ? d.state.brightness : 80;

    refreshExtraFields();
    form.classList.remove('hidden');
    fields.name.focus();
  }

  function closeForm() {
    form.classList.add('hidden');
    editingId = null;
  }

  document.getElementById('hc-add-btn').addEventListener('click', () => openForm(null));
  document.getElementById('df-cancel').addEventListener('click', closeForm);

  document.getElementById('df-save').addEventListener('click', () => {
    const name = fields.name.value.trim();
    const room = fields.room.value.trim();
    if (!name || !room) { (name ? fields.room : fields.name).focus(); return; }

    const type = fields.type.value;
    const state = { on: fields.on.value === 'true' };
    if (type === 'ac') state.temp = Number(fields.temp.value) || 23;
    if (type === 'light') state.brightness = Number(fields.brightness.value) || 80;

    const customId = fields.id.value.trim();
    const patch = { name, room, floor: Number(fields.floor.value), type, platform: fields.platform.value, state };

    if (editingId) {
      const d = findDevice(editingId);
      if (customId && customId !== d.id) d.id = customId; // rename in place, refs are by object not by stale id
      Object.assign(d, patch);
      hcLogActivity(`Updated ${name} in House Control`);
    } else {
      devices.push({ id: customId || ('d' + Date.now()), ...patch });
      hcLogActivity(`Added ${name} to House Control`);
    }
    persist();
    closeForm();
    currentFloor = patch.floor;
    document.querySelectorAll('#floor-tabs .seg-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.floor) === currentFloor));
    render();
  });

  document.getElementById('df-delete').addEventListener('click', () => {
    if (!editingId) return;
    const d = findDevice(editingId);
    if (!window.confirm(`Remove "${d ? d.name : 'this device'}" from House Control?`)) return;
    devices = devices.filter(x => x.id !== editingId);
    persist();
    if (d) hcLogActivity(`Removed ${d.name} from House Control`);
    closeForm();
    render();
  });

  render();
})();
