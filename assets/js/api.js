/* ==========================================================================
   API layer.

   hcProxyFetch()  → calls the backend proxy (never calls DeyeCloud/Tuya/etc
                      directly from the browser — see /server and the README
                      for why: those APIs need signed requests with secrets
                      that must not live in client-side JS).

   hcDemoEnergy()  → deterministic-ish, time-of-day-shaped fake solar data,
                      used whenever mode is 'demo' or a live call fails.
   ========================================================================== */

async function hcProxyFetch(path, opts = {}) {
  const s = hcLoadSettings();
  if (!s.proxyUrl) {
    throw new Error('No proxy URL configured. Add one on the Connections page.');
  }
  const url = s.proxyUrl.replace(/\/+$/, '') + path;
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    s.proxyKey ? { 'x-proxy-key': s.proxyKey } : {},
    opts.headers || {}
  );

  let res;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (err) {
    throw new Error(`Could not reach proxy at ${s.proxyUrl} (${err.message}).`);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch (e) { /* noop */ }
    throw new Error(`Proxy responded ${res.status}${detail ? ': ' + detail : ''}`);
  }
  return res.json();
}

async function hcPingProxy() {
  const at = new Date().toISOString();
  try {
    await hcProxyFetch('/api/health');
    hcSaveSettings({ lastPing: { ok: true, at, message: 'Reachable' } });
    return { ok: true };
  } catch (err) {
    hcSaveSettings({ lastPing: { ok: false, at, message: err.message } });
    return { ok: false, message: err.message };
  }
}

/* ---------------------------- demo data ---------------------------- */

function hcSolarCurve(hour) {
  // Rough bell curve peaking near 12:30, zero before ~6am / after ~18:30.
  const peak = 12.5, width = 4.4;
  const v = Math.exp(-Math.pow(hour - peak, 2) / (2 * width * width));
  return Math.max(0, v);
}

function hcDemoEnergy() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const sysKwp = 8.4; // demo system size
  const pv = +(hcSolarCurve(hour) * sysKwp * (0.9 + Math.random() * 0.15)).toFixed(2);
  const load = +(1.1 + Math.random() * 0.9 + (hour > 18 || hour < 7 ? 0.6 : 0)).toFixed(2);
  const netToBattery = pv - load;
  const batterySoc = Math.max(18, Math.min(100, Math.round(62 + Math.sin(hour / 3) * 20 + (pv - load) * 2)));
  const gridPower = +(load - pv - Math.max(0, netToBattery * 0.4)).toFixed(2); // + = importing, - = exporting

  const history = [];
  for (let h = 0; h <= hour; h += 0.5) {
    history.push({ t: h, kw: +(hcSolarCurve(h) * sysKwp).toFixed(2) });
  }

  return {
    source: 'demo',
    pvPower: pv,
    loadPower: load,
    batteryPower: +netToBattery.toFixed(2),
    batterySoc,
    gridPower,
    todayKwh: +(history.reduce((a, p) => a + p.kw * 0.5, 0)).toFixed(1),
    monthKwh: +((history.reduce((a, p) => a + p.kw * 0.5, 0)) * 21.4).toFixed(0),
    totalKwh: 18240 + Math.round(hour * 4),
    history,
    stationName: 'Demo Station',
    updatedAt: now.toISOString()
  };
}

async function hcGetEnergy() {
  if (hcIsLive() && hcServiceEnabled('deye')) {
    try {
      return await hcProxyFetch('/api/deye/overview');
    } catch (err) {
      const demo = hcDemoEnergy();
      demo.error = err.message;
      return demo;
    }
  }
  return hcDemoEnergy();
}

async function hcSendDeviceCommand(device, patch) {
  const platform = window.HC_PLATFORMS[device.platform];
  if (platform.manual || hcGetMode() === 'demo' || !hcServiceEnabled(device.platform)) {
    // Local-only: either a manual/no-API platform, demo mode, or the
    // integration isn't enabled on the Connections page yet.
    return { ok: true, local: true };
  }
  try {
    await hcProxyFetch(`/api/${device.platform}/device/${encodeURIComponent(device.id)}/commands`, {
      method: 'POST',
      body: JSON.stringify(patch)
    });
    return { ok: true, local: false };
  } catch (err) {
    return { ok: false, local: false, message: err.message };
  }
}

/* ---------------------------- climate / sensors ---------------------------- */
// Demo-only for now. When you've picked a real source for these — Tuya or
// SmartThings temperature/humidity sensors, a ThinQ AC's ambient reading, a
// weather API for outdoor — wire it up as its own hcGetClimate() branch the
// same way hcGetEnergy() talks to DeyeCloud.

function hcSparklinePath(values, w, h, pad) {
  w = w || 56; h = h || 18; pad = pad || 2;
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const step = (w - pad * 2) / (values.length - 1);
  return values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
}

function hcTempSeries(base, amplitude, points) {
  points = points || 8;
  const arr = [];
  for (let i = 0; i < points; i++) {
    arr.push(+(base + Math.sin(i / 1.6) * amplitude + (Math.random() - 0.5) * 0.3).toFixed(1));
  }
  return arr;
}

function hcMinutesUntilNextClean() {
  const now = new Date();
  const scheduled = new Date(now);
  scheduled.setHours(15, 0, 0, 0); // demo: a 3:00pm daily schedule
  if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1);
  return Math.round((scheduled - now) / 60000);
}

function hcDemoClimate() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const outdoorBase = 21 + Math.sin((hour - 9) / 24 * 2 * Math.PI) * 6; // cool at night, warm mid-afternoon
  const outdoor = hcTempSeries(outdoorBase, 0.8);
  const living = hcTempSeries(23.5, 0.3);
  const parents = hcTempSeries(22.2, 0.25);
  const kids = hcTempSeries(23.0, 0.3);
  const water = hcTempSeries(48, 1.2);

  return {
    outdoor: { label: 'Outdoor', value: outdoor[outdoor.length - 1], trend: outdoor, icon: 'i-sun' },
    livingArea: { label: 'Living room', value: living[living.length - 1], trend: living, icon: 'i-house' },
    parentsBedroom: { label: "Parents' bedroom", value: parents[parents.length - 1], trend: parents, icon: 'i-house' },
    kidsBedroom: { label: "Kids' bedroom", value: kids[kids.length - 1], trend: kids, icon: 'i-house' },
    hotWater: { label: 'Hot water', value: water[water.length - 1], trend: water, icon: 'i-droplet' },
    vacuumMinutesToClean: hcMinutesUntilNextClean(),
    updatedAt: now.toISOString()
  };
}

async function hcGetClimate() {
  return hcDemoClimate();
}
