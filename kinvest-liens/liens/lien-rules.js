/* PricePocketAsset: state-specific tax lien calculation rules.
 *
 * Only states whose rules were read from the official statute text are "verified" here.
 * Every other state falls back to a clearly labeled BASIC ESTIMATE (simple interest on numbers
 * you enter). Nothing here is legal advice and projected returns are never guaranteed.
 *
 * Each verified state stores: the calculation method, the official source URLs, and the date the
 * statute text was last read. Do not add a state without reading its statute text first.
 *
 * Works in the browser (window.LienCalc) and in Node tests (module.exports).
 */
(function (root) {
  'use strict';

  // ---------- date helpers (UTC, ISO strings 'YYYY-MM-DD') ----------
  const pad = n => (n < 10 ? '0' : '') + n;
  const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
  const iso = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
  const addYears = (d, n) => { const x = new Date(Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), 1)); const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(d.getUTCDate(), last)); return x; };
  const addMonthsClamped = (d, n) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)); const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(d.getUTCDate(), last)); return x; };
  const endOfMonth = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const monthIndex = d => d.getUTCFullYear() * 12 + d.getUTCMonth();
  const nextBusinessDay = d => { let x = d; while (x.getUTCDay() === 0 || x.getUTCDay() === 6) x = addDays(x, 1); return x; }; // weekends only; holidays are not modeled
  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const todayISO = () => iso(new Date());

  // ---------- verified rules ----------
  const RULES = {
    FL: {
      name: 'Florida',
      method: 'Bid-down interest rate with a 5% mandatory minimum',
      verifiedOn: '2026-11-18',
      sources: [
        { label: 'F.S. 197.472: Redemption of tax certificates (5% minimum, 0% exception)', url: 'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0100-0199/0197/Sections/0197.472.html' },
        { label: 'F.S. 197.172: Interest rate; calculation and minimum (18% maximum)', url: 'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0100-0199/0197/0197.html' },
        { label: 'F.S. 197.432: Sale of tax certificates (lowest rate wins, quarter-percent steps)', url: 'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0100-0199/0197/Sections/0197.432.html' },
        { label: 'F.S. 197.502: Tax deed application (2 years after April 1 of the year of issuance)', url: 'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0100-0199/0197/Sections/0197.502.html' },
        { label: 'F.S. 197.482: Expiration of tax certificate (7 years)', url: 'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0100-0199/0197/Sections/0197.482.html' }
      ],
      maxRate: 18, step: 0.25, minReturnPct: 5,
      eventLabel: 'Tax deed application filed (date)',
      eventHint: 'Once a tax deed application is filed, the property is advertised and sold at auction. The county sets the dates; enter the county-confirmed deadline below when you have it.'
    },
    AZ: {
      name: 'Arizona',
      method: 'Bid-down interest rate, simple interest, a fraction of a month counts as a whole month',
      verifiedOn: '2026-11-18',
      sources: [
        { label: 'A.R.S. 42-18053: Interest on delinquent taxes (16% a year simple; fraction of a month = whole month)', url: 'https://www.azleg.gov/ars/42/18053.htm' },
        { label: 'A.R.S. 42-18114: Successful purchaser (lowest rate; interest from the first day of the month after purchase)', url: 'https://www.azleg.gov/ars/42/18114.htm' },
        { label: 'A.R.S. 42-18153: Amount required for redemption', url: 'https://www.azleg.gov/ars/42/18153.htm' },
        { label: 'A.R.S. 42-18152: When a lien may be fully redeemed', url: 'https://www.azleg.gov/ars/42/18152.htm' },
        { label: 'A.R.S. 42-18201: Action to foreclose the right to redeem (3 to 10 years)', url: 'https://www.azleg.gov/ars/42/18201.htm' }
      ],
      maxRate: 16, step: null, minReturnPct: 0,
      eventLabel: 'Action to foreclose the right to redeem filed (date)',
      eventHint: 'The lien can be redeemed until the treasurer delivers a deed. A foreclosure action filed in court can change how fast that happens.'
    },
    IA: {
      name: 'Iowa',
      method: 'Fixed 2% per month, each fraction of a month counts as a whole month',
      verifiedOn: '2026-11-18',
      sources: [
        { label: 'Iowa Code 447.1: Redemption terms (2% per month; fraction = whole month; minimum $1)', url: 'https://www.legis.iowa.gov/docs/code/447.1.pdf' },
        { label: 'Iowa Code 447.9: Notice of expiration (after 1 year 9 months from the sale; 90 days)', url: 'https://www.legis.iowa.gov/docs/code/447.9.pdf' },
        { label: 'Iowa Code 447.12: When service is complete (redemption lasts 90 days after service)', url: 'https://www.legis.iowa.gov/docs/code/447.12.pdf' },
        { label: 'Iowa Code 448.1: Deed (after 90 days from completed service)', url: 'https://www.legis.iowa.gov/docs/code/448.1.pdf' }
      ],
      fixedRatePct: 24, monthlyPct: 2,
      eventLabel: 'Notice of expiration: date service was completed',
      eventHint: 'Service is complete only after the holder files an affidavit with the county treasurer. Redemption stays open for 90 days after that date.'
    }
  };

  const NOT_ADVICE = 'Projected figures are estimates, not guaranteed profits. Redemption can happen at any time, the property owner decides when, and you can lose money if a lien is worthless or a sale is voided. Confirm every amount and date with the county tax collector or treasurer.';

  const verified = st => !!RULES[String(st || '').toUpperCase()];

  function num(v) { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[$,%\s]/g, '')); return isFinite(n) ? n : null; }

  // ---------- the estimate ----------
  // h: { state, paid, rate, bought, months, status, closed, deedApplied, countyDeadline, extra }
  // opts: { asOf: 'YYYY-MM-DD' }  (the redemption / valuation date; default today, or the closing date for closed liens)
  function estimate(h, opts) {
    opts = opts || {};
    const st = String(h.state || '').toUpperCase(), R = RULES[st] || null;
    const paid = num(h.paid), bought = parse(h.bought);
    let asOf = parse(opts.asOf) || parse(todayISO());
    const closed = h.status && h.status !== 'open' && parse(h.closed);
    if (!opts.asOf && closed) asOf = closed;
    const out = { state: st, verified: !!R, basis: R ? 'statute' : 'basic', label: R ? R.name + ' rules' : 'Basic estimate (state rules not verified)',
      method: R ? R.method : 'Simple interest: amount x rate x days / 365', invest: paid, asOf: iso(asOf), interest: null, total: null, rateUsed: null, monthsCharged: null,
      floorApplied: false, dates: [], steps: [], missing: [], warnings: [], sources: R ? R.sources : [], verifiedOn: R ? R.verifiedOn : null, disclaimer: NOT_ADVICE };

    if (paid == null || paid < 0) out.missing.push('The amount you paid');
    if (!bought) out.missing.push('The date you bought the lien');
    const extra = Math.max(0, num(h.extra) || 0);
    const rate = num(h.rate);
    const county = parse(h.countyDeadline), event = parse(h.deedApplied);

    if (!R) {
      // ----- BASIC ESTIMATE: honest fallback, no invented legal rules -----
      out.rateUsed = rate;
      if (rate == null) out.missing.push('The interest rate or penalty that applies');
      if (paid != null && bought && rate != null) {
        const days = Math.max(0, Math.floor((asOf - bought) / 864e5));
        out.interest = round2(paid * (rate / 100) * days / 365); out.total = round2(paid + out.interest);
        out.steps.push(money(paid) + ' x ' + rate + '% x ' + days + ' days / 365 = ' + money(out.interest) + ' (simple interest, as of ' + out.asOf + ')');
      }
      out.steps.push('This is only a basic estimate. We have not verified ' + st + "'s tax lien rules, so penalties, premium bids, minimum interest, fees and the legal start date are NOT modeled.");
      out.missing.push('The state statute and county rules (not yet verified on PricePocketAsset)');
      const mo = num(h.months);
      if (bought && mo) out.dates.push({ key: 'basic', label: 'Purchase date + ' + mo + ' months (not a legal deadline)', date: iso(addMonthsClamped(bought, mo)), kind: 'basic', note: 'Shown only because you entered the months. Real redemption deadlines depend on the state and on events such as notices and deed applications.' });
      else out.missing.push('Redemption period or deadline from the county');
    } else {
      // ----- VERIFIED STATES -----
      if (st === 'FL') flCompute(h, R, out, paid, bought, asOf, rate, extra);
      if (st === 'AZ') azCompute(h, R, out, paid, bought, asOf, rate, extra);
      if (st === 'IA') iaCompute(h, R, out, paid, bought, asOf, extra);
      if (event) out.dates.push({ key: 'event', label: R.eventLabel.replace(/ \(date\)$/, ''), date: iso(event), kind: 'user', note: 'Entered by you.' });
    }

    if (county) out.dates.push({ key: 'county', label: 'Deadline confirmed by the county', date: iso(county), kind: 'county', note: 'Entered by you from a county notice or payoff letter. This is the date that controls.' });
    else out.missing.push('A deadline confirmed in writing by the county (we cannot see county records)');
    return out;
  }

  function money(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function flCompute(h, R, out, paid, bought, asOf, rate, extra) {
    out.rateUsed = rate;
    if (rate == null) out.missing.push('Your winning bid rate (the interest rate on your certificate)');
    else {
      if (rate < 0 || rate > R.maxRate) out.warnings.push('Florida certificates cannot bear more than ' + R.maxRate + '% a year (F.S. 197.172). Check the rate on your certificate.');
      if (Math.abs(rate / R.step - Math.round(rate / R.step)) > 1e-9) out.warnings.push('Florida bids go in steps of one-quarter of 1 percent. Check the rate on your certificate.');
    }
    if (extra) out.warnings.push('Later-year taxes or fees are not added for Florida yet. Ask the tax collector for the exact payoff.');
    if (paid != null && bought && rate != null) {
      const months = Math.max(1, monthIndex(asOf) - monthIndex(bought) + 1);
      out.monthsCharged = months;
      const earned = round2(paid * (rate / 100) * months / 12);
      const floor = round2(paid * R.minReturnPct / 100);
      out.steps.push('Interest by the bid rate: ' + money(paid) + ' x ' + rate + '% x ' + months + '/12 = ' + money(earned) + ' (' + months + ' calendar months, counting the month of purchase and the month of redemption; interest is calculated from the first day of each month, F.S. 197.172).');
      if (rate === 0) { out.interest = earned; out.steps.push('Your bid rate is 0%, so the 5% mandatory minimum does NOT apply (F.S. 197.472(2) excludes 0% bids).'); }
      else if (earned < floor) { out.interest = floor; out.floorApplied = true; out.steps.push('Because the interest earned (' + money(earned) + ') is less than 5% of the face amount, Florida levies the 5% mandatory minimum: ' + money(paid) + ' x 5% = ' + money(floor) + ' (F.S. 197.472(2)). The redeemer pays whichever is greater.'); }
      else { out.interest = earned; out.steps.push('The interest by the bid rate is at least the 5% minimum (' + money(floor) + '), so the minimum does not change the result.'); }
      out.total = round2(paid + out.interest);
      out.steps.push('Projected redemption total = amount paid + interest = ' + money(paid) + ' + ' + money(out.interest) + ' = ' + money(out.total) + ' (if the owner redeems on ' + out.asOf + '). The $6.25 redemption fee is charged to the person redeeming and is not deducted from your payout (F.S. 197.472(3), (5)).');
    }
    if (bought) {
      const Y = bought.getUTCFullYear();
      out.dates.push({ key: 'deed', label: 'Earliest date you can apply for a tax deed', date: Y + 2 + '-04-01', kind: 'statute', note: 'Two years after April 1 of the year the certificate was issued (F.S. 197.502(1)). Calculated from your purchase year; the county can confirm the issuance year.' });
      out.dates.push({ key: 'expire', label: 'Certificate expires if no deed application is filed', date: iso(addYears(bought, 7)), kind: 'estimate', note: 'Seven years after the date of issuance, which is the first day of the advertised sale (F.S. 197.482). Estimated from your purchase date; the county can confirm the exact first day of the sale.' });
    }
    out.steps.push('Redemption timing: Florida has no fixed redemption date for the owner. The owner may redeem at any time before a tax deed is issued, so the date of repayment, and your total, cannot be known in advance.');
    if (!h.deedApplied) out.missing.push('Whether a tax deed application has been filed (it can end the redemption period at the county auction)');
    out.missing.push('The exact first day of the advertised sale and the issuance year (confirm with the tax collector)');
    out.missing.push('Later-year taxes or other costs added to the certificate');
  }

  function azCompute(h, R, out, paid, bought, asOf, rate, extra) {
    out.rateUsed = rate;
    if (rate == null) out.missing.push('Your winning bid rate (the interest rate on your lien)');
    else if (rate < 0 || rate > R.maxRate) out.warnings.push('Arizona liens cannot bear more than ' + R.maxRate + '% a year (A.R.S. 42-18053 and 42-18114). Check the rate on your certificate.');
    if (paid != null && bought && rate != null) {
      // Interest starts on the first day of the month after purchase; a fraction of a month counts as a whole month.
      const months = Math.max(0, monthIndex(asOf) - monthIndex(bought));
      out.monthsCharged = months;
      const base = paid;
      const int1 = round2(base * (rate / 100) * months / 12);
      out.steps.push('Interest starts on the first day of the month after purchase (A.R.S. 42-18114), and a fraction of a month counts as a whole month (A.R.S. 42-18053).');
      out.steps.push(money(base) + ' x ' + rate + '% x ' + months + '/12 = ' + money(int1) + ' (' + months + ' month' + (months === 1 ? '' : 's') + ', simple interest). Arizona has no minimum-interest rule, so none is applied.');
      let int2 = 0;
      if (extra) { out.warnings.push('Later-year taxes: we assume interest on them starts about a month after you paid them. Check the amounts endorsed on your certificate (A.R.S. 42-18153, 42-18121).'); int2 = round2(extra * (rate / 100) * Math.max(0, months - 1) / 12); out.steps.push('Later-year taxes and fees you paid: ' + money(extra) + ' earn the same rate, estimated at ' + money(int2) + ' (A.R.S. 42-18153).'); }
      out.interest = round2(int1 + int2);
      out.total = round2(paid + extra + out.interest);
      out.steps.push('Projected redemption total = lien amount + later payments + interest = ' + money(paid) + ' + ' + money(extra) + ' + ' + money(out.interest) + ' = ' + money(out.total) + ' (if redeemed on ' + out.asOf + ').');
    }
    if (bought) {
      out.dates.push({ key: 'fc', label: 'Earliest date to file an action to foreclose the right to redeem', date: iso(addYears(bought, 3)), kind: 'statute', note: 'Beginning three years after the sale (A.R.S. 42-18201). The owner can still redeem until the treasurer delivers a deed (A.R.S. 42-18152).' });
      out.dates.push({ key: 'fclast', label: 'Last date to file that action', date: iso(addYears(endOfMonth(bought), 10)), kind: 'statute', note: 'Not later than ten years after the last day of the month the lien was acquired (A.R.S. 42-18201). A court order that blocks filing can extend this.' });
    }
    out.steps.push('Redemption timing: the owner can redeem at any time, including after three years, until a treasurer\'s deed is delivered. A foreclosure lawsuit is required before a deed.');
    if (!h.deedApplied) out.missing.push('Whether a foreclosure action has been filed in superior court');
    out.missing.push('Later-year taxes and fees endorsed on your certificate');
  }

  function iaCompute(h, R, out, paid, bought, asOf, extra) {
    out.rateUsed = R.fixedRatePct;
    const given = num(h.rate);
    if (given != null && given !== R.fixedRatePct) out.warnings.push('Iowa pays a fixed 2% per month (24% a year). The rate you typed (' + given + '%) was not used (Iowa Code 447.1).');
    if (paid != null && bought) {
      const months = Math.max(1, monthIndex(asOf) - monthIndex(bought) + 1);
      out.monthsCharged = months;
      const raw = (paid + 0) * (R.monthlyPct / 100) * months;
      let interest = Math.round(raw); if (interest < 1) interest = 1;
      out.steps.push('Interest is 2% per month, counting each fraction of a month as a whole month, from the month of sale (Iowa Code 447.1).');
      out.steps.push(money(paid) + ' x 2% x ' + months + ' month' + (months === 1 ? '' : 's') + ' = ' + money(raw) + ', rounded to the nearest whole dollar (minimum $1) = ' + money(interest) + '.');
      let int2 = 0;
      if (extra) { int2 = Math.round(extra * (R.monthlyPct / 100) * Math.max(1, months - 1)); out.warnings.push('Later-year payments earn the same rate from the month you paid them. We estimated that as one month after the sale month; enter exact payment dates with the treasurer.'); out.steps.push('Later-year taxes you paid: ' + money(extra) + ' estimated interest ' + money(int2) + '.'); }
      out.interest = interest + int2;
      out.total = round2(paid + extra + out.interest);
      out.steps.push('Projected redemption total = amount paid + later payments + interest = ' + money(paid) + ' + ' + money(extra) + ' + ' + money(out.interest) + ' = ' + money(out.total) + '. A redemption must reach the treasurer by the last day of the month, or another month of interest is added.');
    }
    if (bought) {
      out.dates.push({ key: 'notice', label: 'Earliest date the holder may serve the notice of expiration', date: iso(addMonthsClamped(bought, 21)), kind: 'statute', note: 'After one year and nine months from the date of sale (Iowa Code 447.9). The right of redemption does NOT end on this date.' });
    }
    const served = parse(h.deedApplied);
    if (served) {
      const raw = addDays(served, 90), adj = nextBusinessDay(raw);
      out.dates.push({ key: 'expire', label: 'Right of redemption expires (90 days after completed service)', date: iso(adj), kind: 'statute', note: 'Ninety days after service is complete (Iowa Code 447.12), moved to the next business day if it lands on a weekend. County holidays are not modeled, so confirm the date with the treasurer.' });
    } else {
      out.missing.push('The date the notice of expiration was served and the affidavit filed (starts the 90 days)');
    }
    out.steps.push('Redemption timing: the right of redemption ends 90 days after the notice is completely served, not on a date counted from the purchase.');
    out.missing.push('Later-year taxes you paid and the month you paid them');
  }

  const api = { RULES, estimate, verified, NOT_ADVICE, helpers: { parse, iso, addYears, addMonthsClamped, endOfMonth, nextBusinessDay, monthIndex, money } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LienCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
