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

/* ---------------------------- weather (real, no key needed) ---------------------------- */
// Open-Meteo is free, keyless, and CORS-enabled, so this calls it straight
// from the browser — no proxy needed, unlike everything else on this site.
// Coordinates default to Beirut; change them if the house is elsewhere.

const HC_WEATHER_LAT = 33.8938;
const HC_WEATHER_LON = 35.5018;

const HC_WEATHER_CODES = {
  0: { label: 'Clear sky', icon: 'i-sun', solar: 'good' },
  1: { label: 'Mainly clear', icon: 'i-sun', solar: 'good' },
  2: { label: 'Partly cloudy', icon: 'i-cloud', solar: 'fair' },
  3: { label: 'Overcast', icon: 'i-cloud', solar: 'poor' },
  45: { label: 'Fog', icon: 'i-cloud', solar: 'poor' },
  48: { label: 'Fog', icon: 'i-cloud', solar: 'poor' },
  51: { label: 'Light drizzle', icon: 'i-droplet', solar: 'poor' },
  53: { label: 'Drizzle', icon: 'i-droplet', solar: 'poor' },
  55: { label: 'Dense drizzle', icon: 'i-droplet', solar: 'poor' },
  61: { label: 'Light rain', icon: 'i-droplet', solar: 'poor' },
  63: { label: 'Rain', icon: 'i-droplet', solar: 'poor' },
  65: { label: 'Heavy rain', icon: 'i-droplet', solar: 'poor' },
  71: { label: 'Snow', icon: 'i-snow', solar: 'poor' },
  73: { label: 'Snow', icon: 'i-snow', solar: 'poor' },
  75: { label: 'Heavy snow', icon: 'i-snow', solar: 'poor' },
  80: { label: 'Rain showers', icon: 'i-droplet', solar: 'poor' },
  81: { label: 'Rain showers', icon: 'i-droplet', solar: 'poor' },
  82: { label: 'Violent showers', icon: 'i-droplet', solar: 'poor' },
  95: { label: 'Thunderstorm', icon: 'i-bolt', solar: 'poor' }
};

const HC_SOLAR_OUTLOOK = {
  good: 'Clear skies — strong solar output expected today.',
  fair: 'Some cloud cover — solar output may dip on and off.',
  poor: 'Overcast or wet — expect reduced solar generation today.'
};

async function hcGetWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${HC_WEATHER_LAT}&longitude=${HC_WEATHER_LON}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather service unavailable');
    const data = await res.json();
    const code = data.current.weather_code;
    const meta = HC_WEATHER_CODES[code] || { label: 'Mixed conditions', icon: 'i-cloud', solar: 'fair' };
    return {
      ok: true,
      temp: Math.round(data.current.temperature_2m),
      high: Math.round(data.daily.temperature_2m_max[0]),
      low: Math.round(data.daily.temperature_2m_min[0]),
      label: meta.label,
      icon: meta.icon,
      outlook: HC_SOLAR_OUTLOOK[meta.solar]
    };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/* ---------------------------- utilities (demo) ---------------------------- */
// Generator and water-tank monitoring aren't tied to a specific platform
// yet, so these stay demo-only until you've picked a real sensor source
// (a smart plug sensing genset current draw, a Tuya tank-level sensor, etc).

function hcDemoUtilities() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const gridDown = hour % 6 < 1.2; // demo: a rotating ~1hr outage window
  const gasPct = Math.max(6, Math.round(58 - (now.getDate() % 30) * 1.1));
  const oilPct = Math.max(5, Math.round(71 - (now.getDate() % 45) * 1.0));
  return {
    generator: {
      running: gridDown,
      fuelPct: Math.max(8, Math.round(78 - (now.getDate() % 28) * 1.6)),
      runtimeTodayMin: gridDown ? Math.round((hour % 6) * 60) : 0
    },
    waterTank: {
      pct: Math.max(12, Math.round(64 + Math.sin(hour / 5) * 20))
    },
    gasTank: {
      pct: gasPct,
      daysLeft: Math.round(gasPct / 100 * 42) // demo: ~42 days on a full cylinder
    },
    fuelOil: {
      pct: oilPct,
      daysLeft: Math.round(oilPct / 100 * 95) // demo: ~95 days on a full heating tank
    }
  };
}

/* ---------------------------- activity log ---------------------------- */

const HC_ACTIVITY_KEY = 'hc_activity_v1';

function hcRelativeTime(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.round(hours / 24) + 'd ago';
}

function hcGetActivity() {
  try {
    const list = JSON.parse(localStorage.getItem(HC_ACTIVITY_KEY) || '[]');
    if (list.length) return list;
  } catch (e) { /* fall through to seed */ }

  // Seed a few plausible entries on first visit so the feed isn't empty.
  const now = Date.now();
  const seed = [
    { message: 'Robot vacuum finished cleaning', at: new Date(now - 2 * 3600000).toISOString() },
    { message: 'Kitchen Light turned off', at: new Date(now - 3.2 * 3600000).toISOString() },
    { message: 'Living Room AC turned on — 23°', at: new Date(now - 5.5 * 3600000).toISOString() }
  ];
  localStorage.setItem(HC_ACTIVITY_KEY, JSON.stringify(seed));
  return seed;
}

function hcLogActivity(message) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(HC_ACTIVITY_KEY) || '[]'); } catch (e) { /* noop */ }
  list.unshift({ message, at: new Date().toISOString() });
  localStorage.setItem(HC_ACTIVITY_KEY, JSON.stringify(list.slice(0, 20)));
}

/* ---------------------------- scenes ---------------------------- */

async function hcApplyScene(sceneId) {
  const scene = window.HC_SCENES.find(s => s.id === sceneId);
  if (!scene) return;
  let changed = 0;
  const sends = [];
  window.HC_DEVICES.forEach(d => {
    const patch = scene.ruleFor(d);
    if (!patch) return;
    const isNoop = Object.entries(patch).every(([k, v]) => d.state[k] === v);
    if (isNoop) return;
    Object.assign(d.state, patch);
    changed++;
    sends.push(hcSendDeviceCommand(d, patch));
  });
  hcLogActivity(`${scene.label} scene applied — ${changed} device${changed === 1 ? '' : 's'} changed`);
  await Promise.all(sends);
  return changed;
}

/* ---------------------------- pantry (fully local — no cloud API exists for this) ---------------------------- */
// Everything here lives in this browser's localStorage. There's no
// "connect to my supermarket" integration to speak of, so unlike the rest
// of the site this isn't demo-vs-live — it's just a real, working list.

const HC_PANTRY_KEY = 'hc_pantry_v1';

function hcLoadPantry() {
  try {
    const list = JSON.parse(localStorage.getItem(HC_PANTRY_KEY) || 'null');
    if (list) return list;
  } catch (e) { /* fall through to seed */ }

  const today = new Date();
  const inDays = n => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);
  const seed = [
    { id: 'p1', name: 'Milk', category: 'groceries', quantity: 2, unit: 'L', lowThreshold: 1, expiresAt: null },
    { id: 'p2', name: 'Eggs', category: 'groceries', quantity: 6, unit: 'pcs', lowThreshold: 4, expiresAt: null },
    { id: 'p3', name: 'Rice', category: 'groceries', quantity: 1, unit: 'kg', lowThreshold: 2, expiresAt: null },
    { id: 'p4', name: 'Olive oil', category: 'groceries', quantity: 0, unit: 'bottle', lowThreshold: 1, expiresAt: null },
    { id: 'p5', name: 'Dish soap', category: 'household', quantity: 1, unit: 'bottle', lowThreshold: 1, expiresAt: null },
    { id: 'p6', name: 'Paper towels', category: 'household', quantity: 4, unit: 'rolls', lowThreshold: 2, expiresAt: null },
    { id: 'p7', name: 'Paracetamol', category: 'medicine', quantity: 8, unit: 'tabs', lowThreshold: 6, expiresAt: inDays(280) },
    { id: 'p8', name: 'Antiseptic cream', category: 'medicine', quantity: 1, unit: 'tube', lowThreshold: 1, expiresAt: inDays(18) }
  ];
  localStorage.setItem(HC_PANTRY_KEY, JSON.stringify(seed));
  return seed;
}

function hcSavePantry(list) {
  localStorage.setItem(HC_PANTRY_KEY, JSON.stringify(list));
}

function hcPantryStatus(item) {
  if (item.quantity <= 0) return 'out';
  if (item.quantity <= item.lowThreshold) return 'low';
  return 'ok';
}

function hcExpiryStatus(item) {
  if (!item.expiresAt) return null;
  const days = Math.round((new Date(item.expiresAt) - new Date()) / 86400000);
  if (days < 0) return { label: 'Expired', days, urgent: true };
  if (days <= 30) return { label: `Expires in ${days}d`, days, urgent: true };
  return { label: `Expires ${item.expiresAt}`, days, urgent: false };
}

function hcPantrySummary() {
  const list = hcLoadPantry();
  const low = list.filter(i => hcPantryStatus(i) === 'low').length;
  const out = list.filter(i => hcPantryStatus(i) === 'out').length;
  const expiring = list.filter(i => { const e = hcExpiryStatus(i); return e && e.urgent; }).length;
  return { total: list.length, low, out, expiring, needsAttention: low + out };
}

/* ---------------------------- expenses (fully local, same idea as pantry) ---------------------------- */

const HC_EXPENSES_KEY = 'hc_expenses_v1';

function hcLoadExpenses() {
  try {
    const list = JSON.parse(localStorage.getItem(HC_EXPENSES_KEY) || 'null');
    if (list) return list;
  } catch (e) { /* fall through to seed */ }

  const today = new Date();
  const iso = (day) => new Date(today.getFullYear(), today.getMonth(), day).toISOString().slice(0, 10);
  const seed = [
    { id: 'x1', date: iso(3), amount: 85.5, category: 'groceries', note: 'Weekly groceries' },
    { id: 'x2', date: iso(5), amount: 40, category: 'fuel', note: 'Gas cylinder refill' },
    { id: 'x3', date: iso(8), amount: 120, category: 'utilities', note: 'EDL electricity bill' },
    { id: 'x4', date: iso(1), amount: 25, category: 'medicine', note: 'Pharmacy' }
  ];
  localStorage.setItem(HC_EXPENSES_KEY, JSON.stringify(seed));
  return seed;
}

function hcSaveExpenses(list) {
  localStorage.setItem(HC_EXPENSES_KEY, JSON.stringify(list));
}

function hcExpensesInMonth(list, year, month) {
  return list.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function hcExpenseSummary() {
  const list = hcLoadExpenses();
  const now = new Date();
  const thisMonth = hcExpensesInMonth(list, now.getFullYear(), now.getMonth());
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = hcExpensesInMonth(list, prev.getFullYear(), prev.getMonth());
  return {
    total: thisMonth.reduce((a, e) => a + e.amount, 0),
    count: thisMonth.length,
    lastTotal: lastMonth.reduce((a, e) => a + e.amount, 0),
    entries: list.length
  };
}
