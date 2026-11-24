# Known issues for separate fixes

## Production API usage visibility (recorded 2026-11-24, not fixed here)

**Where:** Usage & Limits (`/usage/`).

**What happens:** The per provider allowance rows (NVIDIA, Geoapify, Wayne GIS and the intake round trip) come from
`netlify/functions/owner-brain-live-checks.mjs`. That endpoint answers 404 unless the site is a Brain preview
(`auth.isBrainPreview()`), so on production the page shows only the visitor AI count. The owner cannot see provider
usage and remaining allowances on the live site.

**Why it was left alone:** The redesign is visual only. Exposing the counters on production changes backend behaviour.

**Suggested fix (separate change, owner approval first):**
- A read only, owner gated endpoint that returns counters and configuration flags only: `usedToday`, `limitPerDay`,
  `available`. Never a key value, and it must not run any provider check.
- Reuse the existing counter functions (`usageToday`, `usedOwnBudget`) so numbers match the preview.
- Keep the `Run once` actions preview only.
- Add a test that no key or secret value can appear in the response.
