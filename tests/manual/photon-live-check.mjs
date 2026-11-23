// MANUAL, network-dependent check. Not run in CI. Sends three real address queries to the public Photon geocoder (free, no key).
// Run from the repo root: node tests/manual/photon-live-check.mjs
// LIVE call to the public Photon geocoder (free, no key), same request shape as
// netlify/functions/owner-brain-photon-auto.mjs search(). Three queries only.
const queries = ['2 Woodward Ave, Detroit, MI', '1 Hudson Pl, Detroit, MI', '1200 Sixth Ave, Detroit, MI'];
const out = [];
for (const q of queries) {
  const url = 'https://photon.komoot.io/api/?' + new URLSearchParams({q, limit: '3', lang: 'en'});
  const t = Date.now();
  const r = await fetch(url, {headers: {Accept: 'application/json', 'User-Agent': 'PricePocketAsset-AddressResearch/1.0 (https://pricepocketasset.com)'}, signal: AbortSignal.timeout(8500)});
  const raw = await r.text();
  const data = JSON.parse(raw);
  const feats = Array.isArray(data.features) ? data.features : [];
  const first = feats[0];
  const [lon, lat] = first?.geometry?.coordinates || [];
  const inMichigan = Number.isFinite(lat) && Number.isFinite(lon) && lat > 41.6 && lat < 48.4 && lon > -90.5 && lon < -82.1;
  out.push({query: q, http: r.status, ms: Date.now() - t, results: feats.length,
    top: first ? {name: first.properties?.name, street: first.properties?.street, housenumber: first.properties?.housenumber, city: first.properties?.city, state: first.properties?.state, lat: +lat.toFixed(5), lon: +lon.toFixed(5), inMichigan} : null});
}
console.log(JSON.stringify(out, null, 1));
console.log('ALL_HTTP_200=' + out.every(o => o.http === 200) + ' ALL_RETURN_RESULTS=' + out.every(o => o.results > 0));
