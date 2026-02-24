# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a Next.js 15 (App Router + Turbopack) web application for tennis court reservations ("Quadra de Tênis - Igrejinha"). It's a single service — no microservices, Docker, or local databases. All data lives in Firebase (Auth + Firestore).

### Running the app

- `npm run dev` — starts the dev server at http://localhost:3000 (uses Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint via `next lint`

See `README.md` for full details.

### Environment variables

All required env vars are listed in `.env.example`. For the Cloud Agent environment, secrets are injected as environment variables. A `.env.local` file must be generated from those env vars for Next.js to read them. The key variables are:

- `NEXT_PUBLIC_FIREBASE_*` — Firebase client SDK config (required for the app to function)
- `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_KEY` — Firebase Admin credentials (required for reservation API routes; the app runs without them but reservations won't work server-side)
- `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` — email notifications (optional, fails gracefully)
- `IMGBB_API_KEY` — image uploads in social posts (optional)

### Gotchas

- The Firebase Admin SDK warns about a missing service account key file at build time. This is expected if `FIREBASE_SERVICE_ACCOUNT_PATH` points to a file that doesn't exist. The app still builds and runs; only the server-side reservation API routes are affected.
- There are no automated tests configured in this project (`npm test` is not defined).
- The `next lint` command shows a deprecation warning about being removed in Next.js 16 — this is informational and does not affect functionality.
- The root URL `/` redirects (307) to `/login`. After authentication, the app navigates to `/home`.
