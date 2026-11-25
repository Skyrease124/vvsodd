# Brain-to-Map release readiness (PR #454)

This checklist is for a staged review, **not** authorization to merge, deploy, or start the scheduler.

## Verified in repository / CI

- Public map and Workshop share the correction merger; owner MapTiler preview uses the same verified feed.
- Loaded counties refresh in rotating batches of eight, without redrawing an offscreen county on mobile.
- Public correction endpoint is GET-only and excludes incomplete publication records.
- Wayne worker is scoped to Detroit official GIS with a shared 30-request/day quota and preview-only manual runs.
- Production scheduled worker has a persistent owner-controlled toggle that defaults OFF.
- Offline GitHub Actions validation includes parcel identity, publication recovery, quota contention, and map consumers.
- The CI workflow watches the Wayne scheduled worker and GIS quota implementation on both pushes and pull requests.

## Still required before a production release

- Review PR #454's complete diff: it contains many changes beyond the latest map optimization.
- Confirm the exact Netlify deploy context, production branch and site environment; do not assume a passing CI run equals a safe production deploy.
- Test owner, Pro, Free and signed-out authorization against a **Deploy Preview** using the real server endpoints. Browser-hidden links alone are not an authorization boundary.
- Check the three map surfaces on an iPhone and desktop: verified polygon appears, pending polygon stays hidden, and rollback restores baseline.
- Verify the pilot quota and publication recovery using isolated preview storage; no live GIS requests without explicit owner approval.
- Confirm owner-visible diagnostics and a rollback procedure before merging.

## Explicit release gates

1. **No production deployment** without owner approval.
2. **No scheduler activation** until after security, preview, GIS and map validation; the owner must separately authorize it.
3. Never promote unverified parcel shapes, approximate geocodes, or tax-sale status into verified boundaries.
4. Keep the Wayne pilot isolated. Do not claim nationwide automated coverage.
5. Preserve Free/Pro 48-hour update access policy and Pro-exclusive AI, and verify these server-side before release.
