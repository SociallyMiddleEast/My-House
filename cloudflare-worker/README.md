# Tuya proxy — Cloudflare Worker version

The same job as `/server`, done without deploying a Node app: this holds
your Tuya Client Secret and signs requests on the site's behalf, so the
secret never sits in the browser or the public repo. Currently covers Tuya
only — DeyeCloud/LG ThinQ/SmartThings still need `/server` if you want
those live too (same pattern, just not ported here yet).

## Deploy it (about 5 minutes, all in the browser)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com), sign up or log in (free).
2. **Workers & Pages** → **Create** → **Create Worker**. Give it any name — this becomes part of its URL (e.g. `my-house-tuya`).
3. Click **Deploy** to create it with the default placeholder code, then click **Edit code**.
4. Select all the placeholder code, delete it, and paste in the entire contents of `worker.js` from this folder.
5. Click **Deploy** (top right).
6. Go to the Worker's **Settings → Variables and Secrets**. Add these, each as an **encrypted** secret rather than plain text where noted:
   - `TUYA_CLIENT_ID` — your Access ID
   - `TUYA_CLIENT_SECRET` — your Access Secret (encrypt this)
   - `TUYA_BASE_URL` — matching your Tuya Data Center, e.g. `https://openapi.tuyaeu.com`
   - `TUYA_DEVICE_IDS` — comma-separated device IDs from the Tuya IoT Platform
   - `PROXY_API_KEY` — make up any long random string (encrypt this) — this is what stops random people from calling your Worker
   - `ALLOWED_ORIGIN` — your GitHub Pages URL, e.g. `https://sociallymiddleeast.github.io`
7. Save. Your Worker's URL is shown at the top of its dashboard page, something like `https://my-house-tuya.yoursubdomain.workers.dev`.
8. Visit `<that URL>/api/health` in a browser — you should see `{"ok":true,...}`.

## Connect it on the site

Settings → Data source → paste the Worker URL into **Proxy base URL** and the `PROXY_API_KEY` you made up into **Proxy access key** → Save → Test connection → switch Mode to **Live proxy**. Settings → Integrations → toggle **Tuya** on.

## Notes

- Free tier is 100,000 requests/day — nowhere close to what a personal dashboard needs.
- No sleep/cold-start delay the way Render's free tier has.
- Tuya's data-point codes (`switch_1`, `bright_value`, ...) are product-specific — if a command doesn't do anything once connected, check the real codes in the Tuya IoT Console's device debug panel and adjust `toTuyaCommands()` in `worker.js`.
