// Run: node netlify/tests/weather.test.mjs   (mocked National Weather Service API)
import assert from 'node:assert/strict';
const { default: api } = await import('../functions/weather.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const future = new Date(Date.now() + 3600e3).toISOString(), past = new Date(Date.now() - 3600e3).toISOString();
const feat = (event, exp, extra = {}) => ({ id: 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.abc', properties: Object.assign({ id: 'urn:oid:2.49.0.1.840.0.abc', event, severity: 'Moderate', headline: event + ' issued', areaDesc: 'DeSoto, FL', senderName: 'NWS Tampa Bay', status: 'Actual', sent: past, expires: exp }, extra) });
let mode = 'ok', calls = [], lastHeaders; globalThis.fetch = async (u, o) => { calls.push(String(u)); lastHeaders = o && o.headers; if (mode === 'down') throw new Error('net'); if (mode === 'http') return { ok: false, status: 503 }; if (mode === 'junk') return { ok: true, json: async () => ({ nope: 1 }) };
  return { ok: true, json: async () => ({ features: mode === 'none' ? [] : [feat('Flood Warning', future), feat('Test Message', future, { status: 'Test' }), feat('Old Watch', past), feat('Tornado Warning', future, { severity: 'Extreme' })] }) }; };
const call = async (lat, lng, ip = '1.1.1.1') => { const r = await api(new Request('http://x/f?lat=' + lat + '&lng=' + lng, { headers: { 'x-nf-client-connection-ip': ip } }), {}); return { s: r.status, j: await r.json(), h: r.headers }; };
let r = await call(27.35001, -81.79001); ok(r.j.ok && r.j.alerts.length === 2 && r.j.alerts[0].event === 'Tornado Warning' && r.j.alerts[1].event === 'Flood Warning', 'returns real alerts only (test messages and expired ones dropped), most severe first');
ok(/^https:\/\/api\.weather\.gov\/alerts\/urn:oid:/.test(r.j.alerts[0].link) && r.j.alerts[0].expires === future, 'each alert carries its type, expiry and an official NWS link');
ok(/PricePocketAsset/.test(lastHeaders['User-Agent']) && !/@/.test(lastHeaders['User-Agent']) && calls[0].includes('/alerts/active?point=27.35,-81.79'), 'backend call uses an identifying User-Agent (no personal details) and the point endpoint with latitude,longitude');
const n = calls.length; await call(27.35001, -81.79001); ok(calls.length === n, 'repeat lookups for the same point are cached briefly');
mode = 'none'; r = await call(28.1, -81.1); ok(r.j.ok === true && r.j.alerts.length === 0, 'successful lookup with zero results: ok:true and an empty list ("No active alerts")');
for (const m of ['down', 'http', 'junk']) { mode = m; r = await call(28.2 + (m === 'http' ? 0.1 : m === 'junk' ? 0.2 : 0), -81.2); ok(r.j.ok === false && !r.j.alerts, 'failed lookup (' + m + ') is ok:false, never an empty list'); }
mode = 'ok'; ok((await call(40, -81)).s === 400 && (await call('x', -81)).s === 400, 'points outside Florida or invalid are refused');
console.log('\n' + pass + ' checks passed');
