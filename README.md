# Home Control

A static dashboard for two things:

- **Energy management** — solar/battery/grid readings from **DeyeCloud**.
- **House control** — devices on the **First Floor** and **Second Floor**,
  across **Tuya**, **LG ThinQ**, **SmartThings**, **Philips Coolhome**, and
  **Eureka**.

It's built to be hosted for free on **GitHub Pages**, and it works out of
the box with realistic demo data before you've connected anything.

## Why there's a `/server` folder too

GitHub Pages only serves static files — HTML, CSS, JS. It has no way to run
server code or keep a secret private, because anything in the repo or the
browser is visible to anyone who opens dev tools. DeyeCloud, Tuya, LG ThinQ,
and SmartThings all require requests signed with a private app secret or
token, so those calls can't be made safely straight from the browser.

The fix is the small proxy in `/server`: it holds your real credentials as
environment variables on a server you deploy separately (Render, Railway,
and Fly.io all have generous free tiers — see `server/README.md`), and the
static site only ever talks to *that*, never to DeyeCloud/Tuya/etc directly.

```
 GitHub Pages (static)              your own small server
┌─────────────────────┐   HTTPS    ┌───────────────────────┐
│ index.html           │──────────▶│ /server (Node/Express) │
│ energy.html           │  proxy    │  holds DEYE_APP_SECRET, │
│ house-control.html    │  key      │  TUYA_CLIENT_SECRET,    │──▶ DeyeCloud / Tuya /
│ connections.html      │◀──────────│  LG PAT, SmartThings PAT│    LG ThinQ / SmartThings
└─────────────────────┘  JSON       └───────────────────────┘
```

Until the proxy is deployed and connected, the site runs entirely on demo
data — every page works, nothing is broken, there's just a banner saying so.

## Put it on GitHub Pages

1. Create a new GitHub repo and push everything in this folder to it
   (everything **except** `server/.env`, which `.gitignore` already
   excludes — never commit real secrets).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`.
4. Save. GitHub gives you a URL like `https://yourname.github.io/repo-name/`
   within a minute or two.

No build step, no framework, no `npm install` needed for the site itself —
it's plain HTML/CSS/JS.

## Connect it to something real

1. Deploy `/server` (instructions in `server/README.md`) and note its URL.
2. Open the deployed dashboard → **Connections**.
3. Switch to **Live proxy**, paste the server URL and the `PROXY_API_KEY`
   you set on it, click **Test connection**.
4. Toggle on whichever integrations you've filled in credentials for.

## Where to edit your actual house

`assets/js/devices.js` is the one file to hand-edit: it's a plain array of
`{ id, floor, room, name, platform, type, state }` objects — no build step,
just edit and refresh. Once a platform is live, `id` should become that
platform's real device ID (from the Tuya IoT Console, the SmartThings API,
etc.) so commands reach the right device.

## Status of each integration

| Platform | Public API? | What this project does |
|---|---|---|
| **DeyeCloud** | Yes — AppID/AppSecret + OAuth token | Full proxy route for a normalized energy overview |
| **Tuya** | Yes — Cloud IoT Core, HMAC-signed | Full proxy routes for status + commands |
| **LG ThinQ** | Yes — opened to individual users Dec 2024, PAT-based | Full proxy routes for status + commands (control payloads vary by appliance profile — see comments in `server/routes/lgthinq.js`) |
| **SmartThings** | Yes — REST API, PAT-based | Full proxy routes for status + commands |
| **Philips Coolhome** | No public developer API found | Shown in House Control as a labeled, local-only tile — set the AC from the Coolhome app itself |
| **Eureka** (robot vacuum) | No public developer API found | Same — local-only tile, control it from the eureka robot app |

If Philips or Eureka ever publish a developer API, add a route file under
`server/routes/` following the same shape as `tuya.js`, flip `manual: false`
for that platform in `assets/js/devices.js`, and it'll pick up commands the
same way the others do.

## Project layout

```
index.html            Overview
energy.html            Energy management (DeyeCloud)
house-control.html     House control (floors → rooms → devices)
connections.html       Proxy + integration setup
assets/css/style.css   Design system
assets/js/             config.js, api.js, devices.js, nav.js, + one file per page
server/                Node/Express proxy — deploy separately, see server/README.md
```
