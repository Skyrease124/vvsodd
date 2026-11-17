// "What's the weather in Fulton County?" for PricePocket AI. Only for states and counties that have lists on the site.
// Place: county (from lien-summary.js) -> Census TIGERweb county interior point; state -> Census state interior point.
// Weather: WeatherAPI (lib/wx.mjs) + official NWS alerts. Nothing is invented: the reply is built from those numbers.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
import * as W from './wx.mjs';
import { lookup as nwsAlerts } from '../functions/weather.mjs';
import * as GOV from './govdata.mjs';
import * as EN from './energy.mjs';
import * as FIRMS from './firms.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIPS = {AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56'};
const CITY = { 'City of Rochester|NY': [43.1566, -77.6088] };
let SUM = null;
function summary() {
  if (SUM) return SUM;
  const root = process.env.LAMBDA_TASK_ROOT || process.cwd();
  const dir = [path.join(root, 'kinvest-liens/liens/states'), path.join(HERE, '../../kinvest-liens/liens/states'), path.join(process.cwd(), 'kinvest-liens/liens/states')].find(d => fs.existsSync(path.join(d, 'lien-summary.js')));
  SUM = dir ? vm.runInNewContext(fs.readFileSync(path.join(dir, 'lien-summary.js'), 'utf8') + '\n;LIEN_SUMMARY', {}, { timeout: 2000 }) : [];
  return SUM;
}
export const isWeather = q => /\b(weather|forecast|rain(?:ing|y)?|temperature|temp|storms?|snow(?:ing)?|air quality|aqi|humid(?:ity)?|windy?|hot|cold|sunny|cloudy)\b/i.test(q);
// -> {kind:'county'|'state', state, county?, name} or null
export function findPlace(q, STATES, uiScope) {
  const t = ' ' + q.toLowerCase().replace(/[^a-z\s-]/g, ' ') + ' ';
  const counties = summary().map(x => ({ state: x.state, county: x.county })).sort((a, b) => b.county.length - a.county.length);
  const stInQ = STATES.filter(s => t.includes(' ' + s.n.toLowerCase() + ' ')).map(s => s.a);
  const hits = counties.filter(c => t.includes(' ' + c.county.toLowerCase().replace(/^city of /, '') + ' '));
  if (hits.length) {
    const best = hits[0].county.length, top = hits.filter(c => c.county.length === best);
    const pick = top.filter(c => stInQ.includes(c.state)).concat(top.filter(c => uiScope.includes(c.state)));
    const c = pick[0] || (new Set(top.map(x => x.state)).size === 1 ? top[0] : null);
    const nm = c2 => (/^City of /.test(c2.county) ? c2.county : c2.county + ' County') + ', ' + (STATES.find(s => s.a === c2.state) || {}).n;
    if (!c) return { ambiguous: top.map(nm) };
    return { kind: 'county', state: c.state, county: c.county, name: nm(c) };
  }
  const st = stInQ[0] || (uiScope.length === 1 ? uiScope[0] : null);
  if (st) { const s = STATES.find(x => x.a === st); const has = summary().some(x => x.state === st); return { kind: 'state', state: st, name: s.n, covered: has }; }
  return null;
}
const ptCache = new Map();
async function point(p) {
  const k = p.state + '|' + (p.county || ''); if (CITY[k]) return CITY[k]; if (ptCache.has(k)) return ptCache.get(k);
  const layer = p.kind === 'county' ? 1 : 0, where = p.kind === 'county' ? "NAME='" + p.county.replace(/'/g, "''") + " County' AND STATE='" + FIPS[p.state] + "'" : "STATE='" + FIPS[p.state] + "'";
  const u = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/' + layer + '/query?' + new URLSearchParams({ where, outFields: 'INTPTLAT,INTPTLON', returnGeometry: 'false', f: 'json' });
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) }); const d = await r.json(); const a = d.features && d.features[0] && d.features[0].attributes;
  if (!a) throw new Error('place not found'); const v = [Number(a.INTPTLAT), Number(a.INTPTLON)]; ptCache.set(k, v); return v;
}
export async function answer(p) {
  const [lat, lng] = await point(p);
  const w = await W.forecast(lat, lng, 1, 2 * 3600e3); if (!w.ok) return { ok: false, reason: w.reason };
  let alerts = []; try { const a = await nwsAlerts(lat, lng); if (a && a.ok) alerts = a.alerts.slice(0, 3); } catch (e) {}
  const d = w.days, lines = [];
  lines.push('Weather in ' + p.name + (p.kind === 'state' ? ' (center of the state, near ' + w.place.name + ')' : ' (near ' + w.place.name + ')') + ': ' + w.now.f + '°F and ' + w.now.text.toLowerCase() + ', feels like ' + w.now.feels + '°F, wind ' + w.now.wind + ' mph ' + w.now.windDir + '.');
  d.forEach((x, i) => lines.push('- ' + (i === 0 ? 'Today' : new Date(x.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' })) + ': ' + x.text + ', high ' + x.hi + '° / low ' + x.lo + '°, ' + x.rain + '% chance of rain'));
  if (w.air) lines.push('- Air quality: ' + w.air.label + (w.air.pm25 != null ? ' (PM2.5 ' + w.air.pm25 + ')' : ''));
  lines.push(alerts.length ? '- ⚠️ Official alert: ' + alerts.map(a => a.event).join('; ') + ' (National Weather Service)' : '- No active National Weather Service alerts there right now.');
  if (p.kind === 'state' && p.covered === false) lines.push('Note: we have no parcel lists in ' + p.name + ' yet.');
  lines.push('Verify: weather from WeatherAPI.com (updated ' + w.now.updated + ' local time) and alerts from the National Weather Service. For site visits, check again before you go.');
  return { ok: true, text: lines.join('\n'), point: { lat, lng } };
}

// Other place topics, answered straight from the data sources (no model).
export function topic(q) {
  if (/\b(crimes?|criminal|safe|safety|violent|burglar(?:y|ies)|thefts?|police)\b/i.test(q)) return 'crime';
  if (/\b(wild ?fires?|fires?|burning|smoke)\b/i.test(q)) return 'fires';
  if (/\b(national parks?|parks?|monuments?|trails?|recreation)\b/i.test(q)) return 'parks';
  if (/\b(solar|electric(?:ity)?|power (?:company|rates?|bills?)|utility|utilities|kwh|ev charg\w*|charging stations?|energy)\b/i.test(q)) return 'energy';
  if (isWeather(q)) return 'weather';
  return null;
}
const num = n => n == null ? 'n/a' : Number(n).toLocaleString('en-US');
export async function answerTopic(t, p) {
  if (t === 'weather') return answer(p);
  const [lat, lng] = await point(p), where = p.kind === 'state' ? ' (center of ' + p.name + ')' : '';
  if (t === 'crime') {
    const c = await GOV.crime(lat, lng); if (!c.ok) return c;
    if (c.none) return { ok: true, text: 'No police agency near ' + p.name + where + ' reported last year\u2019s crime data to the FBI.\nVerify: FBI Crime Data Explorer.', point: { lat, lng } };
    const cmp = v => v.rate == null || !v.state ? '' : v.rate > v.state * 1.25 ? ' (well above the state rate)' : v.rate < v.state * .8 ? ' (well below the state rate)' : ' (near the state rate)';
    return { ok: true, point: { lat, lng }, text: ['Crime near ' + p.name + where + ': nearest reporting agency is ' + c.agency.name + ' (' + c.year + ', whole agency area).',
      '- Violent crime: ' + num(c.violent.count) + ' reported, ' + num(c.violent.rate) + ' per 100k' + cmp(c.violent) + '; state ' + num(c.violent.state) + ', US ' + num(c.violent.us),
      '- Property crime: ' + num(c.property.count) + ' reported, ' + num(c.property.rate) + ' per 100k' + cmp(c.property) + '; state ' + num(c.property.state) + ', US ' + num(c.property.us),
      'Verify: FBI Crime Data Explorer. Counts cover the agency\u2019s whole area, not a specific lot, and are not a safety rating.'].join('\n') };
  }
  if (t === 'parks') {
    const r = await GOV.parks(lat, lng); if (!r.ok) return r;
    return { ok: true, point: { lat, lng }, text: (r.parks.length ? ['National Park Service sites nearest ' + p.name + where + ':'].concat(r.parks.map(x => '- ' + x.name + (x.type ? ' (' + x.type + ')' : '') + ': ' + x.miles + ' mi')) : ['No National Park Service sites within 120 miles of ' + p.name + where + '.']).concat(['Verify: National Park Service (straight-line distance; state and local parks not included).']).join('\n') };
  }
  if (t === 'energy') {
    const e = await EN.lookup(lat, lng); if (!e.ok) return e;
    const L = ['Energy near ' + p.name + where + ':'];
    L.push(e.solar ? '- Solar: about ' + num(e.solar.kwhYear) + ' kWh a year from a 4 kW home-size array; average sun ' + e.solar.sun + ' kWh/m\u00b2/day' : '- Solar: estimate unavailable');
    L.push(e.rates && e.rates.utility ? '- Electricity: ' + e.rates.utility + ', average ' + (e.rates.residential ? '$' + e.rates.residential.toFixed(3) + '/kWh home' : 'home rate n/a') + ' (older dataset' + (e.rates.source ? ': ' + e.rates.source : '') + '; may be out of date)' : '- Electricity: no utility found in the lab\u2019s data');
    L.push(e.ev ? '- EV charging: ' + e.ev.total + ' public stations within 25 miles' + (e.ev.stations[0] ? '; closest ' + e.ev.stations[0].name + ' (' + e.ev.stations[0].miles + ' mi)' : '') : '- EV charging: unavailable');
    L.push('Verify: National Laboratory of the Rockies (formerly NREL). Estimates, not guarantees; confirm power service with the utility.');
    return { ok: true, point: { lat, lng }, text: L.join('\n') };
  }
  if (t === 'fires') {
    const f = await FIRMS.nearby(lat, lng, p.kind === 'state' ? 50 : 25, 3); if (!f.ok) return f;
    return { ok: true, point: { lat, lng }, text: (f.total ? [f.total + ' satellite fire detection' + (f.total === 1 ? '' : 's') + ' within ' + f.radius + ' miles of ' + p.name + where + ' in the last 3 days. Closest: ' + f.fires[0].miles + ' mi (' + f.fires[0].date + ').'] : ['No active fires detected within ' + f.radius + ' miles of ' + p.name + where + ' in the last 3 days.'])
      .concat(['Verify: NASA FIRMS satellite heat detections, not official fire perimeters or evacuation orders.']).join('\n') };
  }
  return { ok: false };
}
