# PricePocketAsset: Free vs Pro security audit (2026-11-18)

Scope: backend permissions, AI spending controls, account and portfolio protection, owner tools, Stripe subscription handling.
Method: every Netlify function was loaded in-process with a throwaway store and **synthetic accounts** (anonymous, Free, Pro, canceled-but-paid, expired, turned-off, a second Pro member, and an owner). No real accounts, keys or customer data were used or are shown here.
Nothing about Stripe pricing, payment configuration or existing accounts and portfolios was changed.

Severity: **High** = money or broad data exposure, easy to exploit. **Medium** = real weakness with a realistic path. **Low** = small leak or hardening gap.

## A. Confirmed vulnerabilities (reproduced with a test, then fixed)

| # | Severity | Finding | Proof (before) | Fix | Proof (after) |
|---|---|---|---|---|---|
| C1 | **High** | **AI daily spending cap could be bypassed by sending requests at the same time.** The cap was checked first but each request was only counted after the AI answered, so every simultaneous request passed the check. | Daily limit set to 3. 40 simultaneous questions from one Pro account: 30 accepted, **60 calls reached the AI provider** (20x the limit). | `usage.take()` reserves a slot before any AI call (serialized), counts a per-member daily cap too (default 120, `AI_PER_USER_DAILY`), and the next request is refused. Applies to PricePocket AI, the question box and the screener. | Same burst: **3 accepted, 37 refused**, 6 provider calls (each accepted question uses at most 2). |
| C2 | **Medium-High** | **The Pro-only "owner mailing address, absentee flag, fiduciary and last sale" data was in public files.** The lock was only a button hidden in the browser; anyone could open the county parcel file directly. | 2,162 parcels in 17 Florida county files exposed the four fields to Free and signed-out visitors. | Fields moved to `netlify/private/roll/` (not published). New paid-only endpoint `roll.mjs` serves one parcel at a time (120 per hour per member). The lot card and the AI read from it. Nothing was deleted: every value was written to the private files first and counted. | 29 public parcel files: **0** private fields. A known private mailing address appears in **no** public file. Free/anonymous/expired/turned-off get 402. Pro, canceled-but-paid and owner get the data. Pro browser check shows the address; Free shows the upgrade note. The AI "out-of-state owners" search still works (34 matches). |
| C3 | **Medium** | **Unlimited password guessing across IP addresses.** The only limit lived in one server instance's memory and was per IP. | 60 wrong passwords against one account from 60 IPs: **all 60 tried, none slowed**. | Stored (all-instance) limits: 10 wrong passwords per account lock sign-in for 15 minutes (the password-reset email still works); 40 attempts per IP per 10 minutes. | Same attack: 10 tried, then **50 refused (429)**. A correct sign-in clears the counter. |
| C4 | **Low-Medium** | **Signing out did not end the session.** A copied session cookie kept working for up to 30 days. | After logout the same cookie was still signed in. | Each session now has an id; logout records it as ended. Older cookies from before this change are cut off at their owner's next logout. | After logout the same cookie is signed out. |
| C5 | **Low** | **Public setup endpoint showed the last 4 characters of the AI API key** to anyone. | Anonymous GET returned the key hint. | Only the signed-in owner sees details; the public sees only whether the question box is on. | Anonymous GET: `{"enabled":true}`. |
| C6 | **Low** | **Sign-in accepted a multi-megabyte password field** (wasted work, easy to abuse). | 5 MB password: processed. | Over 200 characters is refused before any hashing. | 5 MB password: 400. |
| C7 | **Low** | **No browser security headers** other than HSTS: the site could be framed by other sites (clickjacking) and files could be content-sniffed. | Live site: no X-Frame-Options, no X-Content-Type-Options, no Referrer-Policy. | Added in `netlify.toml`: X-Frame-Options, `frame-ancestors 'self'`, nosniff, Referrer-Policy, Permissions-Policy. A full Content Security Policy is intentionally **not** added yet (the maps load from many hosts and could break). | To be confirmed on the Netlify preview (see below). |

Also hardened (no exploit shown, same pattern as C3): guessing the owner setup code was limited only per IP in one instance's memory. It now also has a stored global limit of 20 tries per hour across signup, claim and setup.

## B. Verified working (no change needed)

* **Pro gate, backend:** 17 Pro-only endpoints x 8 account types = **136 checks, 0 unexpected**. Anonymous, Free, expired and turned-off accounts are refused (401/402/403); Pro and canceled-but-still-paid accounts are allowed. Direct URLs and manual requests get the same answer as the website.
* **Owner tools:** 30 owner-only actions (keys, OCR, Stripe setup, member tools, codes, mail setup, imports review, digest, estate links) x 8 account types = **240 checks, 0 unexpected**. Every one refuses non-owners.
* **Own data only:** another member cannot read, overwrite or delete your portfolio entries, favorites or research notes by guessing ids or reusing keys; the account response contains no password hash, salt, reset token, Stripe id or session data.
* **Password reset:** same answer for real and unknown emails; wrong token refused; token works once; old sessions end after a reset.
* **Turned-off accounts** are signed out immediately.
* **Stripe webhook:** unsigned and badly signed events refused; the same event twice is handled once.
* **Subscription lifecycle:** active turns Pro on; "cancel at period end" keeps access to the paid date; canceled/deleted never extends the paid date; after the paid date the account is Free; past-due and unpaid never extend access; renewal turns it back on.
* **Public data endpoints** (flood, soil, wetlands) refuse 300,000-point polygons; background news only accepts counties on our list; account responses are not cacheable.
* **Regressions:** all existing suites still pass (14 Netlify suites, import, auction-update and radar tests, data-status and calculator tests).

## C. Potential risks (not confirmed as exploitable, or a product decision)

| # | Severity | Risk | Recommendation |
|---|---|---|---|
| P1 | Medium | **Refunds and chargebacks only flag the account; they do not turn access off.** Access ends on the paid date. A member could dispute a charge and keep access until then. | Decide a policy (for example, remove access on a dispute). Easy to add. |
| P2 | Low-Medium | **Other rate limits are still per server instance** (question-box and screener per IP, watchlist, listings, county lookups). A determined caller spread across instances gets more than the stated limit. Money is protected by C1; these are courtesy limits. | Move them to the stored limiter (`lib/ratelimit.mjs`) or add Netlify rate-limit rules. |
| P3 | Low | **Account lockout can be used to annoy someone:** an attacker can keep an account locked for 15 minutes at a time. The password-reset email still works. | Accepted trade-off; alert the owner on repeated lockouts if it appears. |
| P4 | Low-Medium | **Owner names and some mailing addresses appear in public county list files** (for example buyer mailing addresses on Wayne County results). They are public records copied from official lists and are shown to Free members, which does not match the plan text "owner mailing details" for Pro. | Product decision: either keep them free and edit the plan text, or move them behind the same private endpoint as C2. |
| P5 | Low | **Lapsed members can still upload listing photos** (storage use). Posting a listing is correctly blocked. | Require an active membership for photo uploads. |
| P6 | Low | **Password rules are only "8 to 200 characters"**, with no check against common or leaked passwords. | Add a common-password list. |
| P7 | Low | **Reset emails: timing may differ** for existing and unknown accounts (a sent email takes longer), which could reveal which emails have accounts. Responses are identical. | Send reset emails in the background. |
| P8 | Low | **`take()` is serialized inside one instance;** across instances there is still a tiny read-then-write window per request. | Acceptable; use a counter service if spend grows. |
| P9 | Info | The billing status endpoint tells anyone whether Stripe is configured and in live or test mode. | Return it only to signed-in users if desired. |
| P10 | Info | Owner pages (`/owner/*`, `/admin/*`) are public HTML. The data behind them is protected on the server, so the page alone shows nothing. | None needed. |
| P11 | Info | The payment-failed and dispute webhook handlers call Stripe's API, so they could not be exercised offline. | Check once with Stripe's test-mode "send test webhook" after deploying. |

## D. Not touched
Stripe prices and payment configuration, subscriptions, existing accounts, portfolios and favorites, the owner account, and all unrelated features.

## E. How to re-run
`node tools/security/all.mjs` runs every security test. Details in `tools/security/README.md`.
