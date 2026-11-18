// Run: node netlify/tests/delinquent.test.mjs   (TEST FIXTURE data only; temp member folder)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-dq-')); process.env.SESSION_SECRET = 't';
const { build, parseCsv } = await import('../../tools/delinquent/build.mjs'); const D = await import('../lib/delinquent.mjs'); const auth = await import('../lib/auth.mjs'); const { default: fn } = await import('../functions/delinquent.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
// TEST FIXTURE: made-up people and parcels
const H = 'Owner_Name,Mailing_Address,City_State_Zip,GPIN,Situs_Address,Property_Description,District,Tax_Year,Bill_Number,Installment,Tax_Due,Penalty_Due,Interest_Due,Fee_Due,Total_Delinquent_Amount_Due,OBJECTID';
const csv = [H,
 '"ZZTEST OWNERONE, A ",12 MAIL ST,TESTVILLE FL,1000000000000 ,1 TEST AVE,"TEST SUB LOT 1, BLK 2",D01,2025,1,1,100,10,20,0,130,1',
 '"ZZTEST OWNERONE, A ",12 MAIL ST,TESTVILLE FL,1000000000000,1 TEST AVE,"TEST SUB LOT 1, BLK 2",D01,2026,2,1,100,10,5,0,115,2',
 'ZZTEST OWNERTWO,9 OTHER RD,TESTVILLE NC,2000000000000,,TEST SUB PARCEL A 0.5 AC,D02,2010,3,1,50,5,40,0,95,3',
 'ZZTEST OWNERTWO,9 OTHER RD,TESTVILLE NC,2000000000000,,TEST SUB PARCEL A 0.5 AC,D02,2011,4,1,50,5,30,0,60,4',
 'ZZTEST OWNERTHREE,1 X ST,VIRGINIA BEACH VA,3000000000000,3 BIG BLVD,BIG PLACE,D03,2026,5,1,5000,500,100,25,5625,5'].join('\n');
ok(parseCsv(csv).length === 6 && parseCsv(csv)[1][0] === 'ZZTEST OWNERONE, A ', 'csv parser keeps quoted commas');
const { parcels, summary } = build(csv, { received: '2026-11-18' });
ok(parcels.length === 3 && summary.parcels === 3, 'rows are grouped into parcels; a spaced parcel id is cleaned');
const a = parcels.find(p => p.g === '1000000000000'); ok(a.t === 245 && a.n === 2 && a.ys.join() === '2025,2026' && a.a === '1 TEST AVE', 'parcel total = sum of the city totals; years and address kept');
ok(summary.owed === 245 + 155 + 5625 && summary.noStreetAddress.parcels === 1, 'totals and the no-address count are right');
ok(summary.quality.some(q => /^1 rows have tax/.test(q)) && summary.quality.some(q => /stray spaces/.test(q)), 'rows that do not add up and stray spaces are reported');
const outText = JSON.stringify({ parcels, summary }); ok(!/OWNERONE|OWNERTWO|OWNERTHREE|MAIL ST|OTHER RD|TESTVILLE/i.test(outText), 'no owner name or mailing address reaches the output');
ok(summary.notASaleList === true && summary.notes.some(n => /not a list of properties for sale/i.test(n)), 'the output says it is not a sale list');
ok(!/for sale|available|buy now/i.test(JSON.stringify(summary.ownedBuckets) + JSON.stringify(summary.yearsBehind)), 'no sale wording in the aggregates');
// search
const s1 = D.search(parcels, { minOwed: 200 }); ok(s1.total === 2 && s1.rows[0].g === '3000000000000', 'min owed filter, biggest first');
ok(D.search(parcels, { noAddress: true }).rows[0].g === '2000000000000', 'no-address filter');
ok(D.search(parcels, { minYears: 2 }).total === 2 && D.search(parcels, { oldest: '2010' }).total === 1, 'years-behind and oldest-year filters');
ok(D.search(parcels, { q: 'test ave' }).total === 1 && D.search(parcels, { q: '2000000000000' }).total === 1 && D.search(parcels, { q: '12' }).total === 0, 'search by address or parcel id (short digit strings are not matched as ids)');
ok(D.search(parcels, { sort: 'oldest' }).rows[0].g === '2000000000000', 'sort by oldest');
ok(Object.keys(D.publicRow(parcels[0])).every(k => !/owner|mail/i.test(k)), 'public row has no owner or mailing fields');
// real data files in the repo
const real = D.loadParcels('virginia-beach'), sum = D.loadSummary('virginia-beach');
ok(real && real.p.length === sum.parcels && sum.notASaleList, 'repo data: private parcels and public summary agree (' + sum.parcels + ')');
ok(real.p.every(p => !('o' in p) && !('owner' in p) && !('mail' in p)), 'repo data: no owner or mailing keys');
// endpoint
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const mk = async (e, patch) => { const u = await auth.createUser(e, 'pw-123456', false); Object.assign(u, patch || {}); await auth.saveUser(u); return (await auth.sessionCookie(e)).split(';')[0]; };
const call = async (cookie, qs) => { const r = await fn(new Request('http://x/f?' + qs, { headers: { cookie } })); return { s: r.status, j: await r.json() }; };
const free = await mk('f@x.com'), pro = await mk('p@x.com', { paidThrough: day(20) });
let r = await call('', 'summary=1'); ok(r.s === 200 && r.j.summary.parcels === sum.parcels && !JSON.stringify(r.j).includes('"p":['), 'summary is public and has no parcel rows');
ok((await call('', 'q=a')).s === 401 && (await call(free, 'q=a')).s === 402, 'search: signed-out 401, Free 402');
r = await call(pro, 'minOwed=25000&limit=5'); ok(r.s === 200 && r.j.rows.length > 0 && r.j.rows.every(x => x.owed >= 25000) && r.j.rows.length <= 5, 'pro search works and caps the page size');
const g = r.j.rows[0].gpin; r = await call(pro, 'gpin=' + encodeURIComponent(g.slice(0, 4) + ' ' + g.slice(4))); ok(r.s === 200 && r.j.parcel.gpin === g, 'lookup by parcel id (spaces ignored)');
ok((await call(pro, 'gpin=9999')).s === 404, 'unknown parcel id is a 404, not a guess');
ok((await call(pro, 'd=nowhere&q=x')).s === 404, 'unknown dataset 404');
r = await call(pro, 'q=zzzz-nothing'); ok(r.j.total === 0, 'no match returns nothing');
console.log('\n' + pass + ' checks passed');
