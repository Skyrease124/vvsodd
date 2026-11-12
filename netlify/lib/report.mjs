// Property & Neighborhood Report. Queries official county/state ArcGIS services by county + folio/PCN, server-side, and says
// plainly what each field is, where it came from and when. Nothing is inferred: an empty answer from a service that does not cover the
// parcel is "not covered / manual lookup", never "none". Owner status is never decided here (see estate links).
import CONFIG_JSON from '../data/report-config.json' with { type: 'json' };
export const CONFIG = CONFIG_JSON;
export const STATEWIDE = 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query';
const MD = 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/';
export const SRC = {
  roll: { name: 'Florida Statewide Parcels (Florida Geographic Information Office, from the county property appraiser via the Department of Revenue)', url: 'https://www.arcgis.com/home/item.html?id=efa909d6b1c841d298b0a649e7f71cf2', date: '2026-09-30' },
  mdpa: { name: 'Miami-Dade Property Boundary View (Property Appraiser data, Miami-Dade Open Data)', url: 'https://opendata.miamidade.gov/' },
  mdviol: { name: 'Miami-Dade Building Violations (Regulatory and Economic Resources, Miami-Dade Open Data)', url: 'https://opendata.miamidade.gov/' },
  mdcc: { name: 'Miami-Dade Code Compliance Violations (Regulatory and Economic Resources, Miami-Dade Open Data)', url: 'https://opendata.miamidade.gov/' },
  mdpermit: { name: 'Building Permits Issued by Miami-Dade County, previous 2 years to present (Miami-Dade Open Data)', url: 'https://opendata.miamidade.gov/' },
  mdmuni: { name: 'Miami-Dade Municipal Boundary (Miami-Dade Open Data)', url: 'https://opendata.miamidade.gov/' },
  mdpolice: { name: 'Miami-Dade Police Agency coverage (Miami-Dade Open Data)', url: 'https://opendata.miamidade.gov/' },
  pbmuni: { name: 'Palm Beach County Municipal Boundaries (Palm Beach County open data)', url: 'https://opendata2-pbcgov.opendata.arcgis.com/' }
};
const fetchJson = async (url, ms = 15000) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); if (j.error) throw new Error(j.error.message || 'service error'); return j; } finally { clearTimeout(t); } };
const qs = o => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
export const query = async (base, params) => (await fetchJson(base + '?' + qs(Object.assign({ f: 'json', returnGeometry: 'false', outFields: '*' }, params)))).features || [];
const sq = s => String(s).replace(/'/g, "''");
// each lookup returns {ok, rows, error}: ok=false means "could not check", which is never shown as "none"
const safe = async fn => { try { return { ok: true, rows: await fn() }; } catch (e) { return { ok: false, rows: [], error: String(e.message || e).slice(0, 120) }; } };
const date = ms => ms ? new Date(ms).toISOString().slice(0, 10) : '';
const ymd8 = s => /^\d{8}$/.test(String(s || '')) ? s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6) : '';
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const title = s => { s = clean(s).replace(/\s*&\s*$/, ''); return s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\bLlc\b/g, 'LLC').replace(/\bLp\b/g, 'LP') : s; };
export const normId = (county, parcel) => { const c = CONFIG[county]; const d = String(parcel || '').replace(/[^0-9A-Za-z]/g, ''); return c && /^\d+$/.test(d) && d.length === c.idDigits ? d : null; };
const addr = s => title(s).replace(/\bPo Box\b/g, 'PO Box').replace(/\b(Fl|Florida)\b(?=\s*\d|$)/g, 'FL').replace(/\b(Nw|Ne|Sw|Se)\b/g, m => m.toUpperCase());
const centroid = rings => { const pts = rings.flat(); const n = pts.length; return [pts.reduce((a, p) => a + p[1], 0) / n, pts.reduce((a, p) => a + p[0], 0) / n]; };

function classifyCase(c) {
  const t = (c.type + ' ' + (c.desc || '')).toLowerCase();
  return /unsafe/.test(t) ? 'unsafe_structure' : /demol/.test(t) ? 'demolition' : 'code_violation';
}
function permitClass(p) {
  const t = [p.type, p.appType, p.detail, p.cat].join(' ').toLowerCase();
  return /demol/.test(t) ? 'demolition' : 'permit';
}

export async function buildReport(county, parcel) {
  const cfg = CONFIG[county]; if (!cfg) return { supported: false };
  const id = normId(county, parcel);
  const out = { supported: true, county, state: cfg.state, idLabel: cfg.idLabel, parcelAsListed: parcel, id, generatedAt: new Date().toISOString(), links: { pa: cfg.pa, deeds: cfg.deeds, probate: cfg.probate, permits: null, crime: cfg.crime }, copy: id || String(parcel) };
  if (!id) { out.match = { status: 'unverified', note: 'The parcel number does not have the expected ' + cfg.idDigits + ' digits for ' + county + ' County, so nothing was matched automatically.' }; out.ownership = { status: 'unverified' }; out.permits = { coverage: 'manual', cases: [], permits: [] }; out.crime = { status: 'unavailable', reason: 'Parcel could not be placed.' }; return out; }
  const isMD = county === 'Miami-Dade';
  const [roll, pa, paParent, viol, cc, perm] = await Promise.all([
    safe(() => query(STATEWIDE, { where: `CO_NO=${cfg.coNo} AND PARCEL_ID='${sq(id)}'`, outFields: 'PARCEL_ID,OWN_NAME,OWN_ADDR1,OWN_ADDR2,OWN_CITY,OWN_STATE,OWN_ZIPCD,FIDU_NAME,PHY_ADDR1,PHY_CITY,PHY_ZIPCD,S_LEGAL,SALE_PRC1,SALE_YR1,SALE_MO1,OR_BOOK1,OR_PAGE1,CLERK_NO1,SALE_PRC2,SALE_YR2,SALE_MO2,OR_BOOK2,OR_PAGE2,CLERK_NO2,ASMNT_YR,DOR_UC', returnGeometry: 'true', outSR: '4326' })),
    isMD ? safe(() => query(MD + 'PaParcelView_gdb/FeatureServer/0/query', { where: `FOLIO='${sq(id)}'`, returnGeometry: 'true', outSR: '4326' })) : { ok: true, rows: [] },
    isMD ? safe(() => query(MD + 'PaParcelView_gdb/FeatureServer/0/query', { where: `FOLIO='${sq(id.slice(0, 9) + '0000')}'`, returnGeometry: 'true', outSR: '4326' })) : { ok: true, rows: [] },
    isMD ? safe(() => query(MD + 'BuildingViolation_gdb/FeatureServer/0/query', { where: `FOLIO='${sq(id)}'`, orderByFields: 'OPEN_DATE DESC' })) : null,
    isMD ? safe(() => query(MD + 'CCVIOL_gdb/FeatureServer/0/query', { where: `FOLIO='${sq(id)}'`, orderByFields: 'CASE_DATE DESC' })) : null,
    isMD ? safe(() => query(MD + 'miamidade_permit_data/FeatureServer/0/query', { where: `FolioNumber='${sq(id)}'`, orderByFields: 'PermitIssuedDate DESC', resultRecordCount: '50' })) : null
  ]);
  // ---- match status: exactly one record per source, or we say so
  const r = roll.rows[0] && roll.rows[0].attributes, p = pa.rows[0] && pa.rows[0].attributes;
  const ambiguous = roll.rows.length > 1 || pa.rows.length > 1;
  out.match = ambiguous ? { status: 'ambiguous', note: 'More than one record matched this ' + cfg.idLabel + '. Ownership below is not shown until a reviewer checks it.' } : (r || p) ? { status: 'matched', note: 'Matched by county and ' + cfg.idLabel + ' ' + id + ' (' + [r ? 'state parcel roll' : '', p ? 'Property Appraiser view' : ''].filter(Boolean).join(' and ') + ').' } : { status: 'not_found', note: 'This ' + cfg.idLabel + ' is not in the automatic sources we query (condominium units and some records are not). Use the Property Appraiser link.' };
  if (!roll.ok && !pa.ok) out.match = { status: 'unverified', note: 'The official services could not be reached just now (' + (roll.error || pa.error) + '). Try again, or use the links.' };
  // ---- point for jurisdiction/crime coverage
  let pt = null, ptNote = '';
  if (pa.rows[0] && pa.rows[0].geometry) { pt = centroid(pa.rows[0].geometry.rings); ptNote = 'parcel'; }
  else if (roll.rows[0] && roll.rows[0].geometry) { pt = centroid(roll.rows[0].geometry.rings); ptNote = 'parcel'; }
  else if (paParent.rows[0] && paParent.rows[0].geometry) { pt = centroid(paParent.rows[0].geometry.rings); ptNote = 'parent condominium parcel (approximate)'; }
  // ---- 1. ownership, deeds, estates
  const own = { status: 'unverified', label: 'Owner status unverified', why: 'We cannot tell from public records alone whether an owner is living, or who can sign for the property. A matching name, an old deed or an empty probate search does not settle it.' };
  if (!ambiguous && (r || p)) {
    own.record = true; own.owner = title(p ? [p.TRUE_OWNER1, p.TRUE_OWNER2, p.TRUE_OWNER3].filter(x => clean(x)).join(' & ') : r.OWN_NAME); if (!own.owner && r) own.owner = title(r.OWN_NAME);
    if (r && clean(r.FIDU_NAME)) own.fiduciary = title(r.FIDU_NAME);
    const mail = r ? [r.OWN_ADDR1, r.OWN_ADDR2, r.OWN_CITY, [r.OWN_STATE, r.OWN_ZIPCD].filter(x => clean(x)).join(' ')].map(clean).filter(Boolean).join(', ') : p ? [p.TRUE_MAILING_ADDR1, p.TRUE_MAILING_CITY, [p.TRUE_MAILING_STATE, p.TRUE_MAILING_ZIP_CODE].filter(Boolean).join(' ')].map(clean).filter(Boolean).join(', ') : '';
    if (mail) own.mailing = addr(mail);
    own.source = p ? SRC.mdpa : SRC.roll; own.sourceDate = p ? '' : SRC.roll.date; own.queriedAt = out.generatedAt;
    // latest sale on the roll: this is the Property Appraiser's sale record, not the recorded deed itself
    if (r && Number(r.SALE_YR1) > 0) { own.lastSale = { date: String(r.SALE_YR1) + (clean(r.SALE_MO1) ? '-' + String(r.SALE_MO1).padStart(2, '0') : ''), price: Number(r.SALE_PRC1) || null, book: clean(r.OR_BOOK1), page: clean(r.OR_PAGE1), instrument: clean(r.CLERK_NO1), source: SRC.roll, verified: false }; }
    else if (p && p.DOS_1 && ymd8(p.DOS_1)) { own.lastSale = { date: ymd8(p.DOS_1), price: Number(p.PRICE_1) || null, book: '', page: '', instrument: '', source: SRC.mdpa, verified: false }; }
    if (own.lastSale) own.lastSale.note = 'From the Property Appraiser’s sale record. It is not the deed. Confirm the recorded deed and its instrument number at the Clerk.' + (own.lastSale.instrument || own.lastSale.book ? '' : ' No book/page or instrument number is on this record.');
    own.use = p ? title(p.DOR_DESC) : '';
  }
  out.ownership = own;
  // ---- 2. permits and code
  const cases = []; const permits = [];
  if (viol && viol.ok) viol.rows.forEach(f => { const a = f.attributes; const c = { kind: 'building_violation', number: clean(a.CASE_NUM), type: clean(a.CASE_TYPE), status: a.CLOSED_DATE ? 'Closed' : 'Open', opened: date(a.OPEN_DATE), closed: date(a.CLOSED_DATE), permit: clean(a.PERMIT_NUM), source: SRC.mdviol }; c.class = classifyCase(c); cases.push(c); });
  if (cc && cc.ok) cc.rows.forEach(f => { const a = f.attributes; const c = { kind: 'code_compliance', number: clean(a.CASE_NUM), type: clean(a.PROBLEM_DESC) || clean(a.PROBLEM), desc: clean(a.STAT_DESC), status: clean(a.STAT_DESC) || clean(a.CASE_STATUS), opened: date(a.CASE_DATE), closed: '', source: SRC.mdcc }; c.class = classifyCase(c); cases.push(c); });
  if (perm && perm.ok) perm.rows.forEach(f => { const a = f.attributes; const pm = { number: clean(a.PermitNumber), type: clean(a.PermitType), appType: clean(a.ApplicationTypeDescription), detail: clean(a.DetailDescriptionComments).slice(0, 200), cat: clean(a.CategoryDescription1), issued: date(a.PermitIssuedDate), applied: date(a.ApplicationDate), lastInspection: date(a.LastApprovedInspDate), completionDate: date(a.CoCcDate), city: clean(a.City), source: SRC.mdpermit }; pm.class = permitClass(pm); pm.status = pm.completionDate ? 'Certificate of completion/occupancy dated ' + pm.completionDate : 'Issued. No completion record on this list'; permits.push(pm); });
  const uni = (county === 'Miami-Dade' ? (p && /unincorporated/i.test(p.TRUE_SITE_CITY || '')) || (r && /unincorporated/i.test(r.PHY_CITY || '')) : false);
  let city = '', cityNote = '';
  if (isMD) {
    city = title((p && p.TRUE_SITE_CITY) || (r && r.PHY_CITY) || ''); if (!city && permits.length) city = title(permits[0].city);
    if (pt && !city) { const m = await safe(() => query(MD + 'Municipalitypoly_gdb/FeatureServer/0/query', { geometry: pt[1] + ',' + pt[0], geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'NAME' })); if (m.ok && m.rows[0]) { city = title(m.rows[0].attributes.NAME); cityNote = 'Municipal Boundary layer'; } }
  } else if (pt) {
    const m = await safe(() => query('https://maps.co.palm-beach.fl.us/arcgis/rest/services/OpenData/Boundaries_Open_Data/MapServer/5/query', { geometry: pt[1] + ',' + pt[0], geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*' })); if (m.ok && m.rows[0]) { const a = m.rows[0].attributes; city = title(a.MUNICIPALITY || a.NAME || a.MUNI || a.CITY || ''); cityNote = 'Municipal Boundaries layer'; }
    if (!city && r && clean(r.PHY_CITY)) city = title(r.PHY_CITY);
  } else if (r && clean(r.PHY_CITY)) city = title(r.PHY_CITY);
  const isUni = /unincorporated/i.test(city) || (!city && false);
  const office = isUni ? cfg.permits.unincorporated : (city && cfg.cities[city] ? { office: cfg.cities[city][0], name: cfg.cities[city][0] + ' (official site; find Building / Permits / Code Enforcement)', url: cfg.cities[city][1] } : city ? { office: 'City of ' + city + ' building and code departments', name: 'Find ' + city + '’s permit and code search', url: cfg.permits.unincorporated.url, generic: true } : null);
  const coverage = isMD ? (isUni ? 'county' : city ? 'city' : 'unknown') : (isUni ? 'manual-county' : 'manual');
  out.permits = { coverage, jurisdiction: city || 'Not determined', jurisdictionSource: cityNote || (p ? SRC.mdpa.name : r ? SRC.roll.name : ''), office, cases, permits, checked: { violations: viol ? viol.ok : null, codeCompliance: cc ? cc.ok : null, permits: perm ? perm.ok : null },
    note: isMD ? (isUni ? 'Miami-Dade County handles permits and code cases for unincorporated parcels, and the county lists below cover them.' : city ? city + ' has its own building and code departments. The county lists below may not include city cases, so an empty list does not mean there are none. Search the city’s office.' : 'We could not tell which office covers this parcel. Check the Property Appraiser record for the municipality.') : 'Palm Beach County permit and code records are not available as an open data feed we can query. Use the office link and the copyable PCN.',
    permitsCoverage: 'The county permit list covers permits issued in the previous 2 years.' };
  out.links.permits = office;
  // ---- 3. crime: coverage only (no incident-location source has been verified for these counties)
  const crime = { status: 'unavailable', label: 'Local data unavailable', reason: 'We have not found a published, usable incident-location dataset for this agency, so we show no counts. Zero would mean a successful query of a covered area returned no reports; we cannot say that here.', link: cfg.crime, window: '', counts: null };
  if (isMD && pt) {
    const a = await safe(() => query(MD + 'PoliceAgency_gdb/FeatureServer/0/query', { geometry: pt[1] + ',' + pt[0], geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'AGENCYNAME,DISTNAME' }));
    if (a.ok && a.rows[0]) { const x = a.rows[0].attributes; crime.agency = title(clean(x.AGENCYNAME).replace(/^MDSO: COUNTY/i, 'Miami-Dade Sheriff’s Office')) + (clean(x.DISTNAME) ? ' (' + title(x.DISTNAME) + ' district)' : ''); crime.coverage = 'Agency responsible for this location: ' + crime.agency; crime.source = SRC.mdpolice; }
  }
  if (!crime.agency) crime.coverage = pt ? 'The responsible agency could not be determined from the open data we use.' : 'This parcel could not be placed on a map, so coverage is unknown.';
  out.crime = crime;
  out.sources = { roll: roll.ok, pa: pa.ok };
  return out;
}
