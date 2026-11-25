# Plantain Boy Experience — event website

Static site (`/public`) + Vercel serverless API (`/api`). No database needed.

## Deploy on Vercel
1. Push this folder to GitHub (or run `vercel` in this folder).
2. In Vercel > Project > Settings > Environment Variables, add everything from `.env.example`.
3. Deploy. Vercel serves `/public` automatically and runs `/api/*` as functions.
4. Gmail setup: log into blakmixedentertainment@gmail.com > Google Account > Security > turn on 2-Step Verification > search "App passwords" > create one named "Plantain Boy" > paste the 16 characters into `GMAIL_APP_PASSWORD`.
5. In Paystack > Settings > API Keys, set the callback is handled automatically (no webhook needed).

## Flow
Pick ticket → details → `/api/checkout` (price computed on server) → Paystack → `/success.html` → `/api/verify`
confirms payment with Paystack, shows QR tickets and emails them once (BLAKMIXED ENT branded) from the Gmail account. Gmail allows about 500 emails/day.

## Edit things
- Prices, perks, date, venue: `api/_lib.js` (venue can also be set via `EVENT_VENUE` env var).
- Partners: `public/index.html` (#partners). Sponsor logo: `public/img/dvanity.jpg`. Social links: footer.
- Door check-in: `/admin.html` with your `ADMIN_KEY`.

## Check-in database (free)
Check-in needs to remember who has already entered, so it uses Upstash Redis:
1. Vercel project > Storage / Marketplace > add **Upstash Redis** (free plan) and connect it to this project.
   Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically (or set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).
2. Redeploy. Open `/admin.html`, sign in with `ADMIN_KEY`.

## Admin dashboard (`/admin.html`)
Live counts, search by reference / ticket code / name / email / phone, one-tap Check in (with undo),
and a QR scanner that flags already-used tickets. Orders are read straight from Paystack.
