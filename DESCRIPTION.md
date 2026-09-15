# ONE TAP Real Estate Agent — What This App Is

## One sentence
ONE TAP is a small SaaS for real estate agents: a new lead hits a webhook, the system immediately texts and emails them a qualifying message, and the lead is stored in that agent’s CRM.

## Who pays
The agent. Designed price: **$99/month** via Stripe Payment Link (you must create the live link).

## What it actually does
1. Agent registers → gets a JWT + unique API key.
2. Zillow / Facebook / site form / Zapier POSTs `{ name, phone, email, source }` to `/lead` with `x-api-key`.
3. Row written to SQLite `leads`.
4. If Twilio is configured and a phone is present, SMS goes out.
5. If SendGrid is configured and an email is present, email goes out.
6. Agent logs into the dashboard, sees leads, books an appointment time, pulls a 24-hour summary.

## What is built
- Express API (`server/server.js`)
- SQLite tables: agents, leads, appointments
- bcrypt + JWT auth
- API-key lead intake
- Static landing + signup + login (`site/`)
- CRM HTML dashboard (served by the API when authenticated)
- Health endpoint
- Production warnings if secrets are missing

## What is not built
- No live paying subscribers
- Stripe billing portal is **not** finished (returns 501 until you store `stripe_customer_id` from a webhook)
- Signup/login pages talked to `127.0.0.1:3000` until this audit — they now use a configurable API base
- Twilio trial cannot SMS unverified numbers
- No multi-tenant Postgres, no rate limiter, no test suite
- Dashboard `/admin.html` JWT gate expects an Authorization header; browser bookmarks need the token in localStorage + the JS fetch path (login first)

## Honest commercial frame
This is a **deployable MVP**, not a scaled CRM. Fastest money is either (a) sell the source or (b) plug keys, deploy, and sell seats to agents you can actually reach.

Repo: https://github.com/elnick-93/one-tap-real-estate-agent
