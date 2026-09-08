# ONE TAP Real Estate Agent

**Instant lead response system for real estate agents.**  
SMS + email automation · CRM · appointment booking · $99/mo SaaS.

**Status: Sell-ready & launch-ready.** See **[SELL.md](./SELL.md)** for pricing, valuation, and 60-minute deploy path.

---

## What it does

1. Agent signs up → gets unique API key.
2. Lead sources (Zillow, Facebook, website, Zapier) POST to `/lead` with the API key.
3. System immediately sends personalized SMS (Twilio) + Email (SendGrid) with qualification questions.
4. Lead appears in the agent’s private CRM dashboard.
5. Agent books appointments, views daily summaries, manages billing via Stripe.

## Quick Start (Local)

```bash
git clone https://github.com/elnick-93/one-tap-real-estate-agent.git
cd one-tap-real-estate-agent/server
npm install
cp ../.env.example .env   # fill real keys
node server.js
```

Dashboard: http://localhost:3000/admin.html (after login/register)

## Production Deploy (under 60 min)

See the full checklist in **SELL.md**.

Critical steps:
1. Deploy `site/` (static) to Vercel/Netlify → replace Stripe Payment Link in `index.html`.
2. Deploy `server/` to Railway/Render → set all env vars from `.env.example`.
3. Test lead → SMS/Email → CRM.
4. Start selling.

## Keys you need

- Twilio: https://www.twilio.com/try-twilio
- SendGrid: https://sendgrid.com/
- Stripe Payment Link + secret: https://dashboard.stripe.com/

## Monetization

- $99/mo per agent (Stripe).
- High retention vertical — agents who stop missing deals stay.
- Easy upsells later (extra seats, SMS packs, white-label).

## Repo Contents

- `server/` — Express backend + CRM UI + SQLite
- `site/` — High-converting landing + signup/login
- `SELL.md` — Complete sales package, pricing, valuation, launch checklist
- `.env.example` — All required secrets

---

Built for real revenue. Plug keys → deploy → collect payments.
