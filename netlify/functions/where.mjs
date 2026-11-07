// "Which state are you in?" Two ways, neither stores anything:
//  1) GET: a guess from the visitor's connection (Netlify geo), no permission popup, approximate.
//  2) GET ?lat=&lon=: the visitor tapped "Use my exact location"; we ask the US Census which state those coordinates are in.
// Coordinates are used for that one lookup only. They are not saved or logged.
const hits = new Map();
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function lookup(lat, lon) {
  const url = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=' + lon.toFixed(5) + '&y=' + lat.toFixed(5) + '&benchmark=Public_AR_Current&vintage=Current_Current&layers=States&format=json';
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(process.env.CENSUS_URL || url, { signal: ctl.signal });
    if (!r.ok) return null;
    const d = await r.json();
    const s = d && d.result && d.result.geographies && d.result.geographies.States && d.result.geographies.States[0];
    return s && /^[A-Z]{2}$/.test(s.STUSAB) ? { state: s.STUSAB, name: s.NAME } : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}

export default async (req, context) => {
  if (req.method !== 'GET') return json(405, { error: 'Use GET.' });
  const u = new URL(req.url);
  if (u.searchParams.has('lat') || u.searchParams.has('lon')) {
    const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
    const now = Date.now(), rec = (hits.get(ip) || []).filter(t => now - t < 600000);
    if (rec.length >= 20) return json(429, { error: 'Too many tries. Please wait a few minutes.' });
    rec.push(now); hits.set(ip, rec);
    const lat = Number(u.searchParams.get('lat')), lon = Number(u.searchParams.get('lon'));
    if (!isFinite(lat) || !isFinite(lon) || lat < 17 || lat > 72 || lon < -180 || lon > -60) return json(200, { state: null, reason: 'outside' });
    const r = await lookup(lat, lon);
    return json(200, r ? { state: r.state, name: r.name, source: 'exact' } : { state: null, reason: 'not found' });
  }
  const geo = (context && context.geo) || {};
  const country = geo.country && geo.country.code;
  const sub = geo.subdivision && geo.subdivision.code;
  if (country === 'US' && sub && /^[A-Z]{2}$/.test(sub)) return json(200, { state: sub, name: (geo.subdivision && geo.subdivision.name) || sub, source: 'connection' });
  return json(200, { state: null, country: country || null });
};
