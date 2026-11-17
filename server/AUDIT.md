# ONE TAP Real Estate Agent — Audit

**Date:** 2026-11-16 (refreshed)
**Status:** Shippable MVP. All prior blockers closed.

## Closed Items

- [x] **Rate limiting** — implemented on `/register` (8/min), `/login` (12/min), and `/lead` (60/min per agent). In-memory Map; swap for Redis at scale.
- [x] **Stripe webhook customer ID persistence** — `checkout.session.completed` writes `stripe_customer_id` and sets `subscription_status` to `active`; `customer.subscription.deleted` sets `canceled`.
- [x] **Billing portal** — `/api/billing-portal` creates a Stripe portal session when a customer ID exists; returns 409 with clear message if checkout hasn't completed.
- [x] **Admin dashboard JWT** — `/app` route authenticates via Bearer token or `onetap_token` HttpOnly cookie (`SameSite=Lax`, `Secure` in production). Legacy `server/public/admin.html` removed; `/app` is the single dashboard.
- [x] **Test suite** — `server/test.js` using Node built-in test runner. Covers health, register validation, duplicate email, login, auth guards, lead CRUD, status transitions, booking, daily summary, lead rate-limit burst, checkout-without-Stripe 503, logout.
- [x] **Input sanitization** — name/phone/email/source truncated; HTML escaped in dashboard render; JSON body capped at 100kb.
- [x] **Production JWT guard** — server exits fatally in production if `JWT_SECRET` is missing or under 32 characters.

## Open Items (non-blocking for MVP sale)

- [ ] **Twilio trial account** — SMS delivery limited to verified numbers until upgraded. Documented in GET-PAID.md buyer notes.
- [ ] **Redis-backed rate limiter** — current in-memory limiter resets on restart and won't share across instances.
- [ ] **Automated email/SMS in tests** — lead qualification path sends via Twilio/SendGrid when keys present; tests assert the HTTP response, not provider delivery.
- [ ] **Stripe keys** — not provisioned. Checkout and billing portal return 503 until `STRIPE_SECRET` and `STRIPE_PRICE_ID` are set. Webhook signature verification is implemented and ready.
- [ ] **HTTPS termination** — deploy behind Railway/Render/Cloudflare; `Secure` cookie flag activates automatically when `NODE_ENV=production`.

## Architecture Summary

- Express server, SQLite (agents / leads / appointments), JWT auth (7-day), API-key auth for inbound lead webhooks.
- Integrations: Twilio SMS, SendGrid email, Stripe Checkout + Customer Portal + webhooks.
- Public marketing site under `/site`, agent dashboard at `/app`, health check at `/health`.
- Deploy: `easy-launch.ps1` for local; Railway/Render for server, Vercel optional for site.

## Verdict

Ready for buyer demo and sale listing. Source-only ask stands at $10k (range $8–18k) via Escrow.com per SELL.md.
