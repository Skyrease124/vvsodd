# SkyData on Netlify

SkyData was built on ChatGPT Sites, which runs it as a Cloudflare Worker with ChatGPT sign-in, a D1 (SQLite) database and R2 file storage. This folder lets **the same site code** run on Netlify with no paid add-ons beyond your Netlify plan:

| ChatGPT Sites / Cloudflare | Netlify (this adapter) |
|---|---|
| Worker `fetch(request, env, ctx)` | one Netlify Function (`/*`, static files win) |
| D1 database (`env.DB`) | **Netlify Database** (Postgres): `src/d1.mjs` translates SkyData's SQLite SQL |
| R2 bucket (`env.FILES`) | **Netlify Blobs**: `src/r2.mjs`, including multipart uploads and range reads |
| Static assets (`env.ASSETS`) | Netlify CDN; the two protected downloads are embedded in the function |
| "Sign in with ChatGPT" identity headers | **removed on every request** (anyone could fake them); SkyData's own email + password login is the only way in |
| Owner recognised by ChatGPT sign-in | one-time **owner setup** at `/owner-setup` with a secret code (also resets the owner password) |
| Site secret key from the platform | `SKYDATA_SECRET_KEY` env var, or generated once and kept in Blobs |

## What changed in SkyData's own code

Only for the Netlify build (`VITE_SKYDATA_NETLIFY=1`); the normal build is unchanged, so publishing to ChatGPT Sites still works as before:
- Upload pieces are 3 MB instead of 8 MB (projects) and 5 MB (knowledge), because a Netlify Function accepts at most ~6 MB per request.
- **Invite links** (`lib/member-invites.ts`) replace "Verify email with ChatGPT". Approving an email on `/owner` shows a private one-time link (7 days); the member opens `/invite?t=…`, sees their approved email and creates a password, and is signed in. **Create sign-up link** / **Password reset link** on each member makes a new link (older ones stop working); revoking or banning cancels it. Only the link's SHA-256 is stored (`member_invites`, migration `20261014200000`).

## Build

```sh
cd SkyData_Website
VITE_SKYDATA_NETLIFY=1 npm run build                 # the site, with Netlify upload sizes
cd netlify-adapter && npm ci
node build.mjs <deploy-folder> <owner-setup-code-file>  # the code file must be outside the deploy folder
```

`<deploy-folder>` is a complete Netlify project: `public/` (pages and assets), `netlify/functions/skydata/` (the server), `netlify/database/migrations/` (tables, applied by Netlify on deploy), `netlify.toml`, `package.json` (`@netlify/database` must be listed for Netlify to create the database). The owner setup code is written only to `<owner-setup-code-file>`; the deploy contains just its SHA-256.

## Deploy

Functions and the database need a real deploy (Netlify CLI, the Netlify MCP deploy, or Git), **not** drag-and-drop, which only publishes static files.

After the first deploy:
1. Open `https://<site>/owner-setup`, enter the setup code and choose the owner password (12+ characters).
2. Sign in at `/login` with `skyariasa@gmail.com` and that password.
3. Re-enter AI keys on the owner pages (`/connect`, `/owner/models`, `/owner/voice`). They are stored encrypted in the database.
4. Pair the HP runner again from **Engineering → Runner** (the new site has its own pairing).

Optional environment variables (Netlify → Site configuration → Environment variables, scope **Functions**): any of the keys SkyData reads (`NVIDIA_API_KEY`, `GEMINI_API_KEY`, `AWS_*`, `SKYDATA_BROWSER_*`, …) and `SKYDATA_SECRET_KEY` (64 hex characters) to keep the encryption key outside the data stores.

## Tests

```sh
cd netlify-adapter && node test/d1.test.mjs                          # adapter unit tests on real Postgres
cd .. && node netlify-adapter/test/run-repo-tests.mjs                # SkyData's own Worker tests: Cloudflare vs Netlify storage
node netlify-adapter/test/run.mjs <deploy-folder> <code-file> <out>  # browser end-to-end on a local Netlify stand-in
node netlify-adapter/test/invites.e2e.mjs <deploy-folder> <code-file> # invite links, resets, expiry, revoke
node netlify-adapter/test/engineering.e2e.mjs <deploy-folder> <code-file>      # Engineering/Superpowers: every workflow, each model (AI stand-in)
node netlify-adapter/test/runner.e2e.mjs <deploy-folder> <code-file> public/SkyData_HP_Runner_v2_5_0.zip  # HP runner from the ZIP + real Docker + REA 6.5.0
```

## Known differences on Netlify

- **Your existing data stays on ChatGPT Sites.** The Netlify site starts with an empty database and file store.
- **New members join with an invite link** instead of "Sign in with ChatGPT". The link proves the person is the one the owner sent it to; SkyData does not send email itself, so the owner sends the link (the dashboard prepares the message).
- **ChatGPT connectors** (the platform's app connectors) are unavailable; the site already shows them as not connected.
- **Limits:** 60 s per request (very long streamed replies are cut off), ~6 MB per request body, ~4 KB for all environment variables together.
- **Cost:** Netlify Database uses your plan's credits for compute; check usage in the Netlify dashboard.
