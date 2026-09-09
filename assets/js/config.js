/* ==========================================================================
   Settings storage. Nothing here ever holds a real API secret — those live
   only in the backend proxy's environment variables. The browser only
   remembers where the proxy is and, optionally, a shared access key for it.
   ========================================================================== */

const HC_STORE_KEY = 'hc_settings_v1';

const HC_DEFAULTS = {
  mode: 'demo',            // 'demo' | 'live'
  proxyUrl: '',            // e.g. https://your-proxy.onrender.com
  proxyKey: '',            // shared secret sent as x-proxy-key
  services: {               // which integrations are considered "on"
    deye: false,
    tuya: false,
    lg: false,
    smartthings: false,
    philips: true,          // no API — shown for reference by default
    eureka: true            // no API — shown for reference by default
  },
  lastPing: null            // { ok: boolean, at: ISOString, message }
};

function hcLoadSettings() {
  try {
    const raw = localStorage.getItem(HC_STORE_KEY);
    if (!raw) return { ...HC_DEFAULTS, services: { ...HC_DEFAULTS.services } };
    const parsed = JSON.parse(raw);
    return {
      ...HC_DEFAULTS,
      ...parsed,
      services: { ...HC_DEFAULTS.services, ...(parsed.services || {}) }
    };
  } catch (e) {
    return { ...HC_DEFAULTS, services: { ...HC_DEFAULTS.services } };
  }
}

function hcSaveSettings(partial) {
  const current = hcLoadSettings();
  const next = {
    ...current,
    ...partial,
    services: { ...current.services, ...(partial.services || {}) }
  };
  localStorage.setItem(HC_STORE_KEY, JSON.stringify(next));
  return next;
}

function hcGetMode() {
  return hcLoadSettings().mode;
}

function hcIsLive() {
  const s = hcLoadSettings();
  return s.mode === 'live' && !!s.proxyUrl;
}

function hcServiceEnabled(name) {
  return !!hcLoadSettings().services[name];
}
