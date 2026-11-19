// Run: node netlify/tests/capecoral.test.mjs   (TEST FIXTURE attribute rows in the city layer's field names)
import assert from 'node:assert/strict'; import fs from 'node:fs';
const { shape, strapOf } = await import('../../tools/capecoral/build.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
ok(strapOf('17-43-24-C1-05817.0090') === '174324C1058170090', 'Lee parcel ID format converts to the city STRAP format');
const s = shape({ Site_Address: '1 TEST ST ', Zoning: 'R1', Future_Land_Use: 'SM', Acres: 0.2, Assessed: 7260, Land: 25000, Building: 0, w_srv_avail: 'No', s_srv_avail: 'yes', Canal: '', Owlzone: 'Y', Turtlezone: null, Sale1Date: 1578373200000, Sale1Amount: 7000, Leepa_Lnk: 'https://www.leepa.org/Display/DisplayParcel.aspx?FolioID=1' });
ok(s.water === 'No' && s.sewer === 'Yes' && s.owl === 'Y' && s.turtle === '' && s.saleDate === '2020-01-07' && s.saleAmt === 7000 && s.addr === '1 TEST ST', 'fields shaped: Yes/No, blanks, sale date, trimmed text');
ok(shape({ Leepa_Lnk: 'http://evil.example/x' }).leepa === '' && shape({ Sale1Date: null, Sale1Amount: 0 }).saleDate === '', 'only https leepa.org links kept; missing sale stays empty (nothing invented)');
const d = JSON.parse(fs.readFileSync(new URL('../../kinvest-liens/liens/states/capecoral-facts.json', import.meta.url), 'utf8'));
const up = JSON.parse(fs.readFileSync(new URL('../../kinvest-liens/liens/states/upcoming-sales.json', import.meta.url), 'utf8'));
const lee = new Set(up.listings.filter(x => x.county === 'Lee').map(x => strapOf(x.parcel)));
ok(Object.keys(d.facts).length > 0 && Object.keys(d.facts).every(k => lee.has(k)), 'built facts exist only for Lee parcels on our official lists');
ok(/^https:/.test(d.source.url) && /^\d{4}-\d\d-\d\d$/.test(d.source.checked), 'source and check date recorded');
console.log(pass + ' passed');
