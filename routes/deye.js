const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// DeyeCloud's exact request/response field names can vary slightly by
// account region and API version — this file follows the pattern documented
// in DeyeCloud's own quickstart + sample code (github.com/DeyeCloudDevelopers)
// as of when this was written. Before going live, run one request with
// DEBUG_DEYE=1 and diff the logged response against what's read below.

const configured = () => !!(process.env.DEYE_APP_ID && process.env.DEYE_APP_SECRET && process.env.DEYE_EMAIL);

let cachedToken = null; // { accessToken, expiresAt }

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
    return cachedToken.accessToken;
  }
  const base = process.env.DEYE_BASE_URL || 'https://eu1-developer.deyecloud.com/v1.0';
  const res = await fetch(`${base}/account/token?grantType=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: process.env.DEYE_APP_ID,
      appSecret: process.env.DEYE_APP_SECRET,
      email: process.env.DEYE_EMAIL,
      password: process.env.DEYE_PASSWORD
    })
  });
  const data = await res.json();
  if (process.env.DEBUG_DEYE) console.log('[deye] token response', JSON.stringify(data));
  const token = data.accessToken || data.access_token;
  if (!token) throw new Error(data.msg || data.message || 'DeyeCloud did not return an access token');
  cachedToken = { accessToken: token, expiresAt: Date.now() + (Number(data.expiresIn || data.expires_in || 3600) * 1000) };
  return token;
}

async function deyeCall(path, body) {
  const base = process.env.DEYE_BASE_URL || 'https://eu1-developer.deyecloud.com/v1.0';
  const token = await getToken();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `bearer ${token}` },
    body: JSON.stringify(body || {})
  });
  const data = await res.json();
  if (process.env.DEBUG_DEYE) console.log(`[deye] ${path} response`, JSON.stringify(data));
  return data;
}

router.get('/stations', async (req, res) => {
  if (!configured()) return res.status(501).json({ error: 'DeyeCloud is not configured on the server.' });
  try {
    const data = await deyeCall('/station/list', { page: 1, size: 20 });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Convenience endpoint the frontend's Energy page actually calls: fetches
// the configured station's latest reading and normalizes it into the shape
// energy.js expects. Field names on the right of `??` are fallbacks for
// alternate DeyeCloud response shapes — check DEBUG_DEYE output and adjust
// if your account's response differs.
router.get('/overview', async (req, res) => {
  if (!configured()) return res.status(501).json({ error: 'DeyeCloud is not configured on the server.' });
  const stationId = process.env.DEYE_STATION_ID;
  if (!stationId) return res.status(501).json({ error: 'DEYE_STATION_ID is not set.' });

  try {
    const data = await deyeCall('/station/latest', { stationId: Number(stationId) });
    const d = data.stationDataItems ? data.stationDataItems[0] : data;

    const pvPower = Number(d.generationPower ?? d.pvPower ?? d.gp ?? 0) / 1000;
    const loadPower = Number(d.usePower ?? d.consumptionPower ?? d.loadPower ?? 0) / 1000;
    const batterySoc = Number(d.batterySOC ?? d.batterySoc ?? d.soc ?? 0);
    const batteryPower = Number(d.batteryPower ?? d.chargePower ?? 0) / 1000;
    const gridPower = Number(d.gridPower ?? d.purchasePower ?? d.wirePower ?? 0) / 1000;

    res.json({
      source: 'deyecloud',
      pvPower, loadPower, batterySoc, batteryPower, gridPower,
      todayKwh: Number(d.generationValue ?? d.dayEnergy ?? 0),
      monthKwh: Number(d.generationMonthValue ?? d.monthEnergy ?? 0),
      totalKwh: Number(d.generationTotalValue ?? d.totalEnergy ?? 0),
      history: [], // populate from a /station/history call if your account exposes intraday points
      stationName: d.stationName || `Station ${stationId}`,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
