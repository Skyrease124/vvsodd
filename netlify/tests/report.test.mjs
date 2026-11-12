// Run: node netlify/tests/report.test.mjs   (mocked official services; no network)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
process.env.USERS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppa-rep-')); process.env.SESSION_SECRET = 't';
const R = await import('../lib/report.mjs'); const auth = await import('../lib/auth.mjs'); const { default: api } = await import('../functions/report.mjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('ok -', m); };
const FOLIO = '3030520750270'; let mode = {};
globalThis.fetch = async url => {
  url = decodeURIComponent(String(url)); const f = a => ({ features: a.map(attributes => ({ attributes })) });
  const body = (() => {
    if (mode.down && url.includes('BuildingViolation')) return { error: { message: 'boom' } };
    if (url.includes('Florida_Statewide_Cadastral')) return f(mode.dupRoll ? [{ PARCEL_ID: FOLIO, OWN_NAME: 'A' }, { PARCEL_ID: FOLIO, OWN_NAME: 'B' }] : mode.noRoll ? [] : [{ PARCEL_ID: FOLIO, OWN_NAME: 'DOE JANE', OWN_ADDR1: 'PO BOX 1', OWN_CITY: 'MIAMI', OWN_STATE: 'FL', OWN_ZIPCD: '33101', SALE_YR1: 2019, SALE_MO1: '4', SALE_PRC1: 100000, OR_BOOK1: '31234', OR_PAGE1: '55', CLERK_NO1: '20190123456', PHY_CITY: mode.city || 'Unincorporated County' }]);
    if (url.includes('PaParcelView')) return f([]);
    if (url.includes('BuildingViolation')) return f([{ CASE_NUM: 'U2026001', CASE_TYPE: 'Unsafe Structures', OPEN_DATE: 1760000000000, CLOSED_DATE: null }, { CASE_NUM: 'A2025002', CASE_TYPE: 'Expired Permit', OPEN_DATE: 1730000000000, CLOSED_DATE: 1740000000000 }]);
    if (url.includes('CCVIOL')) return f([]);
    if (url.includes('miamidade_permit_data')) return f([{ PermitNumber: 'D100', PermitType: 'DEMO', ApplicationTypeDescription: 'DEMOLITION - COMPLETE', DetailDescriptionComments: 'Demolish house', PermitIssuedDate: 1750000000000, CoCcDate: null, City: 'MIAMI' }]);
    return f([]);
  })();
  return { ok: true, status: 200, json: async () => body };
};
let r = await R.buildReport('Miami-Dade', '30-3052-075-0270');
ok(r.id === FOLIO && r.copy === FOLIO, 'the dashed folio is matched as 13 digits and offered as a copyable ID');
ok(r.ownership.label === 'Owner status unverified' && r.ownership.owner === 'Doe Jane', 'default status is "Owner status unverified"; owner of record shown');
ok(r.ownership.lastSale.instrument === '20190123456' && r.ownership.lastSale.book === '31234' && r.ownership.lastSale.verified === false && /not the deed/.test(r.ownership.lastSale.note), 'latest sale shows date, book/page and instrument number, labelled as the appraiser\'s record, not the deed');
ok(r.permits.cases.some(c => c.class === 'unsafe_structure' && c.status === 'Open' && c.number === 'U2026001'), 'an open unsafe-structure case is classified with its case number and status');
ok(r.permits.cases.some(c => c.number === 'A2025002' && c.status === 'Closed' && c.closed), 'a closed case keeps its closed date');
const dp = r.permits.permits[0]; ok(dp.class === 'demolition' && /No completion record/.test(dp.status) && !/complet(ed|ion) confirmed/i.test(dp.status), 'an issued demolition permit is not presented as a completed demolition');
ok(r.crime.status === 'unavailable' && r.crime.label === 'Local data unavailable' && r.crime.counts === null, 'with no incident source, crime shows "Local data unavailable" and no count (never zero)');
// a failed official service is "could not check", not "none"
mode = { down: true }; r = await R.buildReport('Miami-Dade', '30-3052-075-0270'); ok(r.permits.checked.violations === false && r.permits.cases.length === 0, 'a failed lookup is marked not checked rather than "no violations"');
// ambiguous matches are held back
mode = { dupRoll: true }; r = await R.buildReport('Miami-Dade', '30-3052-075-0270'); ok(r.match.status === 'ambiguous' && !r.ownership.record, 'an ambiguous match withholds ownership');
mode = { noRoll: true }; r = await R.buildReport('Miami-Dade', '30-3052-075-0270'); ok(r.match.status === 'not_found' && r.ownership.label === 'Owner status unverified', 'no match: owner status unverified, lookup links offered');
mode = {}; r = await R.buildReport('Miami-Dade', 'not-a-folio'); ok(r.match.status === 'unverified' && r.id === null, 'a malformed ID is not guessed');
// city parcels name the city's office, not the county's
mode = { city: 'Miami' }; r = await R.buildReport('Miami-Dade', '30-3052-075-0270'); ok(r.permits.coverage === 'city' && /City of Miami/.test(r.permits.office.office) && /own building and code departments/.test(r.permits.note), 'a city parcel is routed to the city\'s office and warns the county list may not include it');
// other Florida counties: the statewide-roll ID found by the parcel backfill is used, and a postal city is never called the jurisdiction
mode = { city: 'Tallahassee' }; r = await R.buildReport('Leon', Object.keys(JSON.parse(fs.readFileSync(new URL('../data/report-pids.json', import.meta.url))).Leon)[0]);
ok(r.supported && r.permits.jurisdiction === 'Not determined' && r.permits.postalCity === 'Tallahassee' && /not the same as city limits/.test(r.permits.note) && r.permits.coverage === 'manual-county', 'Leon: postal city is shown as such, not as the municipality; permits are a manual lookup');
ok(r.links.deeds.url.startsWith('https://') && r.links.crime.url.startsWith('https://') && r.crime.status === 'unavailable', 'Leon: official clerk and sheriff links, crime shown as unavailable');
r = await R.buildReport('Duval', '123'); ok(/Jacksonville/.test(r.permits.jurisdiction) && /consolidated/.test(r.permits.note), 'Duval: consolidated with the City of Jacksonville');
ok(['Alachua', 'Bay', 'Duval', 'Escambia', 'Hernando', 'Hillsborough', 'Leon', 'Manatee', 'Nassau', 'Osceola', 'Pasco', 'Santa Rosa', 'Sarasota', 'Volusia', 'Walton'].every(c => R.CONFIG[c] && R.CONFIG[c].coNo && R.CONFIG[c].deeds.url && R.CONFIG[c].probate.url && R.CONFIG[c].crime.url), 'every Florida county with listings has clerk, probate, permits and crime links');
// estate links: only a reviewer (owner) can confirm, with an official document
const mkU = async (e, o) => { await auth.createUser(e, 'pw-123456', false); if (o) { const u = await auth.getUser(e); u.owner = true; await auth.saveUser(u); } return (await auth.sessionCookie(e)).split(';')[0]; };
const O = await mkU('skyariasa@gmail.com', true), M = await mkU('m@example.com');
const post = (c, b) => api(new Request('http://x/f', { method: 'POST', headers: { cookie: c }, body: JSON.stringify(b) }), {}).then(async x => ({ s: x.status, j: await x.json() }));
const get = () => api(new Request('http://x/f?county=Miami-Dade&parcel=30-3052-075-0270'), {}).then(x => x.json());
mode = {}; ok((await get()).ownership.label === 'Owner status unverified', 'before review: Owner status unverified');
ok((await post(M, { action: 'estateSet', county: 'Miami-Dade', parcel: '30-3052-075-0270', caseNumber: '2025-000123-CP-02', documentTitle: 'Order', sourceUrl: 'https://example.gov/x.pdf' })).s === 403, 'a member cannot mark an estate as linked');
ok((await post(O, { action: 'estateSet', county: 'Miami-Dade', parcel: '30-3052-075-0270', caseNumber: '2025-000123-CP-02', documentTitle: '', sourceUrl: 'https://example.gov/x.pdf' })).s === 400, 'the reviewer must name the official document');
ok((await post(O, { action: 'estateSet', county: 'Miami-Dade', parcel: '30-3052-075-0270', caseNumber: '2025-000123-CP-02', documentTitle: 'Order', sourceUrl: 'http://insecure' })).s === 400, 'the source must be an https link');
ok((await post(O, { action: 'estateSet', county: 'Miami-Dade', parcel: '30-3052-075-0270', caseNumber: '2025-000123-CP-02', documentTitle: 'Order Admitting Will to Probate (names folio 3030520750270)', sourceUrl: 'https://example.gov/x.pdf' })).j.ok, 'the reviewer confirms with case number, document and source');
const e = (await get()).ownership; ok(e.label === 'Estate record linked' && e.estate.caseNumber === '2025-000123-CP-02' && /does not by itself say who can sign/.test(e.why), '"Estate record linked" appears only after confirmation, with case number and source');
ok((await post(O, { action: 'estateRemove', county: 'Miami-Dade', parcel: '30-3052-075-0270' })).j.ok && (await get()).ownership.label === 'Owner status unverified', 'removing the link returns to Owner status unverified');
console.log('\n' + pass + ' checks passed');
