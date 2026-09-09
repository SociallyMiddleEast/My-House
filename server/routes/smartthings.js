const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// SmartThings' REST API (developer.smartthings.com) — a Personal Access
// Token with the right device scopes is enough for personal use. Devices
// expose "capabilities"; this covers the common `switch` capability and,
// for anything with a coolingSetpoint, temperature control.

const configured = () => !!process.env.SMARTTHINGS_TOKEN;
const base = 'https://api.smartthings.com/v1';

function headers() {
  return { Authorization: `Bearer ${process.env.SMARTTHINGS_TOKEN}`, 'Content-Type': 'application/json' };
}

function fromStStatus(status) {
  const main = status?.components?.main || {};
  const out = {};
  if (main.switch?.switch?.value) out.on = main.switch.switch.value === 'on';
  if (main.thermostatCoolingSetpoint?.coolingSetpoint?.value !== undefined) {
    out.temp = main.thermostatCoolingSetpoint.coolingSetpoint.value;
  }
  return out;
}

router.get('/devices', async (req, res) => {
  if (!configured()) return res.status(501).json({ error: 'SmartThings is not configured on the server.' });
  try {
    const listRes = await fetch(`${base}/devices`, { headers: headers() });
    const list = await listRes.json();
    const items = list.items || [];
    const results = await Promise.all(items.map(async (item) => {
      const statusRes = await fetch(`${base}/devices/${item.deviceId}/status`, { headers: headers() });
      const status = await statusRes.json();
      return { id: item.deviceId, name: item.label, state: fromStStatus(status) };
    }));
    res.json({ devices: results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/device/:id/commands', async (req, res) => {
  if (!configured()) return res.status(501).json({ error: 'SmartThings is not configured on the server.' });
  const patch = req.body || {};
  const commands = [];
  if ('on' in patch) commands.push({ component: 'main', capability: 'switch', command: patch.on ? 'on' : 'off' });
  if ('temp' in patch) commands.push({ component: 'main', capability: 'thermostatCoolingSetpoint', command: 'setCoolingSetpoint', arguments: [patch.temp] });

  try {
    const cmdRes = await fetch(`${base}/devices/${req.params.id}/commands`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ commands })
    });
    const data = await cmdRes.json();
    if (!cmdRes.ok) return res.status(502).json({ error: data.error?.message || 'SmartThings rejected the command' });
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
