const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const router = express.Router();

// LG's individual-user ThinQ API (opened Dec 2024, smartsolution.developer.lge.com)
// authenticates with a Personal Access Token you generate on the developer
// site — simpler than the full EMP OAuth2 flow, and enough for a single
// household. Control payloads are defined per *device profile* (an air
// conditioner's schema differs from a washer's) — the mapping below covers
// on/off and target temperature for an air conditioner and is a starting
// point, not a guarantee; check your device's profile on the developer
// site if a command doesn't take effect, and adjust toLgPayload().

const configured = () => !!process.env.LG_ACCESS_TOKEN;
const base = () => process.env.LG_BASE_URL || 'https://api-kic.lgthinq.com';

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.LG_ACCESS_TOKEN}`,
    'x-country': process.env.LG_COUNTRY || 'US',
    'x-message-id': crypto.randomUUID(),
    'Content-Type': 'application/json'
  };
}

function fromLgStatus(state) {
  // Best-effort read of a common air-conditioner-shaped response. Adjust
  // the field paths to match what your device actually returns.
  const op = state?.operation?.airConOperationMode;
  const temp = state?.temperature?.targetTemperature;
  const out = {};
  if (op !== undefined) out.on = op === 'POWER_ON' || op === 'START';
  if (temp !== undefined) out.temp = temp;
  return out;
}

function toLgPayload(patch) {
  const payload = {};
  if ('on' in patch) payload.operation = { airConOperationMode: patch.on ? 'POWER_ON' : 'POWER_OFF' };
  if ('temp' in patch) payload.temperature = { targetTemperature: patch.temp };
  return payload;
}

router.get('/devices', async (req, res) => {
  if (!configured()) return res.status(501).json({ error: 'LG ThinQ is not configured on the server.' });
  try {
    const listRes = await fetch(`${base()}/devices`, { headers: authHeaders() });
    const list = await listRes.json();
    const items = list.response || list.result || [];
    const results = await Promise.all(items.map(async (item) => {
      const id = item.deviceId || item.id;
      try {
        const stateRes = await fetch(`${base()}/devices/${id}/state`, { headers: authHeaders() });
        const stateData = await stateRes.json();
        return { id, state: fromLgStatus(stateData.response || stateData) };
      } catch {
        return { id, state: {} };
      }
    }));
    res.json({ devices: results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/device/:id/commands', async (req, res) => {
  if (!configured()) return res.status(501).json({ error: 'LG ThinQ is not configured on the server.' });
  try {
    const payload = toLgPayload(req.body || {});
    const ctrlRes = await fetch(`${base()}/devices/${req.params.id}/control`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
    });
    const data = await ctrlRes.json();
    if (!ctrlRes.ok) return res.status(502).json({ error: data.message || 'LG ThinQ rejected the command' });
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
