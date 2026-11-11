// Guided practice cases. Each case has a PUBLIC part (shown before the visitor decides) and a PRIVATE part
// (outcome and feedback notes) that only leaves the server after a decision is submitted (see functions/practice.mjs).
//
// RULES FOR REAL CASES (demo:false): every check needs an official source URL (https) and a checked date (YYYY-MM-DD);
// the outcome needs a source URL and date, and `verified` must be filled in by the owner. isPublishable() refuses anything less.
// The demo case below is FICTIONAL, labeled as such on screen, and exists only for development and testing.

export const CHECK_KEYS = ['zoning', 'flood', 'wetlands', 'road'];

const LESSON = { href: '/learn/?l=diligence', label: 'Master Class lesson 7: Due diligence (members)' };

export const CASES = {
  'lee-demo': {
    id: 'lee-demo', demo: true, county: 'Lee', state: 'FL',
    title: 'Lee County practice case',
    verified: null,
    certificate: {
      'Certificate (demo)': 'DEMO-0001',
      'Face amount (what the lien costs)': '$1,842.17',
      'Tax year': '2023 (demo)',
      'Maximum rate': '18%',
      'Winning bid rate': '9.5%',
      'How sold': 'Online sale (demo)'
    },
    parcel: {
      'Parcel (STRAP) number': 'DEMO-00-00-00-00-00000.0000',
      'Property type': 'Vacant lot (demo)',
      'Lot size': 'About 5,000 sq ft',
      'County assessed value': '$14,200 (demo)',
      'Legal description': 'DEMO SUBDIVISION, BLOCK 1, LOT 1 (not a real parcel)'
    },
    checks: [
      { key: 'zoning', title: 'Zoning', why: 'Zoning decides what can be built, and a minimum lot size can make a small lot unbuildable.',
        finding: 'Zoned residential single-family (RS-1). Minimum lot size for a new home: 7,500 sq ft. This lot is about 5,000 sq ft.',
        source: { name: 'DEMO: county zoning map (not a real record)', url: '' }, checked: 'DEMO date (not real)', lesson: LESSON },
      { key: 'flood', title: 'Flood zone', why: 'A high-risk flood zone can mean required insurance and building limits.',
        finding: 'FEMA map: Special Flood Hazard Area, Zone AE. About 80% of the lot is inside the zone.',
        source: { name: 'DEMO: FEMA flood map (not a real record)', url: '' }, checked: 'DEMO date (not real)', lesson: LESSON },
      { key: 'wetlands', title: 'Wetlands', why: 'Mapped wetlands can block or limit building.',
        finding: 'No mapped wetlands touch this lot.',
        source: { name: 'DEMO: US Fish and Wildlife wetlands map (not a real record)', url: '' }, checked: 'DEMO date (not real)', lesson: LESSON },
      { key: 'road', title: 'Documented road access', why: 'A lot with no documented legal access may be landlocked.',
        finding: 'No documented road frontage or recorded access easement was found. The nearest public road is about 300 ft away.',
        source: { name: 'DEMO: county road and right-of-way records (not a real record)', url: '' }, checked: 'DEMO date (not real)', lesson: LESSON }
    ],
    private: {
      outcome: {
        status: 'Redeemed (the owner paid)',
        purchase: 1842.17, ratePct: 9.5, months: 14,
        source: { name: 'DEMO outcome (not a real record)', url: '' }, date: 'DEMO date (not real)'
      },
      // flag: how the documented finding should be read. 'risk' = a real problem for the lot; 'unclear' = could not be confirmed; 'ok' = no problem found.
      flags: {
        zoning: { flag: 'risk', note: 'The lot is smaller than the minimum for a new home, so it may not be buildable.' },
        flood: { flag: 'risk', note: 'Most of the lot is in a high-risk flood zone, which can add insurance cost and building limits.' },
        wetlands: { flag: 'ok', note: 'No wetlands were mapped. That is a point in the lot’s favor.' },
        road: { flag: 'unclear', note: 'No documented access was found. That is a warning sign: confirm access with the county before bidding.' }
      }
    }
  }
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const https = u => /^https:\/\//.test(String(u || ''));
// A real case is publishable only with a verified-by record and official sources and dates for everything shown.
export function isPublishable(c) {
  if (!c) return false;
  if (c.demo) return true; // demo cases are allowed, and are always labeled as demo
  if (!c.verified || !c.verified.by || !ISO.test(c.verified.date || '')) return false;
  const o = c.private && c.private.outcome; if (!o || !https(o.source && o.source.url) || !ISO.test(o.date || '')) return false;
  if (!(o.purchase > 0) || !(o.months > 0)) return false;
  return c.checks.length === CHECK_KEYS.length && c.checks.every(k => https(k.source && k.source.url) && ISO.test(k.checked || '') && c.private.flags[k.key]);
}

export const list = () => Object.values(CASES).filter(isPublishable).map(c => ({ id: c.id, title: c.title, county: c.county, state: c.state, demo: !!c.demo }));
export function publicCase(id) {
  const c = CASES[id]; if (!c || !isPublishable(c)) return null;
  const { private: _p, ...rest } = c; return rest;
}

const MARKS = ['verified', 'followup', 'unknown'];
const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Builds the outcome and feedback after the visitor has decided. Nothing here recommends buying or passing.
export function reveal(id, sub) {
  const c = CASES[id]; if (!c || !isPublishable(c)) return null;
  const marks = {}; CHECK_KEYS.forEach(k => { marks[k] = MARKS.includes(sub.marks && sub.marks[k]) ? sub.marks[k] : 'unknown'; });
  const o = c.private.outcome, interest = o.purchase * (o.ratePct / 100) * (o.months / 12), payout = o.purchase + interest;
  const items = c.checks.map(k => {
    const f = c.private.flags[k.key], m = marks[k.key], problem = f.flag !== 'ok';
    let msg;
    if (m === 'verified') msg = problem ? 'You marked this Verified, and it matters: ' + f.note : 'You marked this Verified. ' + f.note;
    else if (m === 'followup') msg = problem ? 'Good instinct to follow up. ' + f.note : 'You flagged this for follow-up. ' + f.note;
    else msg = problem ? 'You left this Unknown, and it was worth checking. ' + f.note : 'You left this Unknown. ' + f.note;
    return { key: k.key, title: k.title, marked: m, flag: f.flag, message: msg, missed: problem && m === 'unknown' };
  });
  const checked = items.filter(i => i.marked !== 'unknown').length, missed = items.filter(i => i.missed).map(i => i.title);
  const out = {
    demo: !!c.demo,
    outcome: { status: o.status, purchase: money(o.purchase), ratePct: o.ratePct + '%', months: o.months, interest: money(interest), payout: money(payout), source: o.source, date: o.date },
    items, checked, total: items.length, missed,
    summary: 'You looked at ' + checked + ' of ' + items.length + ' checks' + (missed.length ? ' and left these unchecked even though they showed a problem: ' + missed.join(', ') + '.' : ', and nothing important was left unchecked.'),
    decision: sub.decision,
    lesson: (/redeem/i.test(o.status) ? 'In this case the owner redeemed, so the lot’s problems did not cost the buyer. A good outcome does not prove the decision was sound. If the owner had never paid, the buyer would have been left holding the lot and its problems, which is why the checks come before the bid.' : 'Read the outcome against the checks above: the evidence you gathered before buying is what you had to go on.') + ' This is a teaching example, not advice.'
  };
  return out;
}
