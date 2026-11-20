// Safe match of server-authorized research releases to existing parcel map coordinates.
// Never invent coordinates: only map records with an exact county, state and parcel ID match.
(function (root) {
  'use strict';
  const norm = x => String(x == null ? '' : x).trim().toLowerCase();
  const county = x => norm(x).replace(/\s+county$/, '').replace(/\s+/g, ' ');
  const valid = p => Array.isArray(p) && p.length === 2 &&
    p.every(Number.isFinite) && p[0] >= -180 && p[0] <= 180 && p[1] >= -90 && p[1] <= 90;
  function match(releases, datasets) {
    if (!Array.isArray(releases) || !Array.isArray(datasets)) return [];
    const rows = [];
    const used = new Set();
    for (const release of releases.slice(0, 150)) {
      if (!release || !release.id || !['lien','land'].includes(release.type) ||
          release.researchOnly !== true || release.availableForPurchase !== false ||
          !release.state || !release.county || !release.parcelId || used.has(release.id)) continue;
      const matches = [];
      for (const dataset of datasets) {
        if (!dataset?.meta || norm(dataset.meta.state) !== norm(release.state) ||
            county(dataset.meta.county) !== county(release.county) || !Array.isArray(dataset.recs)) continue;
        for (const parcel of dataset.recs) {
          if (norm(parcel.p) === norm(release.parcelId)) matches.push(parcel);
        }
      }
      // An ambiguous match must not gain a pin, even if one row has coordinates.
      if (matches.length !== 1 || !valid(matches[0].cx)) continue;
      rows.push({release, parcel:matches[0], coordinates:[...matches[0].cx]});
      used.add(release.id);
    }
    return rows;
  }
  const api = Object.freeze({match});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PPAResearchMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
