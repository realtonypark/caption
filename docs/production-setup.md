# Caption deployment

Project: `caption-purple`. Region: `us-central1`. The Firebase CLI account is `realtonypark@gmail.com`.

Install dependencies with `npm ci` and `npm ci --prefix functions`. Run `npm run build`, `npm run lint`, `npm test`, and `npm run test:backend`.

Start local services with `firebase emulators:start --only auth,firestore,functions --project caption-purple`. Store an owner OpenRouter key in ignored `functions/.secret.local` as `OPENROUTER_KEY=…`, then run `VITE_FIREBASE_EMULATORS=true npm run dev`. Run `npm run test:rules` against the running Firestore emulator. Never use the emulator flag in a production build.

For deployment, link an approved billing account to enable Blaze, then store the key with `firebase functions:secrets:set OPENROUTER_KEY --project caption-purple`. Build without emulator environment variables and deploy with `firebase deploy --project caption-purple`. The frontend Firebase configuration is public project metadata; provider credentials are server secrets.

Google sign-in and anonymous sessions are enabled. Guests read without a sign-up screen. Only Google accounts sync libraries. The authenticated API verifies Firebase tokens and limits shared usage. Firestore rules deny access to all server-only data. Set a Firestore TTL on `quotas.expiresAt` after billing is enabled to expire quota records.

The live app is hosted at https://caption-purple.web.app. Cost controls are configured for this project: a monthly $3 alerts-only project budget and enforced monthly $1 caps for Cloud Functions and Cloud Run. Service caps pause new requests when enforced; they are not an absolute $3 project ceiling. Reporting delays, in-flight work, and services outside these caps can incur additional charges. Function container images have a one-day Artifact Registry cleanup policy. Keep the caps in place when deploying. See [Google Cloud spend cap limitations](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps#limitations-of-spend-cap-budgets).
