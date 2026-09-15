# ONE TAP Real Estate Agent

Finished MVP product: an agent account, a webhook that texts and emails new leads, a CRM dashboard, Stripe checkout, and a billing portal once Stripe has a customer id.

## Product loop
1. Agent registers or logs in.
2. Receives an API key.
3. Lead sources POST to `/lead`.
4. SMS + email go out when Twilio/SendGrid keys exist.
5. Agent uses `/app` to view leads, change status, book appointments, subscribe.
6. Stripe webhook marks the agent `active` after checkout.

## Shipped in code
- Auth + httpOnly cookie + JWT
- Rate limits on register, login, leads
- Stripe Checkout (`/api/checkout`) and signed webhook (`/api/stripe/webhook`)
- Billing portal when `stripe_customer_id` exists
- Lead status updates and appointment booking
- Terms + privacy pages
- Health endpoint listing which integrations are configured

## Still needs your accounts
Twilio, SendGrid, Stripe price + webhook secret, and a host. The product is finished in software. It is not live until those keys exist.
