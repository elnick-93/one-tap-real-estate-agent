# ONE TAP audit (2026-09-15)

## Fixed this pass
- Signup and login no longer hardcode `http://127.0.0.1:3000`. They read `window.ONE_TAP_API` from `site/config.js`.
- On a public static host, set `window.ONE_TAP_API_OVERRIDE = 'https://your-api.example.com'` in config.js before deploy.
- Product description and this audit added so buyers are not sold fiction.

## Still open
- Stripe billing portal is a stub (501). Payment Link on the landing page is the real checkout path until webhooks store `stripe_customer_id`.
- `/admin.html` JWT middleware on GET does not match how browsers load a page. After login, open the dashboard URL on the **API host**, which serves HTML and uses `localStorage.token` for data fetches.
- No rate limiting on `/lead` or `/register` — add before public Zapier volume.
- SQLite file on one box is fine for the first few dozen agents, not for a national fleet.
- Twilio trial cannot message unverified numbers.
- No automated tests.

## Verdict
Ship-as-MVP if keys are real. Do not call it enterprise CRM. Do not promise a working billing portal until the Stripe webhook is written.
