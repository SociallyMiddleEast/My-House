# Home Control proxy

A small Express app that holds your real API secrets and talks to DeyeCloud,
Tuya, LG ThinQ, and SmartThings on behalf of the static frontend. GitHub
Pages can't run this — deploy it somewhere that runs Node, then point the
dashboard's Connections page at its URL.

## Run locally

```
cd server
cp .env.example .env   # fill in whatever integrations you have
npm install
npm start
```

The proxy listens on `http://localhost:8787`. Visit `/api/health` to confirm
it's up.

## Deploy it somewhere real

Any small Node host works. Three free-tier-friendly options:

**Render**
1. New → Web Service → connect this repo, root directory `server`.
2. Build command `npm install`, start command `npm start`.
3. Add every variable from `.env.example` under Environment.
4. Once deployed, copy the `https://….onrender.com` URL.

**Railway**
1. New Project → Deploy from GitHub repo → select this repo, set the root
   to `server`.
2. Add the same environment variables.
3. Copy the generated public URL.

**Fly.io**
1. `fly launch` from inside `server/` (accept the Node detection).
2. `fly secrets set DEYE_APP_ID=... TUYA_CLIENT_ID=... [etc]`
3. `fly deploy`.

Whichever you pick, set `ALLOWED_ORIGIN` to your GitHub Pages URL (e.g.
`https://yourname.github.io`) and set `PROXY_API_KEY` to a long random
string — then enter both the deployed URL and that key on the dashboard's
Connections page.

## Notes on accuracy

DeyeCloud's and LG ThinQ's exact field names can vary by account/region —
`routes/deye.js` and `routes/lgthinq.js` include comments on where to
double-check against your own developer portal response. Tuya's data-point
codes (`switch_1`, `bright_value`, ...) are product-specific; use the Tuya
IoT Console's device debug panel if a command doesn't do anything.

## Endpoints

| Method | Path                              | Notes                                |
|--------|------------------------------------|---------------------------------------|
| GET    | `/api/health`                     | unauthenticated, used by "Test connection" |
| GET    | `/api/deye/overview`              | normalized energy snapshot            |
| GET    | `/api/deye/stations`              | raw station list                      |
| GET    | `/api/tuya/devices`               | status for `TUYA_DEVICE_IDS`          |
| POST   | `/api/tuya/device/:id/commands`   | `{ on, temp, brightness }`            |
| GET    | `/api/lg/devices`                 | status for all linked LG devices      |
| POST   | `/api/lg/device/:id/commands`     | `{ on, temp }`                        |
| GET    | `/api/smartthings/devices`        | status for all linked devices         |
| POST   | `/api/smartthings/device/:id/commands` | `{ on, temp }`                   |

All non-health routes require an `x-proxy-key` header matching
`PROXY_API_KEY` once that's set.
