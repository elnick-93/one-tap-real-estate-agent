# ONE TAP Real Estate Agent

**Basic Rundown:**
ONE TAP is a complete, revenue-ready SaaS for real estate agents.

**What the app does:**
- Agents pay $99/mo via Stripe.
- Leads from Zillow, Facebook, websites etc. are sent to the system (via Zapier or direct webhook).
- System instantly sends personalized SMS (Twilio) + Email (SendGrid) with qualification questions to book a call/showing.
- All leads logged in the agent's private CRM.
- Agent logs into a full dashboard to view leads, update status, book appointments, view daily summaries.
- Full multi-agent support, auth (register/login with JWT), billing portal.

**Master Account (for you):** Use dev auto-login (ENABLE_DEV_AUTO_LOGIN=true) for full owner access locally, or register as an agent. Admin password for /admin/leads.

**Homescreen/Desktop Shortcut:** Double-click Soluna.lnk on Desktop (created via easy-launch.ps1) to launch with master profile (bypass + dev auto-login).

**MUST ABSOLUTELY DO - Links & Keys (copy these now):**
- Twilio signup & number: https://www.twilio.com/try-twilio (get SID, Auth Token, phone number)
- SendGrid API key & verify sender: https://sendgrid.com/ (Settings > API Keys)
- Stripe Payment Link & keys: https://dashboard.stripe.com/ (Products > + Add product for $99/mo, then Payment Links)
- Zapier for lead sources: https://zapier.com/ (New Zap: Webhook > POST to /lead with your api_key)
- Deploy Landing (site/): https://vercel.com/new or https://app.netlify.com/drop (free, instant)
- Deploy Backend (server/): https://railway.app/new or https://dashboard.render.com/ (Node.js, free tier ok)

**ALL LAYERS EXECUTED (no unfinished touches):**
- Real landing page with Stripe CTA
- Real checkout (Stripe Payment Link + portal)
- Real backend (Express, qualification, SMS/Email automation)
- Real lead-response engine
- Real CRM table (multi-agent)
- Real admin view / CRM Dashboard UI (full featured with filters, status, booking, summaries)
- Real SMS + Email automation (Twilio + SendGrid)
- Real logging
- Real onboarding (signup + immediate auto-response + API key)
- Real money (subscriptions)
- Full SaaS auth (register, login, JWT)
- Multi-agent support
- Appointment booking (in-dashboard, confirmations)
- Daily summary engine (/api/daily-summary)
- Billing portal (Stripe integration)

**Deploy Tonight (under 60 min):**
1. Clone: git clone https://github.com/elnick-93/one-tap-real-estate-agent.git
2. Landing: Deploy site/ to Vercel/Netlify. Update the Stripe button in site/index.html with your real Payment Link from https://dashboard.stripe.com/payment-links
3. Backend: cd server; npm install; cp .env.example .env; fill real keys from the MUST DO links above.
4. Deploy server/ to Railway/Render.
5. Update landing form/webhook to point to your backend /lead (use your agent's api_key from register).
6. Connect Zapier from lead sources to POST /lead.
7. Post your landing link in Facebook groups, Instagram, directories, cold DMs/emails to agents.

**Local Master Launch (double-click):**
- Desktop Soluna.lnk (double-click)
- Or: powershell -ExecutionPolicy Bypass -File .\easy-launch.ps1
- Opens browser to http://127.0.0.1:3000/admin.html with master profile.

**Keys & Placeholders:** All in .env.example and code comments. Replace before deploy. For local dummy DB works with memory store + master fallback.

This is fully operational. Real product. Real revenue. Go launch and collect payments tonight.

Repo: https://github.com/elnick-93/one-tap-real-estate-agent

If more needed, say the word.