# Mobile, maps and UI audit (2026-11-18)

Method: Playwright on 12 pages x 4 screen sizes (iPhone 390, Android 412, tablet 820, desktop 1440); Lighthouse mobile on production (baseline) and on matching local copies of main vs this branch (same server, so the comparison is fair). Netlify preview Lighthouse numbers are NOT comparable (the preview adds about 1.6 MB of its own toolbar and blocks indexing).

## Findings
| Priority | Finding | Status |
|---|---|---|
| 1 | 404 buttons/links under 40px on phones and tablets (footer links, logo link, back-to-top, Radar chips, Sign Up) | Fixed for touch screens: 404 to 239. The rest are map pins, left alone on purpose (enlarging would overlap) |
| 2 | Header logo squashed on phones; 96 KB file for a 44px logo | Fixed: 32 KB, no distortion |
| 3 | No skip-to-content link for keyboard and screen reader users | Added (shows on first Tab) |
| 4 | Land page: production LCP 5.2s, a map tile loads late | Added preconnect to the map hosts. NOT proven: could not reproduce 5.2s locally; re-check on production after release |
| 5 | AI and Portfolio pages had no page description | Added (they stay hidden from search on purpose) |
| 6 | Home page logs a 402 console error for signed-out visitors (weather call) | Expected; left alone |

## Verified fine
- No horizontal scrolling on any of 12 pages at 4 sizes. No broken images. No unlabeled buttons.
- Reduced motion respected (0 looping animations). Visible focus ring on every tab stop checked. Dark colors consistent on 5 pages.
- Production Lighthouse (mobile): 98, 100, 80 (Land), 100, 100, 100 performance; accessibility 100 on all six.

## Same-server comparison (main vs branch)
Page weight 63 KB lower on every page (logo). Performance scores equal or +1 to +2; Portfolio LCP 3.0s to 2.6s. No regressions.

## Not done / decisions
- Bottom navigation bar: not added. Header navigation works at 390px and nothing in testing showed users failing to reach a section; adding it would cover content. Can be revisited with real usage data.
- Marker clustering, parcel boundary and map synchronization audit, parcel-card placeholders: not changed in this pass.
- Screenshots: tools/mobile/shots/before and /after (12 pages x 4 sizes).
