This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Founder Analytics dashboard

The **Founder Analytics** page (`/analytics`) shows habit-forming engagement KPIs
(DAU/WAU/MAU, stickiness, activation, retention cohorts, streaks, feature-usage
funnels, learning outcomes, monetization & notifications). Unlike the rest of the
panel — which talks to `faction-backend` over its REST API — these are *aggregate*
metrics that the REST surface doesn't expose, so the dashboard reads the
faction-backend Postgres (Supabase) database **directly and read-only** from this
app's own server routes (`src/app/api/analytics/*`).

**Setup:** copy `.env.local.example` → `.env.local` and set a **read-only**
connection string:

```bash
# Supabase → Project Settings → Database → Connection string → Transaction pooler
ANALYTICS_DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

The connection is forced read-only at three layers (session
`default_transaction_read_only`, an explicit `READ ONLY` transaction per query,
and a SELECT/WITH-only guard), so it can never write to the DB. Every route is
gated behind the same ADMIN session the rest of the CRM uses. Until the env var
is set, each card renders an "Analytics DB not connected" state rather than
crashing.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
