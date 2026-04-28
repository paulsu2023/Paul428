# Paul428

Paul428 is a Next.js AI storyboard and short-video creation tool. It can run in a local demo mode without Supabase or Stripe, and it can call Gemini / Google AI Studio plus a FlowAPI service compatible with [flow2api](https://github.com/TheSmallHanCat/flow2api).

## Features

- Product/image analysis with Gemini models.
- Storyboard generation and editing.
- Image and video generation through a FlowAPI `/v1/chat/completions` endpoint.
- Optional Supabase authentication, credits, and database storage.
- Optional Stripe checkout/webhook flow for credits.

## Requirements

- Node.js 20 or newer.
- npm.
- A Gemini / Google AI Studio API key.
- Optional: a running FlowAPI service based on `flow2api` for Flow image/video models.
- Optional: Supabase and Stripe accounts for production auth, credits, and billing.

## Quick Start

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

For local testing, keep `NEXT_PUBLIC_DEMO_MODE=true`. In demo mode the app skips Supabase auth, database writes, and Stripe billing.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values you need.

- `GOOGLE_API_KEY` or `GEMINI_API_KEY`: Gemini / Google AI Studio key.
- `GEMINI_BASE_URL`: optional compatible Gemini base URL.
- `FLOW_API_BASE_URL`: FlowAPI base URL, default `http://127.0.0.1:38000`.
- `FLOW_API_KEY`: FlowAPI bearer token. The default matches many local `flow2api` setups; change it for public or shared deployments.
- `NEXT_PUBLIC_DEMO_MODE`: set `true` for local demo mode.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: required only when Supabase is enabled.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: required only when Stripe billing is enabled.
- `NEXT_PUBLIC_APP_URL`: public app URL for redirects.

## FlowAPI

The Flow integration in this project is based on a `flow2api`-compatible service:

https://github.com/TheSmallHanCat/flow2api

Start that service separately, then set:

```bash
FLOW_API_BASE_URL=http://127.0.0.1:38000
FLOW_API_KEY=han1234
```

The app calls `POST /v1/chat/completions` and expects generated image links in Markdown image format or generated video links in a `<video src="...">` response.

## Production Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Add the Supabase environment variables.
3. Create Stripe products/prices if you want billing, then configure a webhook at `/api/stripe/webhook`.
4. Add Gemini and FlowAPI environment variables.
5. Deploy to Vercel or another Next.js host.

More deployment notes are in `DEPLOYMENT.md`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Security

Do not commit `.env.local`, real API keys, Stripe secrets, Supabase service role keys, local logs, `.next`, or `node_modules`. This repository includes `.env.example` only as a template.
