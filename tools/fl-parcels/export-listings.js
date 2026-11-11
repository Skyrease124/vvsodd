// Lists every unique Florida county + parcel in the site's lien files (liens-*.js), for the parcel backfill.
// Usage: node export-listings.js > work/listings.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR = path.join(__dirname, '../../kinvest-liens/liens/states/');
const ctx = { LIENS: [] }; vm.createContext(ctx);
for (const f of fs.readdirSync(DIR).filter(f => /^liens-.*\.js$/.test(f) && f !== 'liens-data.js')) vm.runInContext(fs.readFileSync(DIR + f, 'utf8'), ctx);
const seen = new Map();
for (const l of ctx.LIENS) {
  if ((l.state || 'FL') !== 'FL') continue;
  const k = l.county + '|' + l.parcel;
  const e = seen.get(k) || { county: l.county, parcel: l.parcel, listings: 0, use: l.use || '', desc: (l.desc || '').slice(0, 80) };
  e.listings++; seen.set(k, e);
}
process.stdout.write(JSON.stringify([...seen.values()]));
