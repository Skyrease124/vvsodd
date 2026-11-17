// RentCast property records for lots in states where the site has no owner / property data (everything except Florida,
// which uses the Florida DOR tax roll). The plan allows ~50 requests a month, so:
//  - a monthly counter in Blobs stops at CAP (45, leaving room for the owner's tests)
//  - every answer is saved in Blobs for 180 days, so the same spot never costs twice
import * as auth from './auth.mjs';
import * as KEYS from './apikeys.mjs';
import { stateAt } from './govdata.mjs';
const BASE = process.env.RENTCAST_BASE || 'https://api.rentcast.io/v1';
export const CAP = Number(process.env.RENTCAST_MONTHLY_CAP || 45);
const month = () => new Date().toISOString().slice(0, 7);
export async function usedThisMonth() { const c = await auth.kvGet('rentcast-count-' + month()); return (c && c.n) || 0; }
// Same, by street address (used by PricePocket AI for parcels on our lists). Florida is handled by the DOR tax roll instead.
export async function byAddress(address) {
  await KEYS.load(); const key = KEYS.keyOf('RENTCAST_KEY'); if (!key) return { ok: false, reason: 'nokey' };
  const ck = 'rentcast-a-' + String(address).toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 120), hit = await auth.kvGet(ck);
  if (hit && Date.now() - hit.t < 180 * 864e5) return Object.assign({}, hit.v, { cached: true });
  const used = await usedThisMonth(); if (used >= CAP) return { ok: false, reason: 'cap', used, cap: CAP };
  await auth.kvPut('rentcast-count-' + month(), { n: used + 1, t: Date.now() });
  const r = await fetch(BASE + '/properties?' + new URLSearchParams({ address, limit: 1 }), { headers: { 'X-Api-Key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  const d = await r.json().catch(() => null);
  if (r.status === 404) { const v = { ok: true, none: true }; await auth.kvPut(ck, { t: Date.now(), v }); return v; }
  if (!r.ok) throw new Error('RentCast ' + r.status);
  const v = shape(Array.isArray(d) ? d[0] : d, null); await auth.kvPut(ck, { t: Date.now(), v }); return v;
}
function shape(p, st) {
  if (!p) return { ok: true, none: true, state: st };
  const ta = p.taxAssessments ? Object.entries(p.taxAssessments).sort((a, b) => b[0] - a[0])[0] : null, tx = p.propertyTaxes ? Object.entries(p.propertyTaxes).sort((a, b) => b[0] - a[0])[0] : null;
  return { ok: true, state: st || p.state || null, rec: { address: p.formattedAddress || '', type: p.propertyType || '', owner: p.owner && p.owner.names ? p.owner.names.join(' & ') : '', ownerType: p.owner && p.owner.type || '',
    mail: p.owner && p.owner.mailingAddress ? p.owner.mailingAddress.formattedAddress || '' : '', ownerOccupied: p.ownerOccupied, beds: p.bedrooms, baths: p.bathrooms, sqft: p.squareFootage, lot: p.lotSize, built: p.yearBuilt,
    lastSale: p.lastSaleDate ? [p.lastSalePrice || null, String(p.lastSaleDate).slice(0, 10)] : null, assessed: ta ? [Number(ta[0]), ta[1].value] : null, taxes: tx ? [Number(tx[0]), tx[1].total] : null, zoning: p.zoning || '', county: p.county || '' } };
}
export async function lookup(lat, lng, opts = {}) {
  await KEYS.load(); const key = KEYS.keyOf('RENTCAST_KEY'); if (!key) return { ok: false, reason: 'nokey' };
  const st = await stateAt(lat, lng).catch(() => null);
  if (st === 'FL' && !opts.force) return { ok: true, covered: 'FL' };
  const ck = 'rentcast-' + lat.toFixed(4) + ',' + lng.toFixed(4), hit = await auth.kvGet(ck);
  if (hit && Date.now() - hit.t < 180 * 864e5) return Object.assign({}, hit.v, { cached: true });
  const used = await usedThisMonth(); if (used >= CAP) return { ok: false, reason: 'cap', used, cap: CAP };
  await auth.kvPut('rentcast-count-' + month(), { n: used + 1, t: Date.now() });
  const r = await fetch(BASE + '/properties?' + new URLSearchParams({ latitude: lat, longitude: lng, radius: 0.05, limit: 1 }), { headers: { 'X-Api-Key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error('RentCast ' + r.status + ' ' + ((d && d.message) || ''));
  const p = Array.isArray(d) ? d[0] : null;
  let v;
  if (!p) v = { ok: true, none: true, state: st };
  else {
    const ta = p.taxAssessments ? Object.entries(p.taxAssessments).sort((a, b) => b[0] - a[0])[0] : null, tx = p.propertyTaxes ? Object.entries(p.propertyTaxes).sort((a, b) => b[0] - a[0])[0] : null;
    v = { ok: true, state: st, rec: { address: p.formattedAddress || '', type: p.propertyType || '', owner: p.owner && p.owner.names ? p.owner.names.join(' & ') : '', ownerType: p.owner && p.owner.type || '',
      mail: p.owner && p.owner.mailingAddress ? p.owner.mailingAddress.formattedAddress || '' : '', ownerOccupied: p.ownerOccupied, beds: p.bedrooms, baths: p.bathrooms, sqft: p.squareFootage, lot: p.lotSize, built: p.yearBuilt,
      lastSale: p.lastSaleDate ? [p.lastSalePrice || null, String(p.lastSaleDate).slice(0, 10)] : null, assessed: ta ? [Number(ta[0]), ta[1].value] : null, taxes: tx ? [Number(tx[0]), tx[1].total] : null, zoning: p.zoning || '', county: p.county || '' } };
  }
  await auth.kvPut(ck, { t: Date.now(), v }); return v;
}
