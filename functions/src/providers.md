# Personal AI connections

`providers.mjs` owns fixed provider endpoints, model discovery, request formats, and stream normalization. API providers are OpenRouter, OpenAI, Anthropic, and Meta. Connecting validates the supplied key through model discovery. Only enabled models may be used. Each provider uses its native protocol. Web search is disabled. Failed personal requests never switch provider or use the shared owner key.

`provider-store.mjs` owns account-scoped connections. Only the authenticated Google account may list or mutate its records. API responses omit credential records. Credentials use AES-256-GCM with a fresh nonce and account/connection additional authenticated data. The encryption key is a Firebase server secret. Firestore client rules deny access to connection collections. Disconnect removes the stored credential. Personal asks are limited per user per minute and never consume the shared ask quota. Provider list and connect calls share the import quota.

ChatGPT subscription support is deferred for now. No subscription tokens are requested or used. When this work resumes, use a supported authorization flow with explicit inference permission; never reuse another application's client identity or treat identity-only sign-in as inference authorization.
