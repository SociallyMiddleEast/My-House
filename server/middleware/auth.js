// Guards every /api route with a shared secret. This proxy can read your
// energy data and flip your real devices, so it should never be reachable
// by anyone who doesn't know PROXY_API_KEY.
//
// If PROXY_API_KEY isn't set, requests are allowed through with a console
// warning — convenient for local dev, but set it before deploying anywhere
// public.

module.exports = function requireProxyKey(req, res, next) {
  const expected = process.env.PROXY_API_KEY;

  if (!expected) {
    console.warn('[auth] PROXY_API_KEY is not set — this proxy is unauthenticated. Set it before deploying.');
    return next();
  }

  const provided = req.header('x-proxy-key');
  if (provided !== expected) {
    return res.status(401).json({ error: 'Missing or invalid x-proxy-key header.' });
  }
  next();
};
