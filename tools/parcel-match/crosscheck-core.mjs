// Cross-checks for the records that an exact parcel match could not place. Pure: no network, no store.
// A check records what the official data says and whether it agrees with the list. Nothing here matches a record.
// A candidate is an official position for the owner to verify. A manufactured home never receives a land parcel:
// its candidate can only be an official address point for its own lot.
import {parseAddress} from '../../netlify/lib/parcel-match.mjs';

const ACRE_M2 = 4046.8564224;
const METRES_PER_DEG_LAT = 110950;
const METRES_PER_DEG_LON_EQUATOR = 111320;

// Area of a ring in acres. Equirectangular at the ring's mean latitude, under 1 percent error at parcel scale.
export function polygonAcres(ring) {
  const lat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  let twiceArea = 0;
  for (let i = 0; i < ring.length - 1; i++) twiceArea += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  const squareMetres = (Math.abs(twiceArea) / 2) * METRES_PER_DEG_LON_EQUATOR * Math.cos(lat * Math.PI / 180) * METRES_PER_DEG_LAT;
  return squareMetres / ACRE_M2;
}

// The assessor's acreage against the drawn parcel: they agree within 0.001 acre or 2 percent. Null when there is no figure.
export function acreageAgrees(polygon, assessor) {
  if (!Number.isFinite(assessor) || assessor <= 0) return null;
  const diff = Math.abs(polygon - assessor);
  return diff <= 0.001 || diff <= 0.02 * assessor;
}

const words = text => String(text ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

// Every word of the list's owner name appears in the official owner name.
export function ownerAgrees(listOwner, officialOwner) {
  const want = words(listOwner), have = new Set(words(officialOwner));
  return want.length > 0 && have.size > 0 && want.every(w => have.has(w));
}

const GENERIC = new Set(['ADD', 'ADDN', 'ADDITION', 'ADDITIONS', 'SUBD', 'SUBDIVISION', 'OF', 'THE', 'AND', 'BLK', 'BLKS', 'BLOCK',
  'PT', 'PART', 'LOT', 'LOTS', 'PLAT', 'TOWN', 'SUB', 'OL', 'OLA', 'OUTLOT']);
// The most distinctive word of a subdivision name ("Kimberly Village 1st Addition" -> "KIMBERLY").
const distinctive = name => words(name).filter(w => !GENERIC.has(w) && w.length >= 3).sort((a, b) => b.length - a.length)[0] || null;

// True when the legal description names the subdivision the parcel lies in. Null when either is missing.
export function legalNamesSubdivision(legal, subdivision) {
  const key = distinctive(subdivision);
  if (!legal || !key) return null;
  return new Set(words(legal)).has(key);
}

// The official tax jurisdiction against the city-limits layer at the parcel's point. Null when either is missing.
export function jurisdictionAgrees(taxJurisdiction, inCityLimits) {
  if (!taxJurisdiction || typeof inCityLimits !== 'boolean') return null;
  const juris = String(taxJurisdiction).toUpperCase();
  return inCityLimits ? juris.includes('CITY OF') : !juris.includes('CITY OF');
}

// 'strong' only when every official check that applies agrees; anything else goes to the owner as 'review'.
export function strengthOf(checks) {
  return ['owner', 'acreage', 'legal', 'jurisdiction'].every(key => checks[key] === true) ? 'strong' : 'review';
}

// A lot number as written: leading zeros dropped, letters kept ("008B" -> "8B", "076" -> "76").
export const normUnit = value => String(value ?? '').trim().toUpperCase().replace(/^0+(?=\d)/, '');

// "5112 N Fairmount St Lot 076" -> {base: "5112 N Fairmount St", unit: "76"}. Null when the text has no lot number.
export function splitLot(address) {
  const m = String(address ?? '').trim().match(/^(.*?\S)\s+(?:lot|lt|l0t)\s*(\d+[A-Za-z]?)\s*$/i);
  return m ? {base: m[1], unit: normUnit(m[2])} : null;
}

const streetOf = text => parseAddress(String(text ?? '').replace(/\s+LOT\s+\S+\s*$/i, ''));

// Official address points for one lot: the same number, the same street and the same LOT unit, with coordinates.
export function lotPoints(rows, base, unit) {
  const want = parseAddress(base);
  if (!want.number || !want.street) return [];
  return rows.filter(a => a.UNITTYP === 'LOT' && normUnit(a.UNITID) === normUnit(unit) && Number.isFinite(a.LAT) && Number.isFinite(a.LONG)
    && streetOf(a.STRADD).number === want.number && streetOf(a.STRADD).street === want.street);
}

// True when the county has any address point on this street, whatever the unit.
export function streetHasAddressPoints(rows, base) {
  const want = parseAddress(base);
  return rows.some(a => streetOf(a.STRADD).number === want.number && streetOf(a.STRADD).street === want.street);
}

// Parcels at the same street number and street. Land context only: never a position for a manufactured home.
export function parcelsAtAddress(rows, base) {
  const want = parseAddress(base);
  if (!want.number || !want.street) return [];
  return rows
    .filter(r => {
      const p = parseAddress(r.PropertyAddress);
      return p.number === want.number && p.street === want.street;
    })
    .map(r => ({pin: r.PIN, owner: r.DeedHold || null, propClass: r.PropClass || null}));
}

// The official parcel polygon as a candidate: its point is inside it, and its acreage is computed from it.
export function parcelPolygon(ring, point) {
  return {precision: 'parcel_polygon', point, boundary: ring, acres: Math.round(polygonAcres(ring) * 10000) / 10000};
}

export function firstLine(text, max = 240) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
}
