# ONE TAP Real Estate Agent

Instant SMS + email when a real estate lead arrives. CRM + booking + $99/mo seat model.

Read **[DESCRIPTION.md](./DESCRIPTION.md)** for what this app is. Read **[AUDIT.md](./AUDIT.md)** for what is finished and what is not.

## Local

```bash
cd server
npm install
cp ../.env.example .env   # fill keys
node server.js
```

Open `site/index.html` locally or deploy `site/` to Vercel. Set `ONE_TAP_API_OVERRIDE` in `site/config.js` to your API URL when the landing is not on localhost.

## Status

- Lead in → SMS/email out → CRM row: **implemented** (needs Twilio + SendGrid keys)
- Auth + API keys: **implemented**
- Stripe Payment Link CTA: **you paste the live link**
- Stripe customer portal: **not done**
- Paying agents: **none yet**

Sales notes: [SELL.md](./SELL.md) · [GET-PAID.md](./GET-PAID.md) · [LISTINGS.md](./LISTINGS.md)
