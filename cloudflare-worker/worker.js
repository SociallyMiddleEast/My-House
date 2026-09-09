/* ==========================================================================
   Tuya proxy as a Cloudflare Worker. Deploy by pasting this whole file into
   the Cloudflare dashboard's Worker editor — no GitHub connection, no
   npm install, no build command. See README.md in this folder.

   Holds the same two things a real proxy has to hold: your Tuya Client
   Secret (so it can sign requests) and a PROXY_API_KEY (so random people
   can't use your Worker to poke your devices). Both are set as Cloudflare
   "Variables and Secrets" in the dashboard — never written in this file.
   ========================================================================== */

let cachedToken = null; // best-effort — persists while the Worker instance stays warm, resets on cold start, either way still correct

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

function withCors(response, env) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN || '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, x-proxy-key');
  return new Response(response.body, { status: response.status, headers });
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str || ''));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Upper(str, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(str));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function stringToSign(method, bodyStr, url) {
  return [method, await sha256Hex(bodyStr), '', url].join('\n');
}

function tuyaBase(env) { return env.TUYA_BASE_URL || 'https://openapi.tuyaeu.com'; }

async function getTuyaToken(env) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) return cachedToken.accessToken;
  const clientId = env.TUYA_CLIENT_ID, secret = env.TUYA_CLIENT_SECRET;
  const t = Date.now().toString();
  const url = '/v1.0/token?grant_type=1';
  const sts = await stringToSign('GET', '', url);
  const sign = await hmacSha256Upper(clientId + t + sts, secret);
  const res = await fetch(tuyaBase(env) + url, {
    method: 'GET',
    headers: { client_id: clientId, sign, t, sign_method: 'HMAC-SHA256' }
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.msg || 'Tuya token request failed');
  cachedToken = { accessToken: data.result.access_token, expiresAt: Date.now() + data.result.expire_time * 1000 };
  return cachedToken.accessToken;
}

async function tuyaCall(method, path, body, env) {
  const clientId = env.TUYA_CLIENT_ID, secret = env.TUYA_CLIENT_SECRET;
  const token = await getTuyaToken(env);
  const t = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const sts = await stringToSign(method, bodyStr, path);
  const sign = await hmacSha256Upper(clientId + token + t + sts, secret);
  const res = await fetch(tuyaBase(env) + path, {
    method,
    headers: { client_id: clientId, access_token: token, t, sign_method: 'HMAC-SHA256', sign, 'Content-Type': 'application/json' },
    body: bodyStr || undefined
  });
  return res.json();
}

// Best-effort generic-patch-to-Tuya-DP mapping — same caveat as the Node
// version: DP codes are product-specific, check Tuya IoT Console's device
// debug panel if a command doesn't do anything.
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

async function tuyaDevices(env) {
  if (!env.TUYA_CLIENT_ID || !env.TUYA_CLIENT_SECRET) return jsonResponse({ error: 'Tuya is not configured.' }, 501);
  const ids = (env.TUYA_DEVICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return jsonResponse({ error: 'TUYA_DEVICE_IDS is not set.' }, 501);
  const results = await Promise.all(ids.map(async (id) => {
    const data = await tuyaCall('GET', `/v1.0/devices/${id}/status`, null, env);
    return { id, state: fromTuyaStatus(data.result) };
  }));
  return jsonResponse({ devices: results });
}

async function tuyaCommand(id, patch, env) {
  if (!env.TUYA_CLIENT_ID || !env.TUYA_CLIENT_SECRET) return jsonResponse({ error: 'Tuya is not configured.' }, 501);
  const commands = toTuyaCommands(patch);
  const data = await tuyaCall('POST', `/v1.0/devices/${id}/commands`, { commands }, env);
  if (!data.success) return jsonResponse({ error: data.msg || 'Tuya rejected the command' }, 502);
  return jsonResponse({ ok: true });
}

async function route(request, url, env) {
  const path = url.pathname;

  if (path === '/api/health') {
    return jsonResponse({ ok: true, time: new Date().toISOString() });
  }

  if (env.PROXY_API_KEY) {
    const provided = request.headers.get('x-proxy-key');
    if (provided !== env.PROXY_API_KEY) {
      return jsonResponse({ error: 'Missing or invalid x-proxy-key header.' }, 401);
    }
  }

  if (path === '/api/tuya/devices' && request.method === 'GET') {
    return tuyaDevices(env);
  }

  const cmdMatch = path.match(/^\/api\/tuya\/device\/([^/]+)\/commands$/);
  if (cmdMatch && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    return tuyaCommand(decodeURIComponent(cmdMatch[1]), body, env);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), env);
    }
    let response;
    try {
      response = await route(request, new URL(request.url), env);
    } catch (err) {
      response = jsonResponse({ error: err.message }, 500);
    }
    return withCors(response, env);
  }
};
