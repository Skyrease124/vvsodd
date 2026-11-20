'use strict';
const fs = require('node:fs');
const path = require('node:path');
function checkMapDataset(data, filename) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { filename, errors: ['Dataset must be an object'], count: 0 };
  if (!/^[A-Z]{2}$/.test(data.state || '')) errors.push('Invalid state code');
  if (!data.county || typeof data.county !== 'string') errors.push('Missing county');
  if (!Array.isArray(data.recs)) errors.push('Missing recs array');
  if (!data.dict || typeof data.dict !== 'object' || Array.isArray(data.dict)) errors.push('Missing dictionary');
  const seen = new Set();
  (Array.isArray(data.recs) ? data.recs : []).forEach((rec, i) => {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) { errors.push('Invalid record ' + i); return; }
    if (typeof rec.i !== 'string' || !rec.i.trim()) errors.push('Missing record ID at ' + i);
    else {
      if (seen.has(rec.i)) errors.push('Duplicate record ID at ' + i);
      seen.add(rec.i);
    }
    if (rec.amt != null && (!Number.isFinite(rec.amt) || rec.amt < 0)) errors.push('Invalid amount at ' + i);
    if (rec.lat != null && (!Number.isFinite(rec.lat) || rec.lat < -90 || rec.lat > 90)) errors.push('Invalid latitude at ' + i);
    if (rec.lng != null && (!Number.isFinite(rec.lng) || rec.lng < -180 || rec.lng > 180)) errors.push('Invalid longitude at ' + i);
  });
  return { filename, state: data.state, county: data.county, count: Array.isArray(data.recs) ? data.recs.length : 0, errors: errors.slice(0, 50) };
}
module.exports = { checkMapDataset };
if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('Usage: node scripts/check-map-datasets.js <map-data.json> [...]'); process.exitCode = 2; }
  for (const file of files) {
    try {
      const report = checkMapDataset(JSON.parse(fs.readFileSync(file, 'utf8')), path.basename(file));
      console.log(JSON.stringify({ ...report, ok: report.errors.length === 0 }));
      if (report.errors.length) process.exitCode = 1;
    } catch (error) { console.error(file + ': ' + error.message); process.exitCode = 1; }
  }
}
