# Caption deployment

Project: `caption-ai-tpark`. Region: `us-central1`. The Firebase CLI account is `realtonypark@gmail.com`.

Install dependencies with `npm ci` and `npm ci --prefix functions`. Run `npm run build`, `npm run lint`, `npm test`, and `npm run test:backend`.

Start local services with `firebase emulators:start --only auth,firestore,functions --project caption-ai-tpark`. Store an owner OpenRouter key in ignored `functions/.secret.local` as `OPENROUTER_KEY=…`, then run `VITE_FIREBASE_EMULATORS=true npm run dev`. Run `npm run test:rules` against the running Firestore emulator. Never use the emulator flag in a production build.

For deployment, link an approved billing account to enable Blaze, then store the key with `firebase functions:secrets:set OPENROUTER_KEY --project caption-ai-tpark`. Build without emulator environment variables and deploy with `firebase deploy --project caption-ai-tpark`. The frontend Firebase configuration is public project metadata; provider credentials are server secrets.

Google sign-in and anonymous sessions are enabled. Guests read without a sign-up screen. Only Google accounts sync libraries. The authenticated API verifies Firebase tokens and limits shared usage. Firestore rules deny access to all server-only data. Set a Firestore TTL on `quotas.expiresAt` after billing is enabled to expire quota records.

Personal API connections also require `PROVIDER_ENCRYPTION_KEY`, a base64-encoded 32-byte random key, in Firebase Secret Manager. Configure it with `firebase functions:secrets:set PROVIDER_ENCRYPTION_KEY --project caption-ai-tpark`. Keep it stable while encrypted connections exist. Rotate it only with a migration that decrypts existing records with the previous key and encrypts them with the new key. Never put the key in a frontend environment variable.

For the live connection-store check, start Firestore and set the ignored local owner key, then run `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node functions/src/provider-store.integration.mjs`. It validates OpenRouter model discovery and account-scoped encrypted storage and removes its test connection.
