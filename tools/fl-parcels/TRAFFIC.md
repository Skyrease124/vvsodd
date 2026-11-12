# Nearby Traffic (FDOT AADT)
Source: FDOT Annual Average Daily Traffic (SECTADT), free public FeatureServer (21,580 segments; count years up to 2025).
`python3 tools/fl-parcels/traffic.py [County ...] [--refresh]` matches each matched Florida lot outline to measured segments (AADT > 0) within 1,500 ft and stores ONE featured segment per parcel in `parcels/<county>.json` (`tr`):
* highest-AADT segment within 500 ft of the lot boundary; if none within 500 ft, the nearest one (shown as "farther than 500 ft", it never passes the filter);
* no segment within 1,500 ft, or no lot outline -> "Traffic data unavailable".
The card, the "Vacant lots within 500 ft of a road with 10,000+ vehicles a day" filter and the orange map line all read that same stored segment (id `COSITE:ROADWAY:BEGIN_POST`). Distance is lot boundary to road line (0 = touching), computed in a local metric projection and spot-checked against an independent spherical calculation (within 5 ft). Legal road access is a separate, always-"not verified" field: a traffic count does not show legal access. Results: 1,011 outlines checked; the filter currently matches 202 listings.

# Nearby Cleanup Sites (Florida DEP)
Live query, not stored: `netlify/functions/cleanup.mjs` proxies the DEP Cleanup Sites layer (`ags.dep.state.fl.us/.../OpenData/CLEANUP_SP/MapServer/0`, open/active/on-hold sites; it sends no CORS headers, so browsers cannot call it directly). The page measures from each site's mapped point to the lot outline (`CleanupData.measure` in `lien-ui.js`), shows sites within 1/2 mile, and says "On parcel" only when the point is inside the outline. Success with no sites -> "No mapped cleanup sites within ½ mile."; failure -> "Cleanup data unavailable." Tests: `node netlify/tests/cleanup.test.mjs`.
