# API Monitor

An internal dashboard for tracking API / SaaS usage, quotas and renewal dates in one place — so you find out you're near a limit *before* something stops working.

Built with **Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Recharts**.

---

## Status at a glance

Three of the five tracked services read **real live data**; two are still placeholders.

| Service | Status | What's actually tracked | Source |
| --- | --- | --- | --- |
| **Zyte** | 🟢 Live | USD spent this billing cycle vs your spending limit | `GET /api/stats` (Zyte Stats API) |
| **Decodo** | 🟡 Live (limited) | 80% / 100% traffic threshold crossings only | Incoming webhook |
| **SadCaptcha** | 🟢 Live | Credits used / remaining | `GET /license/credits` |
| **Google** | 🔴 Mock | — | not implemented |
| **Hootsuite** | 🔴 Mock | — | not implemented |

> **Important:** alert history, usage-over-time charts and "usage anomalies" are still **seeded mock data** for every service, including the live ones. See [Known limitations](#known-limitations).

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the keys you have
npm run dev
```

Open <http://localhost:3000> — `/` redirects to `/dashboard`.

Services with no credentials configured stay on their mock values and never show a `LIVE` badge. Nothing breaks if you only configure one provider.

---

## Environment variables

All credentials are read **server-side only** and never reach the browser. `.env.local` is gitignored.

### Zyte

```bash
ZYTE_API_KEY=          # dashboard/STATS API key — NOT your scraping API key
ZYTE_ORG_ID=           # from the dashboard URL: app.zyte.com/o/123456 -> 123456
ZYTE_LIMIT=            # USD spending limit (see note below)
ZYTE_RENEWAL=          # any one known billing date, YYYY-MM-DD — set once
ZYTE_BILLING_CYCLE=Monthly
```

Things worth knowing, learned the hard way:

- Zyte's docs are explicit that the Stats API uses a **different key** from the one you use for scraping requests. Sent as HTTP Basic auth username with an empty password.
- **Zyte caps dollars, not requests.** Plans have a USD spending limit; hit it and requests get blocked. So this tracks `cost_microusd_total`, not `request_count`. Your limit shows on the dashboard's Zyte API Usage card ("$X of $Y used").
- Usage is summed **from the current billing cycle's start**, derived from `ZYTE_RENEWAL` — not a rolling 30-day window, which would bleed into the previous cycle.
- Expect a small delta (~5%) versus the dashboard figure: the exact hour a cycle flips over isn't documented anywhere, so the window start is approximated at midnight.
- Rate limit: 20 requests/minute.

### Decodo

```bash
DECODO_API_KEY=            # dashboard.decodo.com -> API Keys
DECODO_PROXY_TYPE=datacenter_proxies
DECODO_TRAFFIC_FIELD=      # only for residential/mobile — see below
DECODO_WEBHOOK_TOKEN=      # random string, acts as a password in the webhook URL
DECODO_RENEWAL=            # set once, auto-rolls forward
DECODO_BILLING_CYCLE=Monthly
```

**Decodo's public API does not support datacenter or ISP plans at all.** This is stated in their docs and confirmed by testing: a valid key returns `HTTP 200` with an empty `[]` for every proxy type, while a bad key returns `401`. It is not a configuration mistake and no amount of fiddling fixes it.

For those plans the only working signal is **webhooks**, which do cover every proxy type:

1. Set `DECODO_WEBHOOK_TOKEN` to any random string.
2. Deploy the app somewhere publicly reachable (Decodo can't call `localhost`).
3. In dashboard.decodo.com → Settings → Webhooks, register:
   `https://<your-domain>/api/webhooks/decodo/<DECODO_WEBHOOK_TOKEN>`
4. Enable the `traffic_usage` webhook.

Decodo only fires that webhook at **80% and 100%** — so you get threshold alerts, never a continuous live percentage. There's no renewal webhook either, which is why `DECODO_RENEWAL` is manual.

Decodo publishes no webhook signing scheme, so the random token in the URL is the only safeguard. Treat it like a password.

On **residential/mobile** plans the REST path works instead, but Decodo leaves the traffic-stats response schema undocumented — set `DECODO_TRAFFIC_FIELD` to whichever field holds used traffic after inspecting one real response.

### SadCaptcha

```bash
SADCAPTCHA_LICENSE_KEY=      # sent as a query param — that's SadCaptcha's design
SADCAPTCHA_TOTAL_CREDITS=    # your last top-up amount
```

Prepaid credits that **never expire**, so there's no renewal date and none is shown. The API only reports credits *remaining*, never the original total — without `SADCAPTCHA_TOTAL_CREDITS` you get the raw remaining balance but no meaningful percentage.

### Google & Hootsuite

Placeholders only — the variables exist in `.env.example` but nothing reads them yet.

Research notes for whenever these get built:

- **Hootsuite** requires manual app approval (email `dev.support@hootsuite.com`) and only exposes **API-call quota** via the `X-Account-Quota` / `X-Account-Quota-Used` response headers — never subscription usage. It's effectively renewal-only.
- **Google** has no single "usage" API; you have to point at a specific metric endpoint (e.g. a Cloud Monitoring time-series query) per API you care about.

---

## How it works

```
Browser (client state)                Server (secrets stay here)         Provider
─────────────────────                 ──────────────────────────         ────────
AppStateProvider          ──fetch──▶  /api/zyte         ──────────────▶  Zyte Stats API
  · localStorage                      /api/sadcaptcha   ──────────────▶  SadCaptcha
  · refetch on route change           /api/decodo  ◀── reads ──┐
  · poll on Settings interval                                  │
  · manual Refresh button             /api/webhooks/decodo/[token]  ◀──  Decodo webhook
                                                     writes .data/
```

- Each provider is an isolated server module under `src/lib/providers/`. Credentials never leave the server; the browser only ever sees normalised numbers.
- A failed or unconfigured provider **falls back to showing an explanatory note, never a fabricated number** — services that couldn't be read say so on their detail page.
- Live values are merged over the defaults in `src/hooks/use-app-state.tsx`, keyed by service id.
- Client state (alert read/resolved status, settings, added APIs, theme) persists to `localStorage`. New built-in services are backfilled into a returning user's saved list automatically.

### Project structure

```
src/
  app/
    (app)/            dashboard · apis · apis/[id] · alerts · renewals · settings
    api/              zyte · decodo · sadcaptcha · webhooks/decodo/[token]
  components/
    layout/           sidebar, topbar, theme, notifications
    dashboard/        KPIs, services table, usage chart, renewals, alerts, anomalies
    apis/             table, cards, add-API modal, detail page + alert config
    alerts/ renewals/ settings/
    common/           status badges, progress, KPI card, empty/loading states
    ui/               shadcn/ui primitives
  hooks/              use-app-state (central store), use-local-storage
  lib/
    providers/        zyte.ts · decodo.ts · sadcaptcha.ts   (server-only)
    types.ts          ApiService, Alert, AlertSettings, …
    mock-data.ts      seed/fallback data
    format.ts         dates, percentages, billing-cycle maths
    status.ts         getUsageStatus() — single source of truth for thresholds
    alert-engine.ts   threshold / spike / renewal rules (not wired up yet)
    webhook-store.ts  persists the latest Decodo webhook to .data/
```

### Status thresholds

One function, `getUsageStatus()` in `src/lib/status.ts`, drives every badge and colour:

| Usage | Status |
| --- | --- |
| 0–49% | Healthy |
| 50–74% | Warning |
| 75–89% | High Usage |
| 90–100% | Critical |

Status is never communicated by colour alone — every badge carries a text label.

---

## Email alerts

You get an email when a service crosses a usage threshold. The check runs **server-side on a schedule**, not in the browser — an alert that only fires while the dashboard is open would be pointless.

```
GitHub Actions (every 15 min)  ──▶  GET /api/cron/check  ──▶  providers (live usage)
                                            │
                                            ├── crossed a new threshold?
                                            ├── already emailed this cycle?  (.data/alert-state.json)
                                            └── send via Gmail SMTP
```

### Setup

1. **Gmail App Password** — enable 2FA on the sending Google account, then create one at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). Your normal password will not work.
2. Fill in `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ALERT_EMAIL_TO`, `ALERT_THRESHOLDS`, `CRON_SECRET` in `.env.local`.
3. Test it locally: `curl localhost:3000/api/cron/check`
4. Deploy, then add `MONITOR_URL` (your deployed URL) and `CRON_SECRET` as **GitHub repo secrets** — `.github/workflows/usage-alerts.yml` calls the endpoint every 15 minutes.

You get **at most one email per threshold per billing cycle**, so a 15-minute schedule doesn't spam you. Cross 50% you get one mail; cross 75% later you get another; nothing repeats until the cycle resets.

`ALERT_THRESHOLDS` in the env is the **source of truth** — the threshold checkboxes in Settings and per-API Alert Configuration are browser-side only and the server can't read them.

> **Deployment caveat:** dedup state lives in `.data/alert-state.json`. That's reliable locally, but Vercel's filesystem is ephemeral — after a cold start the file is gone and an already-sent alert can fire again. To make this airtight on serverless, move the two functions in `src/lib/alert-state.ts` onto a small KV store (Vercel KV / Upstash).

---

## Known limitations

Worth reading before trusting anything on screen.

1. **The Alerts *page* is still seed data.** Usage-threshold **emails** are real (see above), but the rows shown on `/alerts`, the notification dropdown and the "usage anomalies" card are static mock entries — including ones naming live services. `detectUsageSpike()` and `checkRenewalReminder()` in `alert-engine.ts` are still never called.
2. **Only usage thresholds alert.** Renewal/due reminders, spike detection and Decodo billing-failure webhooks are not wired to email yet.
3. **Usage-over-time charts are fabricated.** The 30/90-day trend lines come from a deterministic random walk in `mock-data.ts`, even for services showing a `LIVE` badge. Real history needs stored snapshots over time; there is no datastore.
4. **Decodo's live number isn't continuous.** It reflects the last webhook received (80% or 100%), so it sits still between threshold crossings. Displayed as `80 / 100` with an explanatory note.
5. **All state is per-browser.** Everything lives in `localStorage`, so nothing is shared between devices or users, and clearing site data resets it.
6. **Google and Hootsuite are mock**, and `refresh()` applies random jitter to them — their numbers move but mean nothing.
7. **`src/lib/provider-types.ts` is unused.** It sketches a common `ApiProviderAdapter` interface the real providers don't implement.

---

## Roadmap

Roughly in order of value:

1. **Real history charts from Zyte, for free.** The Stats API accepts `groupby_time=day` and returns real per-day `request_count`, `cost_microusd_total` and `response_time_sec_avg`. Zyte already stores the history — no datastore needed on our side. This replaces the fabricated trend line for Zyte outright.
2. **Real API health.** Every Zyte stats response already carries a `status_codes` breakdown (this account currently runs ~88.8% success — millions of `429`s and `520`s). The app has no health concept at all today.
3. **Per-domain health.** `groupby_domain=true&include_domain_health=true` returns, per domain: `status`, `my_success_rate_24h/7d`, `my_avg_response_time`, spend, plus `global_avg_success_rate` — i.e. whether a domain is hard for everyone or just for you. 26 domains are in play here.
4. **Feed the Alerts page from real events** so it stops showing seed data next to live services.
5. **Move dedup state to a KV store** so alert de-duplication survives serverless cold starts.
6. **Deploy** and register the Decodo webhook against the public URL (the only way datacenter plans report anything).
7. **Build the Google and Hootsuite providers.**
8. Consider a **low-balance alert** for SadCaptcha — for prepaid credits "remaining is low" is the useful signal, whereas the current model is built around "usage % is high".

---

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build (type-checks and lints)
npm run start   # serve the production build
```
