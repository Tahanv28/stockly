# Stockly

Simple inventory for small businesses, trades and teams — the fair-priced Sortly alternative.
Track stock, tools and equipment from your phone: folders, photos, barcode/QR scanning,
low-stock alerts, history, team access, and one-step import from Sortly.

## What's in v0.1

- **Accounts & teams** — sign up, log in, workspaces, invite links (member/admin), switch workspaces
- **Folders** — nested locations (warehouse → aisle → shelf, vans, job sites) with breadcrumbs
- **Items** — name, quantity, unit, low-stock level, price, SKU, barcode, tags, notes, unlimited custom fields
- **Quantity changes** — one-tap +/−, take out / put in / set count with a reason; every change is logged
- **Photos** — up to 8 per item, resized on the phone before upload, private to the workspace
- **Scanning** — phone camera (iPhone + Android, self-hosted WASM decoder), plus USB/Bluetooth scanners in search
- **QR labels** — print labels for an item, a selection, or a whole folder; scanning opens the item
- **Low stock** list, **activity** feed, **search**, **trash** with restore, bulk **move**
- **Import** — CSV with automatic Sortly column mapping (folders, barcodes, custom fields) and a preview
- **Export** — full CSV, re-importable
- **Security** — scrypt password hashing, hashed session tokens, rate-limited login/signup,
  every query scoped to the workspace (covered by tests), soft-deletes, security headers

## Run locally

Requirements: Node 22+, Postgres 14+.

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL and APP_URL
npm run db:migrate
npm run dev                     # http://localhost:3000
```

Tests:

```bash
npm test                        # unit + database tests (uses the stockly_test database)
node e2e/smoke.mjs              # end-to-end browser test against a running app
```

## Deploy (suggested: Vercel + Supabase)

1. **Database & photo storage — Supabase**: create a project. Copy the Postgres connection
   string (use the pooled connection, add `?sslmode=require`). In Storage, create a private
   bucket `photos` and S3 access keys.
2. **App — Vercel**: import this GitHub repo. Set environment variables:
   - `DATABASE_URL` — Supabase connection string
   - `APP_URL` — your public URL, e.g. `https://app.yourdomain.com`
   - `S3_BUCKET=photos`, `S3_ENDPOINT` (Supabase S3 endpoint), `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
3. Deploy. Vercel runs `vercel-build`, which applies database migrations before building,
   so the database is always up to date. Commercial use needs Vercel Pro.

Without `S3_BUCKET`, photos are stored on local disk in `.data/uploads` — fine for development,
not for serverless hosting.

## Next up

- [ ] Stripe subscriptions (free tier + flat monthly plan, no item caps)
- [ ] Password reset and email notifications (low-stock digest) via an email provider
- [ ] Check-in / check-out of tools to people
- [ ] Purchase orders and reorder suggestions
- [ ] Accounting integrations (QuickBooks, Xero, Merit)
- [ ] Offline mode / installable app (PWA), then native apps

## Project layout

```
src/db/            Drizzle schema + client
src/server/        Business logic (auth, inventory, import/export, storage) — no request access, fully testable
src/lib/           Shared helpers (session cookies, numbers, CSV mapping, crypto)
src/app/           Next.js routes: (auth) pages, /app screens, API routes
src/components/    UI components (scanner, item form, lists, …)
drizzle/           SQL migrations
tests/             Vitest tests (run against a real Postgres)
e2e/               Browser smoke test (Playwright)
```
