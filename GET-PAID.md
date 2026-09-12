# GET PAID — ONE TAP Real Estate Agent

Two tracks. Do both if you can. Track 1 is faster cash.

## Track 1 — Sell $99/mo seats (this week)

### Keys (do first)
1. Stripe: create Product “ONE TAP Agent” $99/mo recurring. Create Payment Link. Copy the URL.
2. Twilio: trial is fine to start. Get SID, Auth Token, From number.
3. SendGrid: API key + verify a sender email.
4. Generate a long JWT_SECRET (32+ random chars).

### Deploy
```bash
# Landing
# Drag site/ to Vercel or Netlify. Edit site/index.html Stripe href to your Payment Link.

# Backend
cd server
npm install
cp ../.env.example .env
# fill keys
NODE_ENV=production node server.js
# or deploy this folder to Railway / Render, set env vars, PORT from platform
```

### First sale test
1. Register an agent account.
2. POST a fake lead to /lead with x-api-key.
3. Confirm SMS/email + row in CRM.
4. Pay yourself via the Stripe test link once, then flip to live keys.

### Outreach (copy-paste)
**Facebook / Realtor groups / Instagram DM:**

Hey — built a tool that texts + emails every new lead in seconds so you stop losing Zillow/Facebook deals to slow replies. $99/mo. I can have you live today. Want the 2-minute demo?

**Indie Hackers / X:**

Selling / launching ONE TAP — instant SMS+email lead response + CRM for real estate agents. $99/mo SaaS or buy the full source. Repo: https://github.com/elnick-93/one-tap-real-estate-agent

**Code sale listing:**
ONE TAP Real Estate Agent — complete $99/mo SaaS. Express + SQLite + Twilio + SendGrid + Stripe + CRM dashboard. Deploy in under an hour. Asking $8,000–$12,000 for full source + transfer help.

---

## Track 2 — Asset sale

Ask $8k–$18k. Send SELL.md + repo link. Do not hand over until payment clears (Escrow.com or similar).
