# Security tests

`node tools/security/all.mjs` runs all of these, each in a clean process with a throwaway user store and synthetic accounts (no real keys or people).

* `matrix.mjs`: every Pro-only endpoint x anonymous, Free, expired, turned-off, canceled-but-paid, Pro, owner.
* `owner.mjs`: every owner-only action x the same accounts.
* `idor.mjs`: one member cannot reach another member's portfolio, favorites or notes; reset flow; sessions; sign-in limits.
* `roll.mjs`: the Pro-only tax roll fields are served only to paid members and exist in no public file.
* `lifecycle.mjs`: subscription start, cancel, expire, failed payment and renewal through the real webhook code (signed test events).
* `attacks.mjs`: guessing across IPs, logout, oversized input, public leaks.
* `spend.mjs`: a burst of simultaneous AI questions cannot exceed the daily limit (mock AI provider).
* `split_roll.mjs`: moves the Pro-only roll fields from the public parcel files to `netlify/private/roll/` (already run; repeatable).
Reports are in `reports/`.
