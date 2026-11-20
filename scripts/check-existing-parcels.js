'use strict';
const fs = require('node:fs');
const { validateCountyImport } = require('../netlify/lib/county-import-validation');
function checkExistingParcelDataset(data, state) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.p || typeof data.p !== 'object' || Array.isArray(data.p)) throw new TypeError('Expected existing parcel geometry dataset with p object');
  const entries = Object.entries(data.p);
  const result = validateCountyImport(entries.map(([parcelId]) => ({ parcelId })), { state, county: data.county });
  const issues = [...result.rejected];
  entries.forEach(([parcelId, parcel], index) => {
    const errors = [];
    if (!parcel || typeof parcel !== 'object' || Array.isArray(parcel)) errors.push('Invalid parcel geometry entry');
    else {
      if (parcel.bb !== undefined && (!Array.isArray(parcel.bb) || parcel.bb.length !== 4 || parcel.bb.some(v => !Number.isFinite(v)))) errors.push('Invalid bounding box');
      if (parcel.g !== undefined && !Array.isArray(parcel.g)) errors.push('Invalid geometry');
    }
    if (errors.length) issues.push({ index, parcelId, errors });
  });
  return { summary: { ...result.summary, rejected: issues.length, format: 'existing-parcel-geometry', source: data.source || null }, errors: issues, readyToPublish: result.readyToPublish && issues.length === 0 };
}
module.exports = { checkExistingParcelDataset };
if (require.main === module) {
  const [file, state] = process.argv.slice(2);
  if (!file || !state) { console.error('Usage: node scripts/check-existing-parcels.js <file.json> <STATE>'); process.exitCode = 2; }
  else {
    try {
      const report = checkExistingParcelDataset(JSON.parse(fs.readFileSync(file, 'utf8')), state);
      console.log(JSON.stringify({ ...report, errors: report.errors.slice(0, 25) }, null, 2));
      if (!report.readyToPublish) process.exitCode = 1;
    } catch (e) { console.error(e.message); process.exitCode = 1; }
  }
}
