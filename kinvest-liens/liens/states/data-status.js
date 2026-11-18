/* PricePocketAsset: one set of rules for "what is this record's status?" and "how fresh is it?".
 * Used by the website (window.DataStatus) and by the nightly audit (tools/audit, via require).
 *
 * Principles (do not weaken):
 *  - A status is only "sold", "redeemed" or "canceled" when the official record SAYS so.
 *  - A listing that is simply missing from a newer list is NEVER treated as sold or redeemed.
 *  - A listing from a past sale is "historical, not confirmed current", never "available".
 *  - Anything we cannot classify from the record's own words is "unknown / unverified".
 */
(function (root) {
  'use strict';
  const DAY = 864e5;

  // taxonomy: key -> [label, tone, meaning]. tone: ok | info | warn | muted | bad
  const CLASSES = {
    'tax-lien': ['Tax lien listed for sale', 'info', 'On an official county list for a tax lien sale. The county can pull a parcel at any time; confirm before bidding.'],
    'otc': ['Over-the-counter certificate', 'info', 'The official source says this certificate can be bought without waiting for an auction.'],
    'deed-sale': ['Tax deed or foreclosure sale listed', 'info', 'On an official county list for a tax deed or foreclosure sale. Dates and availability can change; confirm with the county.'],
    'county-held': ['County-held certificate', 'info', 'The county owns this certificate. Check with the tax collector how and when it can be bought.'],
    'state-held': ['State-held land', 'info', 'Listed by the state as land it holds after unpaid taxes. Check the state office for how it is sold.'],
    'redeemed': ['Redeemed', 'muted', 'The official source says the owner paid and the certificate was redeemed.'],
    'sold': ['Sold', 'muted', 'The official result says this property or certificate was sold.'],
    'canceled': ['Sale canceled', 'muted', 'The official source says this sale was canceled or withdrawn.'],
    'historical': ['Historical listing', 'muted', 'Was on an official list for a sale that has passed. We have not confirmed what happened to it.'],
    'unknown': ['Status unknown or unverified', 'warn', 'We could not confirm the current status from the official source. Do not assume it is available.']
  };

  const parseISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
  const isoToday = () => new Date().toISOString().slice(0, 10);

  // Best-effort date out of free text such as "September 2026 auction" is NOT attempted: only ISO dates count as dates.
  function saleDateMs(r) { return parseISO(r && r.saleDate); }

  // r: a lien record from liens-*.js. opts.today = 'YYYY-MM-DD' (for tests).
  function classify(r, opts) {
    const today = parseISO((opts && opts.today) || isoToday());
    const s = String((r && r.status) || ''), why = [];
    const sd = saleDateMs(r), passed = sd != null && sd < today;
    let key = 'unknown';
    if (/^\s*redeemed\b|\bwas redeemed\b/i.test(s)) key = 'redeemed';
    else if (/^\s*sold\b|\bsold (at|for|on)\b/i.test(s) && !/not on the .* sold list/i.test(s)) key = 'sold';
    else if (/cancel+ed|withdrawn|removed from (the )?sale/i.test(s)) key = 'canceled';
    else if (/over[- ]the[- ]counter|\botc\b/i.test(s)) key = 'otc';
    else if (/^\s*was on\b|\bhistorical\b/i.test(s)) key = 'historical';
    else if (/county-held|held by .* county/i.test(s)) key = 'county-held';
    else if (/state[- ]held|tax[- ]forfeited|state land/i.test(s) || (r && r._kind === 'state-land')) key = 'state-held';
    else if (/foreclos|in rem|repository list|sheriff sale|tax deed|judicial/i.test(s)) key = 'deed-sale';
    else if (/lien sale|delinquent account list|tax sale list|advertised for/i.test(s)) key = 'tax-lien';
    // A listing for a sale that has already happened is historical unless the official record names an outcome.
    if (passed && ['tax-lien', 'deed-sale'].includes(key)) { key = 'historical'; why.push('The sale date (' + r.saleDate + ') has passed and we have not confirmed what happened.'); }
    // The Wayne list says it plainly: not on the sold list does not mean sold.
    if (/not on the .* sold list|may have been sold elsewhere/i.test(s)) { key = 'unknown'; why.push('It is not on the official sold list, but that does not show whether it was sold elsewhere, held back or is still unsold.'); }
    return { key, label: CLASSES[key][0], tone: CLASSES[key][1], meaning: CLASSES[key][2], why };
  }

  // Freshness of the check that produced a record. Thresholds are days since the "checked" date.
  function freshness(r, opts) {
    const today = parseISO((opts && opts.today) || isoToday());
    const c = parseISO(r && r.checked);
    if (c == null) return { key: 'unknown', label: 'No check date recorded', tone: 'warn', days: null };
    const days = Math.max(0, Math.round((today - c) / DAY));
    const ago = days === 0 ? 'today' : days === 1 ? '1 day ago' : days + ' days ago';
    if (days <= 7) return { key: 'current', label: 'Checked ' + r.checked + ' (' + ago + ')', tone: 'ok', days };
    if (days <= 30) return { key: 'aging', label: 'Checked ' + r.checked + ' (' + ago + '): may have changed', tone: 'info', days };
    return { key: 'outdated', label: 'Checked ' + r.checked + ' (' + ago + '): outdated, recheck with the county', tone: 'warn', days };
  }

  // Everything the UI needs in one call.
  function describe(r, opts) {
    const st = classify(r, opts), fr = freshness(r, opts), warnings = st.why.slice();
    if (fr.key === 'outdated') warnings.push('This record was last checked ' + fr.days + ' days ago. Treat it as outdated until the county confirms it.');
    if (fr.key === 'unknown') warnings.push('We have no record of when this was last checked.');
    if (!r || !r.source) warnings.push('No official source link is attached to this record.');
    if (st.key === 'unknown' && !st.why.length) warnings.push('We could not tell the status from the official list. Do not assume it is available.');
    return { status: st, freshness: fr, warnings };
  }

  const api = { CLASSES, classify, freshness, describe, parseISO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DataStatus = api;
})(typeof window !== 'undefined' ? window : globalThis);
