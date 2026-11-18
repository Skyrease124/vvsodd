# Master Class build, phase 1 (2026-11-18)

Built on the existing education system (6 full state courses, Foundations, 50-state tracker). Nothing existing was removed or rewritten; four study tools were added around it.

## What was added
| Tool | Page | Who | How it works |
|---|---|---|---|
| Learning paths | /learn/paths/ | everyone sees the map; progress when signed in | Beginner / Intermediate / Advanced over a **ten-chapter map** for each of FL, TX, AZ, IA, MI, CO. Every chapter lists the real modules and lessons that cover it, marks completed lessons from the member's saved progress, and shows locks for member-only lessons without exposing their text. |
| Searchable glossary | /learn/glossary/ | everyone | 104 terms: 23 general terms plus 81 state-specific terms from the six courses. Live search, filter by state, each state term links to its course and shows the date it was checked. State meanings are never merged into the general ones. |
| Calculation drills | /learn/drills/ | Pro (server enforced); free sees one worked example | 4 verified states (FL, AZ, IA, CO) x 3 levels. Made-up numbers; the **answer is computed on the server by the statute-checked rules engine** (`lien-rules.js`) and sent only after the member submits. Shows the working, official sources and the date the statute text was read. Progress saved to the account; the same question can't be counted twice. |
| County guides | /learn/county/ | everyone | 26 counties from our hand-checked county records: office, phone, steps to buy, official links, sale calendar and upcoming sales (official pages only), state rules and links to the state class and course. Unknown county = honest "no guide yet". |

## The ten chapters (mapped to existing modules)
1 Introduction (m1) · 2 Liens vs deeds (m1 + Foundations) · 3 Finding properties (m2, m4) · 4 Research (m5) · 5 Bidding (m3) · 6 Returns and expenses (m7) · 7 Redemption, foreclosure, deed (m8, m9) · 8 Due diligence (m6) · 9 Mistakes and risks (m7, m11) · 10 Examples and practice (m10, m12, drills).

## Tests
- `netlify/tests/masterclass.test.mjs`: 63 checks (chapter maps for all 6 courses, path progress, glossary search, drills for 4 states x 3 levels, answers never in the question, wrong/right/duplicate/tampered/other-member tokens, Free 402, signed-out 401, county pages, unknown county 404, no lesson text leaks).
- `tools/masterclass/browser.mjs`: 31 checks against the REAL functions at phone width (search, filters, chapter links, locks, drills flow, county pages, no sideways scrolling, no page errors). Screenshots in `tools/masterclass/shots/`.

## Not done (honest)
- **No new state courses.** 44 states still have only the short class. Each needs its statute read first; Illinois, California and Georgia are blocked on unreadable official sources, New Jersey is partial.
- Drills cover only the four states whose statute text we have verified. Other states stay "basic estimate" in the calculator and are not drilled.
- County guides exist for 26 counties; the buying steps are from our checks, not live county pages (county sites refuse automated checks). Registration rules and sale dates must be confirmed on the official page.
- Chapters 2 and 9 point at the nearest existing modules; a dedicated "liens versus deeds" lesson per state would be new writing.
- Not reviewed by an attorney.
