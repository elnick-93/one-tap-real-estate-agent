# ONE TAP Real Estate Agent

**Basic Rundown:**
ONE TAP is a complete SaaS that lets real estate agents never miss a lead again.

- Agents pay $99/mo.
- Leads from any source (Zillow, FB, website) hit the system via webhook or form.
- Instant personalized SMS (Twilio) + Email (SendGrid) with qualification questions.
- All leads logged in personal CRM.
- Agent logs into dashboard to see leads, update status, book appointments, get daily summaries.
- Full multi-agent, auth, billing portal.

**MUST ABSOLUTELY DO (links & keys):**
- Twilio signup & number: https://www.twilio.com/try-twilio
- SendGrid API key & verify email: https://sendgrid.com/
- Stripe Payment Link & keys: https://dashboard.stripe.com/
- Zapier for lead sources: https://zapier.com/
- Deploy site: https://vercel.com/new (or Netlify)
- Deploy server: https://railway.app/new (or Render/Fly.io)

Replace ALL YOUR_ and placeholder values.

**ALL LAYERS EXECUTED:**
See the full implementation in server/server.js and site/.
- Landing + Stripe
- Backend + SMS/Email
- Real CRM + multi-agent
- Full SaaS auth (register/login/JWT)
- CRM Dashboard UI (with booking & summaries)
- Appointment booking
- Daily summary engine
- Billing portal (Stripe)

**Master Account & Desktop Shortcut:**
- Desktop Soluna.lnk (double-click to launch with master profile)
- Or: powershell -ExecutionPolicy Bypass -File .\easy-launch.ps1
- Master: dev auto-login as owner (full premium) or register for your own account.

**Deploy Tonight:**
1. Clone repo
2. Update site/index.html with real Stripe link
3. cd server; npm install; cp .env.example .env; fill real keys from links above
4. Deploy site/ to Vercel
5. Deploy server/ to Railway
6. Connect Zapier to /lead with your api_key
7. Post your landing link

Real product. Real revenue. Go.