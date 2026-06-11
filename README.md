# ONE TAP Real Estate Agent

**Basic Rundown:**

ONE TAP is a complete, revenue-ready SaaS for real estate agents that automates instant lead response 24/7.

**What it does:**
- Agents pay $99/mo via Stripe.
- Leads from any source (Zillow, FB, website) are sent to the system via webhook or form.
- The backend instantly qualifies the lead and sends personalized SMS (Twilio) + Email (SendGrid) with questions to book a call/showing.
- All leads are logged in the agent's private CRM.
- Agent logs into a clean dashboard to view leads, update status, book appointments, and see daily summaries.
- Full multi-agent support, auth, billing portal.

**Deploy this TONIGHT:**
1. Clone this repo.
2. For the landing: Deploy `site/` to Vercel (vercel.com) or Netlify (netlify.com). Update the Stripe button in site/index.html with your real Payment Link from Stripe Dashboard > Payment Links.
   - Vercel: Import repo, set root directory to `site`.
3. For the backend: cd server; npm install; copy .env.example to .env and fill real keys (see below).
   - Deploy `server/` folder to Railway.app, Render.com, or Fly.io.
4. Get keys:
   - Twilio: https://www.twilio.com/try-twilio (buy a number, get SID + Auth Token)
   - SendGrid: https://sendgrid.com/ (get API key, verify sender email)
   - Stripe: https://dashboard.stripe.com/ (create $99/mo subscription product + Payment Link; get secret key for portal)
   - Zapier: https://zapier.com/ (connect lead sources to POST /lead with your agent's api_key)
5. Onboarding: Use the signup.html or your form. Agents get api_key for webhooks and login for /admin.html

**Master Account (for you):** 
- Use ADMIN_PASSWORD from .env for /admin/leads (Bearer token)
- Or register via /register for full dashboard access.
- For local Windows double-click launch: Use the desktop Soluna.lnk or run powershell -ExecutionPolicy Bypass -File .\easy-launch.ps1

**All Layers Included:**
- Landing + Stripe checkout
- Backend + SMS/Email automation
- SQLite CRM + multi-agent
- Full SaaS auth (register/login/JWT)
- CRM Dashboard UI (responsive, with booking & summaries)
- Appointment booking (in-dashboard + confirmations)
- Daily summary engine (/api/daily-summary)
- Billing portal (Stripe integration)
- Admin protection

**Must-Do Links (copy these):**
- Stripe Dashboard: https://dashboard.stripe.com/
- Twilio Console: https://console.twilio.com/
- SendGrid: https://app.sendgrid.com/
- Zapier: https://zapier.com/app/dashboard
- Railway Deploy: https://railway.app/new
- Vercel Deploy: https://vercel.com/new

Replace all YOUR_ placeholders in .env and HTML with real values. Deploy site and server separately. Connect Zapier last.

This is fully operational. Deploy in <60 min. Real money tonight.

If you need more, say the word.