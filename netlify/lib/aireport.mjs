// Property research report builder. Pure: takes records, returns sections whose every line is labeled
// verified (from an official list or map we checked, with its date), estimate (calculated here), or missing.
// It is NOT a title search, appraisal or legal opinion, and says so.
const V = 'verified', E = 'estimate', M = 'missing';
const money = n => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const it = (label, value, status, note) => ({ label, value: value == null || value === '' ? 'Not available' : String(value), status: value == null || value === '' ? M : status, ...(note ? { note } : {}) });

export function build({ lien: l, state: st, roll, today }) {
  const chk = l.checked || null, src = l.source || null;
  const sys = st ? st.sys : null;
  const sections = [];
  sections.push({ title: '1. Property overview', items: [
    it('County and state', l.county + (st ? ', ' + st.n : ''), V), it('Parcel number', l.parcel, V, 'As printed on the county list.'),
    it('Legal description', l.desc, V), it('Property use', l.use, V), it('Acres', l.acres != null ? l.acres : (l.desc && /(\d+(?:\.\d+)?)\s*A\b/.exec(l.desc) ? null : null), V),
    it('County land value', l.market != null ? money(l.market) : null, V, 'County appraiser figure as carried in the list; not an appraisal.') ] });
  sections.push({ title: '2. Tax lien or deed information', items: [
    it('Amount on the list', l.amount != null ? money(l.amount) : (l.noPrice ? null : null), V, chk ? 'Copied from the county list checked ' + chk + '.' : 'Check date missing.'),
    it('Status on the list', l.status, V), it('Sale date on the list', l.saleDate, V, 'A past date means a historical listing, not confirmed current.'),
    it('Interest or rate printed on the list', l.rate, V), it('Certificate number', l.cert ? l.cert + (l.certYear ? ' (' + l.certYear + ')' : '') : null, V), it('Tax year', l.taxYear, V),
    it('Value vs amount owed', l.market != null && l.amount > 0 ? (l.market / l.amount).toFixed(1) + 'x' : null, E, 'Calculated: county value divided by amount owed. Not a return or a score.') ] });
  const own = [it('Owner name on the list', l.owner, V)];
  if (roll) { own.push(it('Absentee owner (state tax roll)', roll.abs ? 'Yes' : 'No', V, 'Florida Dept. of Revenue 2026 roll.')); if (roll.mail) own.push(it('Owner mailing address (state tax roll)', roll.mail, V)); if (roll.fidu) own.push(it('Fiduciary or trust flag', roll.fidu, V)); if (roll.sale) own.push(it('Last recorded sale', roll.sale, V)); }
  else own.push(it('Owner mailing address', null, M, 'Not in our data for this county.'));
  sections.push({ title: '3. Ownership and public-record details', items: own });
  const flag = (v, yes, no) => v === 1 ? yes : v === 0 ? no : null;
  sections.push({ title: '4. Environmental and geographic findings', items: [
    it('Road access', flag(l.road, 'Touches a mapped road', 'No mapped road within about 65 ft (may be landlocked)'), V, 'Census road map check; confirm legal access.'),
    it('FEMA flood zone', flag(l.flood, 'In a high-risk flood zone', 'Not in a high-risk zone on the map checked'), V, 'FEMA National Flood Hazard Layer. Unmapped is not the same as no risk.'),
    it('Wetlands', flag(l.wet, 'Mapped wetlands touch the lot', 'No mapped wetlands touch the lot'), V, 'USFWS National Wetlands Inventory; not a legal delineation.'),
    it('Environmental controls (Florida DEP)', l.env && l.env.length ? l.env.map(e => e.name || e.type || 'registry overlap').join('; ') : null, V),
    it('Elevation, zoning, HOA', null, M, 'Not carried in our list data. Check the county GIS and the HOA before you bid.') ] });
  sections.push({ title: '5. Potential expenses and risks', items: [
    it('Later taxes, fees and sale costs', null, M, 'Not on the list. Ask the county what is added to the price.'),
    it('Back taxes and liens that survive a sale', null, M, 'Depends on the state; see the state rules below.'),
    it('Title and possession', 'Not checked', M, 'A tax sale is not a title search. Occupants, mortgages and other liens may exist.') ] });
  sections.push({ title: '6. State and county procedures', items: st ? [
    it('System', sys, V, 'From our checked state data' + (st.v ? ' (flagged: sources differ, verify)' : '') + '.'), it('Interest or penalty', st.rate, V), it('Redemption', st.red, V), it('Bidding', st.bid, V) ] : [it('State rules', null, M)] });
  const sources = []; if (src) sources.push({ name: l.county + ' official list', url: src, checked: chk });
  if (st && st.links) for (const x of st.links.slice(0, 4)) sources.push({ name: x[0], url: x[1] });
  sources.push({ name: 'FEMA National Flood Hazard Layer', url: 'https://msc.fema.gov/portal' }, { name: 'USFWS National Wetlands Inventory', url: 'https://fwsprimary.wim.usgs.gov/wetlands/apps/wetlands-mapper/' });
  sections.push({ title: '7. Official source links', items: sources.map(s => ({ label: s.name, value: s.url, status: V })) });
  sections.push({ title: '8. Data verification dates', items: [it('County list checked', chk, V), it('Report generated', today, V)] });
  const missing = sections.flatMap(s => s.items).filter(x => x.status === M).map(x => x.label);
  sections.push({ title: '9. Missing information', items: missing.length ? missing.map(m => ({ label: m, value: 'Not available in our data', status: M })) : [{ label: 'None flagged', value: '', status: V }] });
  sections.push({ title: '10. Due diligence checklist', items: ['Confirm the parcel is still offered, with the county tax collector or treasurer.', 'Read the county sale rules and registration deadline.', 'Open the parcel on the county GIS; check access, size, zoning and elevation.', 'Order a title search before bidding.', 'Ask what later taxes, fees and recording costs apply.', 'Check for an HOA, code liens and utility availability.', 'Confirm redemption and deed steps in the state statute.'].map(x => ({ label: x, value: '', status: 'todo' })) });
  return { title: 'Property research report: ' + l.county + ' parcel ' + l.parcel, generated: today, disclaimer: 'Educational research summary built from public records and our checked data. It is not a certified title search, an appraisal, legal advice or investment advice. Verify everything with the county before you buy or bid.', sections };
}
export function toCsv(rep) {
  const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  return [['Section', 'Item', 'Value', 'Status', 'Note'].map(q).join(','), ...rep.sections.flatMap(s => s.items.map(x => [s.title, x.label, x.value, x.status, x.note || ''].map(q).join(',')))].concat(['', q('Disclaimer'), q(rep.disclaimer)]).join('\n');
}
