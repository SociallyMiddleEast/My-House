const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const router = express.Router();

// Tuya's Cloud API signing scheme (stable since ~2021, "Cloud IoT Core"):
//   stringToSign = METHOD + "\n" + sha256(body) + "\n" + "" + "\n" + urlPathAndQuery
//   sign = HMAC-SHA256( client_id [+ access_token] + t + stringToSign, client_secret ).toUpperCase()
// Docs: Tuya IoT Platform > Cloud > API Explorer > "Calculate the signature".

const configured = () => !!(process.env.TUYA_CLIENT_ID && process.env.TUYA_CLIENT_SECRET);
const base = () => process.env.TUYA_BASE_URL || 'https://openapi.tuyaeu.com';

function sha256Hex(str) { return crypto.createHash('sha256').update(str || '', 'utf8').digest('hex'); }
function sign(str, secret) { return crypto.createHmac('sha256', secret).update(str, 'utf8').digest('hex').toUpperCase(); }
function stringToSign(method, bodyStr, url) { return [method, sha256Hex(bodyStr), '', url].join('\n'); }

let cachedToken = null; // { accessToken, expiresAt }

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) return cachedToken.accessToken;
  const clientId = process.env.TUYA_CLIENT_ID, secret = process.env.TUYA_CLIENT_SECRET;
  const t = Date.now().toString();
  const url = '/v1.0/token?grant_type=1';
  const sts = stringToSign('GET', '', url);
  const res = await fetch(base() + url, {
    method: 'GET',
    headers: { client_id: clientId, sign: sign(clientId + t + sts, secret), t, sign_method: 'HMAC-SHA256' }
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.msg || 'Tuya token request failed');
  cachedToken = { accessToken: data.result.access_token, expiresAt: Date.now() + (data.result.expire_time * 1000) };
  return cachedToken.accessToken;
}

async function tuyaCall(method, path, body) {
  const clientId = process.env.TUYA_CLIENT_ID, secret = process.env.TUYA_CLIENT_SECRET;
  const token = await getToken();
  const t = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const sts = stringToSign(method, bodyStr, path);
  const res = await fetch(base() + path, {
    method,
    headers: {
      client_id: clientId, access_token: token, t, sign_method: 'HMAC-SHA256',
      sign: sign(clientId + token + t + sts, secret),
      'Content-Type': 'application/json'
    },
    body: bodyStr || undefined
  });
  return res.json();
}

// Best-effort mapping from the dashboard's generic {on, temp, brightness}
// patch to Tuya "data points" (DP codes). DP codes are product-specific —
// check the Tuya IoT Console's device debug panel and adjust these if a
// device doesn't respond (e.g. some lights use "switch_led" not "switch_1").
function toTuyaCommands(patch) {
  const commands = [];
  if ('on' in patch) commands.push({ code: 'switch_1', value: patch.on });
  if ('temp' in patch) commands.push({ code: 'temp_set', value: patch.temp });
  if ('brightness' in patch) commands.push({ code: 'bright_value', value: Math.round((patch.brightness / 100) * 1000) });
  return commands;
}

function fromTuyaStatus(statusArray) {
  const state = {};
  (statusArray || []).forEach(({ code, value }) => {
    if (['switch_1', 'switch', 'switch_led'].includes(code)) state.on = value;
    if (code === 'temp_set') state.temp = value;
    if (['bright_value', 'bright_value_v2'].includes(code)) state.brightness = Math.round((value / 1000) * 100);
  });
  return state;
}

router.get('/devices', async (req, res) => {
  if (!configured()) return res.status(501).json({ error: 'Tuya is not configured on the server.' });
  const ids = (process.env.TUYA_DEVICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return res.status(501).json({ error: 'TUYA_DEVICE_IDS is not set.' });
  try {
    const results = await Promise.all(ids.map(async id => {
      const data = await tuyaCall('GET', `/v1.0/devices/${id}/status`);
      return { id, state: fromTuyaStatus(data.result) };
    }));
    res.json({ devices: results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/device/:id/commands', async (req, res) => {
  if (!configured()) return res.status(501).json({ error: 'Tuya is not configured on the server.' });
  try {
    const commands = toTuyaCommands(req.body || {});
    const data = await tuyaCall('POST', `/v1.0/devices/${req.params.id}/commands`, { commands });
    if (!data.success) return res.status(502).json({ error: data.msg || 'Tuya rejected the command' });
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
