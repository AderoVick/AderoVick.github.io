# Production deployment guide

## Stage 1 — Replace the current GitHub Pages site

1. Back up the current `AderoVick.github.io` repository.
2. Copy all files from this project into the repository root.
3. Commit with `Upgrade portfolio to AderoVick Digital Hub` and push to `main`.
4. In GitHub: **Settings → Pages → Deploy from a branch → main → /(root)**.
5. Confirm the public pages, project buttons, order form demo and responsive menu.

At this point the hub is public, but it remains in demo mode. Real client data and payments should not be enabled on GitHub Pages alone.

## Stage 2 — Supabase

1. Create a new Supabase project.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
3. In **Authentication**, enable email sign-in and configure the site URL.
4. Create your account through `portal.html`.
5. In SQL Editor run:

```sql
update public.profiles set role = 'admin' where email = 'YOUR_EMAIL';
```

6. Copy the project URL and anon/publishable key into `assets/js/config.js`.
7. Keep the service-role key server-side only.

## Stage 3 — Cloudflare Pages

1. Create a Cloudflare account and connect the GitHub repository.
2. Create a Pages project from `AderoVick/AderoVick.github.io`.
3. Build command: leave blank. Build output directory: `/`.
4. Add public variables from `wrangler.toml` as needed.
5. Add encrypted secrets from `.env.example` under **Settings → Variables and Secrets**.
6. Update `ALLOWED_ORIGIN` and `APP_URL` to the final Cloudflare or custom domain.
7. Update `assets/js/config.js`:

```js
demoMode: false,
apiBaseUrl: "",
supabaseUrl: "https://YOUR_PROJECT.supabase.co",
supabaseAnonKey: "YOUR_PUBLIC_ANON_KEY"
```

8. Deploy and test order creation, guest tracking and admin login before adding payment secrets.

## Stage 4 — Payments

### M-Pesa

Create a Safaricom Daraja application. Add the consumer key, consumer secret, shortcode, passkey and callback URL as Cloudflare secrets. Begin in sandbox mode. The callback URL is:

```text
https://YOUR_DOMAIN/api/payments/mpesa/callback
```

### Stripe

Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Create a webhook endpoint:

```text
https://YOUR_DOMAIN/api/payments/stripe/webhook
```

Subscribe to Checkout Session completion, asynchronous success/failure and expiration events.

### PayPal

Create sandbox credentials and add `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_ENV=sandbox`. Test order approval and capture before switching to live credentials.

### Crypto

Use a compliant provider-generated invoice or payment-link endpoint and set `CRYPTO_PAYMENT_URL`. Do not collect wallet private keys or recovery phrases. Review current legal, tax and provider requirements before enabling this option.

## Stage 5 — Social publishing

1. Create a Meta app and obtain the required permissions for the Facebook Page.
2. Add `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN` and a current Graph API version.
3. Create an approved LinkedIn developer application and obtain Posts API access.
4. Add `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN` and a supported version.
5. Sign into `admin.html` with the Supabase admin account.
6. Publish a private test or low-risk announcement first and verify the results on each platform.

For scheduled publishing, deploy `workers/social-scheduler.js` as a separate Cloudflare Worker with the included cron configuration and the same server-side secrets.

## Go-live checklist

- [ ] Demo mode is off only on the full-stack deployment.
- [ ] GitHub Pages buttons point to the live websites and applications.
- [ ] Admin role is assigned only to your account.
- [ ] Supabase RLS is enabled and the file bucket is private.
- [ ] Payment endpoints reject orders without approved quotations.
- [ ] Test and live provider credentials are not mixed.
- [ ] Webhook/callback signatures and responses are tested.
- [ ] Privacy, terms, refund and data-retention policies are reviewed.
- [ ] MFA is enabled on every connected service.
- [ ] A custom domain and professional email are configured when ready.
