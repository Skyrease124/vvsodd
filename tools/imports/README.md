# Official-data imports (Watch This Parcel, Parcel Timeline, Nearby Tax Sale Results)

Each county list is imported as a **snapshot** and compared with the last *verified* snapshot.

| Import result | What happens |
|---|---|
| ok + complete | changes become dated events in `kinvest-liens/liens/states/timeline/<county>.json` |
| same file again (same sha256) | logged as `duplicate`, nothing changes |
| failed (unreadable) | logged, **nothing changes**, no alerts |
| incomplete (fewer than 80% of last time, or the adapter says so) | logged, **nothing changes**, no removal alerts |

* Records are keyed `state|county|parcel|certificate`, IDs kept exactly as published (leading zeros). Certificates and auction events are separate records.
* A parcel missing from a good list is only *"No longer listed. Outcome unconfirmed."* Sold/redeemed/withdrawn/canceled needs `record_outcome(...)` with an official source URL, or a published results file (`import_results`).
* Event ids are deterministic and checked before adding, so reimports never repeat an event or an alert.
* Anything ambiguous (a removed and an added parcel sharing a schedule number; a result that does not match a listed parcel) goes to `timeline/review.json`; its events stay hidden from customers until the owner approves them at `/admin/imports/`.
* `timeline/imports.json` is the import history (including failed and incomplete runs).

## Commands

```
python3 tools/imports/tests/test_importer.py                      # unit tests (fake county)
node netlify/tests/watch.test.mjs                                 # watchlist, privacy, review gating, email digest
python3 tools/imports/tests/test_wayne_prices.py <results.pdf>    # sale prices vs the official PDF
python3 tools/imports/geocode.py Wayne                            # Census geocoder for Nearby Tax Sale Results
```
Import code: see `importer.py` (`run_import`, `import_results`, `record_outcome`) and `adapters.py`. To import Larimer's nightly file:
download `https://apps.larimer.org/treasuryfiles/Advertising_Files/Real_Property_Tax_Sale.xls`, then `larimer_xls(path)` → `run_import('Larimer', recs, raw_sha=sha(bytes), apply=apply_larimer)`.

## Counties enabled

* **Larimer, CO** (Watchlist + Timeline): amount and payoff changes, parcel no longer listed / added / listed again. The county re-posts the list nightly through the sale.
* **Wayne, MI** (Timeline, Nearby Tax Sale Results, Worksheet): 2026 foreclosure list; September 2026 auction results with actual sale prices (1,437 results, total $36,445,269.02, checked against the PDF).
