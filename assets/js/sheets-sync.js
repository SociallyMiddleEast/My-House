/* ==========================================================================
   Google Sheets sync — shared by Pantry and Expenses. Entirely client-side:
   Google Identity Services hands the browser a short-lived OAuth access
   token, and that token calls the Sheets API directly (CORS-enabled by
   Google). No backend proxy involved, unlike DeyeCloud/Tuya/etc — and
   unlike those, the access token is kept in memory only, never written to
   localStorage. One Google connection (one Client ID, one Sheet ID) is
   shared by both features; each writes to its own named tab in that Sheet.
   ========================================================================== */

const HC_SHEET_SETTINGS_KEY = 'hc_pantry_sheet_v1'; // name predates Expenses — kept for backward compatibility
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

/* ---------------------------- generic tab read/write ---------------------------- */
// tabName must match an existing tab in the Sheet exactly (case-sensitive).
// range is the cell range within that tab, e.g. 'A1:G1000'.

function hcSheetsRangeUrl(tabName, range, suffix) {
  const s = hcLoadSheetSettings();
  const full = `${tabName}!${range}`;
  return `https://sheets.googleapis.com/v4/spreadsheets/${s.sheetId}/values/${encodeURIComponent(full)}${suffix || ''}`;
}

async function hcSheetsFetchTab(tabName, range, parseRow) {
  if (!hcSheetToken) throw new Error('Not connected to Google.');
  const res = await fetch(hcSheetsRangeUrl(tabName, range), { headers: { Authorization: `Bearer ${hcSheetToken}` } });
  if (res.status === 401) { hcSheetToken = null; throw new Error('Google session expired — reconnect.'); }
  if (!res.ok) throw new Error(`Sheets read failed (${res.status}) — make sure a tab named "${tabName}" exists.`);
  const data = await res.json();
  const rows = (data.values || []).slice(1); // skip header row
  return rows.map(parseRow).filter(Boolean);
}

async function hcSheetsPushTab(tabName, range, header, rowsData) {
  if (!hcSheetToken) throw new Error('Not connected to Google.');
  const values = [header, ...rowsData];
  const res = await fetch(hcSheetsRangeUrl(tabName, range, '?valueInputOption=USER_ENTERED'), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${hcSheetToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: `${tabName}!${range}`, values })
  });
  if (res.status === 401) { hcSheetToken = null; throw new Error('Google session expired — reconnect.'); }
  if (!res.ok) throw new Error(`Sheets write failed (${res.status}) — make sure a tab named "${tabName}" exists.`);
}
