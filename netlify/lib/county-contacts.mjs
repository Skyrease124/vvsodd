// County contact directory for "Ask the County".
// Only VERIFIED contacts: an email is listed only when it was read on that county office's own official website (sourceUrl), with the date checked.
// Everything else falls back to the official web page we already list for that county (portal / Copy Message), never a guessed address.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// key: 'ST|County|office'  office: 'collector' (tax collector / treasurer) or 'clerk' (clerk of court, tax deeds)
// { email, office: display name, sourceUrl: official page the address was read on, checked: 'YYYY-MM-DD' }
export const VERIFIED_EMAILS = {
  // none verified yet: county websites refuse automated checks from our server, so each address must be confirmed by hand from its official page
};

// which office handles each kind of request
export const KIND_OFFICE = { liens: 'collector', taxdeed: 'clerk', laft: 'clerk', status: 'collector', custom: 'collector' };
export const KINDS = {
  liens: 'County-Held Liens', taxdeed: 'Upcoming Tax Deed List', laft: 'Lands Available for Purchase', status: 'Parcel Status', custom: 'Custom Question',
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
let states = null, upcoming = null;
function dataDir() {
  const root = process.env.LAMBDA_TASK_ROOT || process.cwd();
  return [path.join(root, 'kinvest-liens/liens/states'), path.join(HERE, '../../kinvest-liens/liens/states'), path.join(process.cwd(), 'kinvest-liens/liens/states')].find(d => fs.existsSync(path.join(d, 'states.js')));
}
function load() {
  if (states) return;
  const dir = dataDir(); if (!dir) { states = []; upcoming = { counties: {} }; return; }
  states = vm.runInNewContext(fs.readFileSync(path.join(dir, 'states.js'), 'utf8') + '\n;STATES', {}, { timeout: 2000 });
  try { upcoming = JSON.parse(fs.readFileSync(path.join(dir, 'upcoming-sales.json'), 'utf8')); } catch (e) { upcoming = { counties: {} }; }
}
const OFFICE_RX = { collector: /tax collector|treasurer|tax commissioner|trustee|tax office/i, clerk: /clerk|tax deed|lands available/i };

// -> { state, county, office, officeName, email|null, link|null, linkTitle, mode: 'email'|'link'|'none', verifiedSource, checked }
export function lookup(st, county, kind) {
  load();
  const office = KIND_OFFICE[kind] || 'collector';
  const v = VERIFIED_EMAILS[st + '|' + county + '|' + office];
  const s = states.find(x => x.a === st);
  const cname = String(county || '').toLowerCase();
  const links = [];
  (s ? s.links || [] : []).forEach(([t, u]) => { if (t.toLowerCase().includes(cname)) links.push([t, u]); });
  const up = upcoming.counties && upcoming.counties[county];
  if (st === 'FL' && up) Object.entries(up.links || {}).forEach(([t, u]) => links.push([county + ' County: ' + t, u]));
  const pick = links.find(([t]) => OFFICE_RX[office].test(t)) || links[0] || null;
  const officeName = office === 'clerk' ? county + ' County Clerk (tax deeds)' : county + ' County Tax Collector';
  if (v) return { state: st, county, office, officeName: v.office || officeName, email: v.email, link: pick ? pick[1] : null, linkTitle: pick ? pick[0] : '', mode: 'email', verifiedSource: v.sourceUrl, checked: v.checked };
  return { state: st, county, office, officeName, email: null, link: pick ? pick[1] : null, linkTitle: pick ? pick[0] : '', mode: pick ? 'link' : 'none', verifiedSource: '', checked: '' };
}
export function _reset() { states = null; upcoming = null; }
