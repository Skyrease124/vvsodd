'use strict';

/**
 * County import validation, designed to run before any automated ingestion.
 * Pure functions: no writes, no network calls, no existing site behavior changes.
 */
const MAX_RECORDS = 100000;
const MAX_TEXT = 500;
const ID_KEYS = ['parcelId', 'parcel_id', 'parcelNumber', 'parcel_number', 'apn'];
const MONEY_KEYS = ['taxOwed', 'tax_owed', 'amountDue', 'amount_due', 'taxAmount'];
const pick = (row, keys) => keys.find(k => row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '');
const clean = value => String(value ?? '').trim();

function validateCountyImport(records, options = {}) {
  if (!Array.isArray(records)) throw new TypeError('County import must be an array');
  if (records.length > MAX_RECORDS) throw new RangeError('County import exceeds 100,000 records');
  const state = clean(options.state).toUpperCase();
  const county = clean(options.county);
  if (!/^[A-Z]{2}$/.test(state)) throw new TypeError('A two-letter state code is required');
  if (!county || county.length > 100) throw new TypeError('A valid county name is required');
  const accepted = [], rejected = [], seen = new Set();
  records.forEach((row, index) => {
    const errors = [];
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      rejected.push({ index, errors: ['Record must be an object'] });
      return;
    }
    const idKey = pick(row, ID_KEYS);
    const parcelId = idKey ? clean(row[idKey]) : '';
    if (!parcelId || parcelId.length > 100) errors.push('Missing or invalid parcel ID');
    const key = state + ':' + county.toLowerCase() + ':' + parcelId.toLowerCase();
    if (parcelId && seen.has(key)) errors.push('Duplicate parcel ID in batch');
    if (parcelId) seen.add(key);
    const moneyKey = pick(row, MONEY_KEYS);
    let taxOwed = null;
    if (moneyKey) {
      const raw = clean(row[moneyKey]);
      if (!/^\\$?\\d+(?:,\\d{3})*(?:\\.\\d{1,2})?$/.test(raw)) errors.push('Invalid tax amount');
      else {
        taxOwed = Number(raw.replace(/[$,]/g, ''));
        if (!Number.isSafeInteger(Math.round(taxOwed * 100))) errors.push('Tax amount out of range');
      }
    }
    const latitude = row.latitude ?? row.lat;
    const longitude = row.longitude ?? row.lng ?? row.lon;
    if (latitude != null && latitude !== '' && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) errors.push('Invalid latitude');
    if (longitude != null && longitude !== '' && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) errors.push('Invalid longitude');
    if (JSON.stringify(row).length > 20000) errors.push('Record too large');
    if (errors.length) rejected.push({ index, parcelId: parcelId.slice(0, 100), errors });
    else accepted.push({ ...row, parcelId, state, county, taxOwed });
  });
  return {
    summary: { received: records.length, accepted: accepted.length, rejected: rejected.length, state, county },
    accepted, rejected,
    readyToPublish: rejected.length === 0 && accepted.length > 0
  };
}
module.exports = { validateCountyImport };
