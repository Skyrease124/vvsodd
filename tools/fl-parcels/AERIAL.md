# County aerial imagery on the Florida parcel map

* **Outlines:** Florida Statewide Parcels (FGIO, roll data from July 2026, item modified 2026-09-30), matched by county + parcel ID exactly as listed (leading zeros kept).
* **Palm Beach: ON.** 2026 layer first, 2025 layer where 2026 has no imagery (checked live with the ImageServer `identify` call; 255 of 261 listed parcels are on 2026, 6 fall back to 2025). `aerial_coverage.py` records only the year chosen per parcel.
* **Never stored.** Palm Beach's published terms (Web Site Disclaimer, "© Copyright Palm Beach County") say nothing that clearly allows copying or redistributing its imagery, so previews are drawn live from the county service with the outline on top. Our older stored USGS NAIP previews remain as the fallback if the county image does not load.
* **Capture year** is the county's layer year (the services publish no per-image capture date).
* **Miami-Dade: OFF** (Satellite stays the default). Checked 2026-11-12 on `MapCache/MDCImagery/MapServer`:
  images load (36 of 36 requests, median 0.6 s, but one took 19 s) and line up with the parcel outlines when requested in web-mercator with `layers=show:29` (the default export also bakes in street labels). But the service labels itself 2026, 2025 and 2024 in different places, and the image tile names at 11 of 12 sample parcels start with 2024 (only 1 with 2026). Turn it on (`CountyAerial.CFG['Miami-Dade'].on`) only after the county fixes or documents the year.
