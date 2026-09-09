/* ==========================================================================
   Google Sheets sync for Pantry. Entirely client-side: Google Identity
   Services hands the browser a short-lived OAuth access token, and that
   token calls the Sheets API directly (CORS-enabled by Google). No backend
   proxy involved, unlike DeyeCloud/Tuya/etc — and unlike those, the access
   token is kept in memory only, never written to localStorage.

   Sheet layout expected (first tab, no header-name required — a bare range
   defaults to the first sheet): row 1 is headers, then one row per item:
     id | name | category | quantity | unit | lowThreshold | expiresAt
   ========================================================================== */

const HC_SHEET_SETTINGS_KEY = 'hc_pantry_sheet_v1';
const HC_SHEET_RANGE = 'A1:G1000';
const HC_SHEET_HEADER = ['id', 'name', 'category', 'quantity', 'unit', 'lowThreshold', 'expiresAt'];
const HC_SHEET_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

let hcSheetToken = null;   // in-memory only — never persisted
let hcTokenClient = null;

function hcLoadSheetSettings() {
  try { return JSON.parse(localStorage.getItem(HC_SHEET_SETTINGS_KEY) || '{}'); }
  catch (e) { return {}; }
}

function hcSaveSheetSettings(patch) {
  const next = { ...hcLoadSheetSettings(), ...patch };
  localStorage.setItem(HC_SHEET_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

function hcSheetsConfigured() {
  const s = hcLoadSheetSettings();
  return !!(s.clientId && s.sheetId);
}

function hcSheetsConnected() {
  return !!hcSheetToken;
}

function hcGetTokenClient(onToken) {
  const s = hcLoadSheetSettings();
  if (!window.google || !window.google.accounts || !s.clientId) return null;
  if (!hcTokenClient) {
    hcTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: s.clientId,
      scope: HC_SHEET_SCOPE,
      callback: () => {} // replaced per-call below
    });
  }
  hcTokenClient.callback = (resp) => {
    if (resp && resp.access_token) {
      hcSheetToken = resp.access_token;
      onToken && onToken(null, resp.access_token);
    } else {
      onToken && onToken(resp && resp.error ? resp.error : 'No token returned');
    }
  };
  return hcTokenClient;
}

function hcConnectGoogle(onToken) {
  const client = hcGetTokenClient(onToken);
  if (!client) { onToken && onToken('Google sign-in script not loaded, or Client ID missing.'); return; }
  client.requestAccessToken({ prompt: 'consent' });
}

function hcTrySilentConnect(onToken) {
  if (!hcSheetsConfigured()) return;
  const client = hcGetTokenClient(onToken);
  if (!client) return;
  client.requestAccessToken({ prompt: '' });
}

function hcSheetsUrl(suffix) {
  const s = hcLoadSheetSettings();
  return `https://sheets.googleapis.com/v4/spreadsheets/${s.sheetId}/values/${encodeURIComponent(HC_SHEET_RANGE)}${suffix || ''}`;
}

async function hcSheetsFetchAll() {
  if (!hcSheetToken) throw new Error('Not connected to Google.');
  const res = await fetch(hcSheetsUrl(), { headers: { Authorization: `Bearer ${hcSheetToken}` } });
  if (res.status === 401) { hcSheetToken = null; throw new Error('Google session expired — reconnect.'); }
  if (!res.ok) throw new Error(`Sheets read failed (${res.status})`);
  const data = await res.json();
  const rows = (data.values || []).slice(1); // skip header row
  return rows
    .map(r => ({
      id: r[0] || ('p' + Date.now() + Math.random().toString(36).slice(2, 7)),
      name: r[1] || '',
      category: r[2] || 'groceries',
      quantity: Number(r[3]) || 0,
      unit: r[4] || '',
      lowThreshold: Number(r[5]) || 0,
      expiresAt: r[6] || null
    }))
    .filter(i => i.name);
}

async function hcSheetsPushAll(list) {
  if (!hcSheetToken) throw new Error('Not connected to Google.');
  const values = [HC_SHEET_HEADER, ...list.map(i => [i.id, i.name, i.category, i.quantity, i.unit, i.lowThreshold, i.expiresAt || ''])];
  const res = await fetch(hcSheetsUrl('?valueInputOption=USER_ENTERED'), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${hcSheetToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: HC_SHEET_RANGE, values })
  });
  if (res.status === 401) { hcSheetToken = null; throw new Error('Google session expired — reconnect.'); }
  if (!res.ok) throw new Error(`Sheets write failed (${res.status})`);
}
