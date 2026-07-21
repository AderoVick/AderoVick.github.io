# AderoVick Digital Hub

A complete upgrade of the original one-page portfolio into an interactive business and applications platform.

## What the platform includes

- **Applications directory** with separate buttons for each live website, interactive app and source repository.
- **Automatic GitHub project synchronisation** every six hours, plus an optional immediate dispatch workflow.
- **Services marketplace** with deliverables, timelines and planning estimates.
- **Client order workflow** with a quotation estimator, tracking code and optional file uploads.
- **Client portal** for guest tracking and Supabase account authentication.
- **Checkout architecture** for M-Pesa STK Push, PayPal Orders, Stripe Checkout and an optional crypto invoice link.
- **Admin dashboard** for orders, project catalogue review and approved social publishing.
- **Facebook Page and LinkedIn publishing endpoints** with encrypted server-side tokens.
- **Progressive Web App support**, responsive layout, accessibility features, SEO, legal pages and security headers.
- **Supabase schema** with Row Level Security, private file storage and role-based admin access.

## Important deployment model

The public pages work on GitHub Pages. However, GitHub Pages cannot securely run order APIs, payment callbacks, private file uploads or social publishing. For the full platform, deploy the same repository to **Cloudflare Pages with Pages Functions** and connect a custom domain.

```text
Public interface
  ├─ Apps and websites
  ├─ Services and quotation estimator
  ├─ Order and client portal
  └─ Checkout user interface

Cloudflare Pages Functions
  ├─ Orders and uploads
  ├─ M-Pesa, PayPal and Stripe checkout creation
  ├─ Payment callbacks and webhooks
  └─ Facebook Page and LinkedIn publishing

Supabase
  ├─ Authentication
  ├─ Orders and payments
  ├─ Private client files
  └─ Admin roles and scheduled posts
```

## Quick preview

Open `index.html`, or run a local static server:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

The starter uses `demoMode: true` in `assets/js/config.js`. Demo orders are saved only in the current browser and no real payments or social posts are made.

## Production setup

1. Create a Supabase project and run `supabase/schema.sql`.
2. Create your own user account, then promote that account to `admin` in the `profiles` table.
3. Add the Supabase public URL and anon key to `assets/js/config.js`.
4. Deploy the repository to Cloudflare Pages.
5. Add all server-only credentials as encrypted Cloudflare secrets. Start from `.env.example`.
6. Set `demoMode: false` only after the API and database tests pass.
7. Configure Stripe and M-Pesa webhooks to the production domain.
8. Review `privacy.html`, `terms.html` and provider compliance requirements before accepting payments.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete guided setup.

## Automatic project updates

The workflow `.github/workflows/sync-projects.yml` runs every six hours and rebuilds `data/projects.json` from the public repositories owned by `AderoVick`.

For the best results, add a `project.json` file to each project repository using `project.example.json`:

```json
{
  "title": "TextPulse Forecast Lab",
  "summary": "NLP and time-series forecasting platform.",
  "category": "Data Science",
  "websiteUrl": "https://aderovick.github.io/stem-arma-lab/",
  "appUrl": "https://textpulse-forecast-lab.streamlit.app/",
  "featured": true,
  "status": "Live",
  "topics": ["NLP", "Forecasting", "Streamlit"]
}
```

When the repository description, language, stars, update date, homepage or `project.json` changes, the hub catalogue refreshes automatically.

## Payment safety

- Never place secret keys in `assets/js/config.js`, HTML or GitHub commits.
- Stripe sessions, PayPal orders and M-Pesa STK requests are created server-side.
- The server verifies that an order has an approved quotation before creating a payment request.
- Stripe webhook signatures and M-Pesa callbacks update payment status.
- Crypto remains an optional provider invoice link; the platform never asks for a recovery phrase or private key.

## Social publishing safety

The publisher targets a **Facebook Page**, not a personal profile, and the LinkedIn API. Both endpoints require an authenticated Supabase user whose profile role is `admin`. Store page and access tokens only in Cloudflare encrypted secrets.

## Checks

```bash
npm run check
```

This validates required files, JSON documents and JavaScript syntax.

## Official documentation used for the architecture

- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/
- Supabase authentication and storage: https://supabase.com/docs/
- Stripe Checkout Sessions: https://docs.stripe.com/payments/checkout
- PayPal Orders API: https://developer.paypal.com/docs/api/orders/v2/
- Safaricom Daraja: https://developer.safaricom.co.ke/
- Facebook Pages API posts: https://developers.facebook.com/documentation/pages-api/posts
- LinkedIn Posts API: https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api
- GitHub repository API: https://docs.github.com/rest/repos

## License

The platform code is prepared for the AderoVick project. Review third-party service terms and licences before commercial launch.
