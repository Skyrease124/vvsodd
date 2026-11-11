// State Master Class: one class per state, built only from the site's own checked state data
// (STATES, STATE_DATA sale rules with statute links, FL_SALE, and the county lists we carry). Nothing is invented here.
(function () {
  const API = '/.netlify/functions/learn';
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const link = (t, u) => { const a = mk('a', '', t); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
  const code = (new URLSearchParams(location.search).get('s') || '').toUpperCase();
  const st = STATES.find(s => s.a === code);
  const SYS = {
    'Tax lien certificate': 'This is a tax lien state. At the sale you pay the owner’s overdue property tax and get a certificate (a lien). The owner keeps the property and must pay you back with interest or a penalty to clear it. If they never do within the legal time, you may be able to start the process to take the property.',
    'Tax deed': 'This is a tax deed state. The county does not sell liens to investors. After the owner has been behind long enough, the county auctions the property itself, and the winner gets a deed. You earn by buying below value, not from interest.',
    'Redeemable deed': 'This is a redeemable deed state. You buy the deed at the tax sale, but the former owner can still buy it back for a set time by paying your price plus a premium set by law. If they don’t, you keep the property.',
    'Hybrid': 'This state uses more than one method (for example liens in some cases and deeds or negotiated sales in others). Check how your county sells before you register.',
    'Municipal lien': 'Here the town or city usually takes the tax lien itself instead of selling it to investors, so there is little or no public lien sale. Investors mostly see property only when a town later sells what it took.',
    'Sources differ': 'Official and expert sources describe this state’s system differently, or it varies by county. Treat anything you read as unconfirmed and check the county’s own sale notice and the state statute.'
  };
  const BID = {
    'Bid-down rate': 'Bidding starts at the maximum rate and goes down. The lowest rate wins, so the rate you actually earn is often well below the maximum.',
    'Premium bidding': 'The rate is fixed, and bidders compete by paying extra above the amount owed. That premium usually earns no interest and may not be refunded, so overbidding cuts your real return.',
    'Not applicable': 'There is no rate to bid. In deed and redeemable-deed sales, bidders compete on the price.',
    'Other': 'Winners are picked another way here (for example by rotation, random draw, or a different bid). Read the county’s sale rules.'
  };
  if (!st) { $('cls').appendChild(mk('p', '', 'State not found.')); const a = mk('a', 'btn', 'Pick a state'); a.href = '/learn/#states'; $('cls').appendChild(a); return; }
  document.title = st.n + ' Master Class | PricePocketAsset';
  const D = (typeof STATE_DATA !== 'undefined' && STATE_DATA[code]) || null;
  const sale = code === 'FL' ? {title: 'Tax certificate sale (Florida)', when: FL_SALE.nextSale + '. ' + FL_SALE.listsPosted + '.', steps: FL_SALE.steps, links: [FL_SALE.statute, FL_SALE.portal]} : (D && D.sale);
  const counties = (typeof LIEN_SUMMARY !== 'undefined' ? LIEN_SUMMARY : []).filter(x => x.state === code);

  // Quiz, built from this state's own data and other states' data as wrong answers.
  let seed = code.charCodeAt(0) * 31 + code.charCodeAt(1); const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const others = (key, n) => { const vals = []; const pool = STATES.filter(s => s.a !== code && s[key] && s[key] !== st[key]).sort(() => rnd() - 0.5); for (const s of pool) { if (!vals.includes(s[key])) vals.push(s[key]); if (vals.length >= n) break; } return vals; };
  const mkQ = (q, right, wrong, why) => { const a = [right].concat(wrong); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return {q, a, c: a.indexOf(right), why}; };
  const quiz = [
    mkQ('What kind of system does ' + st.n + ' use?', st.sys, ['Tax lien certificate', 'Tax deed', 'Redeemable deed', 'Municipal lien'].filter(x => x !== st.sys).sort(() => rnd() - 0.5).slice(0, 2), st.n + ': ' + st.sys + '. ' + st.note),
    mkQ('What does an investor earn in ' + st.n + '?', st.rate, others('rate', 2), 'Our ' + st.n + ' guide: ' + st.rate + '.'),
    mkQ('How long is the redemption period in ' + st.n + '?', st.red, others('red', 2), 'Our ' + st.n + ' guide: ' + st.red + '.')
  ];

  let paid = false, signedIn = false, progress = {};
  function render() {
    const box = $('cls'); box.textContent = '';
    const back = mk('a', 'btn small ghost', '← All classes'); back.href = '/learn/#states'; box.appendChild(back);
    box.appendChild(mk('p', 'small muted', 'State Master Class'));
    box.appendChild(mk('h1', '', st.n + ' Master Class'));
    if (code === 'FL' || code === 'TX' || code === 'AZ' || code === 'IA' || code === 'MI' || code === 'CO') { const fc = mk('div', 'mccard gold'); fc.append(mk('b', '', 'The full ' + st.n + ' course is ready'), mk('span', 'small', '12 modules with citations, quizzes, a Bid or Pass exercise and a final project.')); const a = mk('a', 'btn small', 'Open the full course'); a.href = '/learn/course/?c=' + code.toLowerCase(); fc.appendChild(a); box.appendChild(fc); }
    const done = progress['st_' + code]; if (done && done.score >= 2) box.appendChild(mk('p', '', '✔ You passed this class (' + done.score + '/3).'));
    if (st.v) box.appendChild(mk('div', 'notice', 'Heads-up: sources disagree on parts of ' + st.n + '’s rules. Treat the details below as unconfirmed and check the statute and the county’s notice.'));
    const facts = mk('dl', 'stfacts'); [['System', st.sys], ['Investor return', st.rate], ['Redemption period', st.red], ['How bidding works', st.bid]].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); facts.appendChild(d); }); box.appendChild(facts);
    box.appendChild(mk('h2', '', '1. How ' + st.n + ' works')); box.appendChild(mk('p', '', SYS[st.sys] || '')); box.appendChild(mk('p', '', st.note));
    if (!paid) {
      const n = mk('div', 'salebox'); n.append(mk('h3', '', '🔒 The rest of the ' + st.n + ' class is for members'), mk('p', '', 'Members get the full class for every state: returns and bidding, redemption and timeline, the step-by-step sale process with the law behind it, where to buy, the counties we track, and a quiz.'));
      const a = mk('a', 'btn', signedIn ? 'Become a member ($5.50 a week)' : 'Sign in or create an account'); a.href = signedIn ? '/account/' : '/login/?next=' + encodeURIComponent(location.pathname + location.search); n.appendChild(a); box.appendChild(n); foot(box); return;
    }
    box.appendChild(mk('h2', '', '2. How you earn here'));
    box.appendChild(mk('p', '', 'Return: ' + st.rate + '.')); box.appendChild(mk('p', '', BID[st.bid] || ''));
    if (st.sys === 'Tax lien certificate' && st.r && (/^Up to \d+%$/.test(st.rate) || (/a year/.test(st.rate) && !/per |of the|month|county/i.test(st.rate)))) box.appendChild(mk('p', 'small muted', 'Example at the maximum: a $1,000 lien at ' + st.r + '% a year earns about $' + Math.round(st.r * 10) + ' if the owner pays after one year. Bidding, fees and how the state counts interest can change this, so use the calculator with your real numbers.'));
    box.appendChild(mk('h2', '', '3. Redemption and timeline'));
    box.appendChild(mk('p', '', st.red + '.'));
    box.appendChild(mk('p', '', st.sys === 'Tax deed' ? 'In a deed state the owner’s chance to pay usually ends before the sale, so the winner gets the property, subject to the state’s rules on what claims survive.' : 'Most owners (or their mortgage lenders) pay before the deadline. Plan on earning the return, not on getting the property, and never contact or pressure the owner.'));
    box.appendChild(mk('h2', '', '4. How the sale works in ' + st.n));
    if (sale) {
      if (sale.when) box.appendChild(mk('p', '', 'When: ' + sale.when));
      const ol = mk('ol', 'salesteps'); sale.steps.forEach(s => ol.appendChild(mk('li', '', s))); box.appendChild(ol);
      const p = mk('p', 'small'); p.append('The law and official pages: '); (sale.links || []).forEach((l, i) => { if (i) p.append(' · '); p.appendChild(link(l[0], l[1])); }); box.appendChild(p);
    } else box.appendChild(mk('p', '', 'We have not yet checked ' + st.n + '’s sale steps against the statute, so we don’t list them here. Use the official county pages below and read the county’s current sale notice.'));
    box.appendChild(mk('h2', '', '5. Where to look and buy'));
    if (counties.length) { const p = mk('p', ''); p.append('Counties with real lists on our site: '); counties.forEach((c, i) => { if (i) p.append(', '); const a = mk('a', '', c.county + ' (' + c.count.toLocaleString() + ')'); a.href = code === 'FL' ? '/liens/states/county/?c=' + encodeURIComponent(c.county) : '/liens/states/state/?s=' + code; p.appendChild(a); }); box.appendChild(p); }
    const ul = mk('ul'); (st.links || []).slice(0, 8).forEach(l => { const li = mk('li'); li.appendChild(link(l[0], l[1])); ul.appendChild(li); }); box.appendChild(ul);
    const sp = mk('p'); const sa = mk('a', 'btn ghost', 'Open the full ' + st.n + ' page'); sa.href = '/liens/states/state/?s=' + code; sp.appendChild(sa); box.appendChild(sp);
    box.appendChild(mk('h2', '', '6. Before you buy here'));
    const ul2 = mk('ul'); ['Read the county’s current sale notice: dates, registration, deposits and fees change every year.', 'Check every property: Land Information (flood, wetlands, road access), the county record, and other unpaid years.', st.sys === 'Tax deed' || st.sys === 'Redeemable deed' ? 'Find out which liens and claims survive the sale, and budget for a quiet title action.' : 'Know the deadline to act if the owner doesn’t pay, so your lien doesn’t expire.', 'Only buy from the county or its official auction site.'].forEach(t => ul2.appendChild(mk('li', '', t))); box.appendChild(ul2);
    // quiz
    box.appendChild(mk('h2', '', st.n + ' quiz'));
    const f = mk('form', 'quiz');
    quiz.forEach((q, i) => { const fs = mk('fieldset'); fs.appendChild(mk('legend', '', (i + 1) + '. ' + q.q)); q.a.forEach((ans, j) => { const lab = mk('label'); const r = mk('input'); r.type = 'radio'; r.name = 'q' + i; r.value = j; lab.append(r, mk('span', '', ans)); fs.appendChild(lab); }); f.appendChild(fs); });
    const sub = mk('button', 'btn', 'Check my answers'); sub.type = 'submit'; const res = mk('p'); res.setAttribute('role', 'status'); f.append(sub, res); box.appendChild(f);
    f.addEventListener('submit', async e => {
      e.preventDefault(); let score = 0;
      quiz.forEach((q, i) => { const sel = f.querySelector('input[name=q' + i + ']:checked'); const fs = f.querySelectorAll('fieldset')[i]; const old = fs.querySelector('.why'); if (old) old.remove(); const ok = sel && Number(sel.value) === q.c; if (ok) score++; fs.appendChild(mk('p', 'why ' + (ok ? 'ok' : 'bad'), (ok ? '✔ Right. ' : '✖ The answer is: ' + q.a[q.c] + '. ') + q.why)); });
      res.textContent = 'You got ' + score + ' of 3. ' + (score >= 2 ? st.n + ' class passed!' : 'Review the class and try again.');
      try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: 'st_' + code, score})}); const x = await r.json(); if (x.progress) progress = x.progress; } catch (er) {}
    });
    foot(box);
  }
  function foot(box) { box.appendChild(mk('p', 'small muted', 'Built from the official sources listed on our ' + st.n + ' page. Educational only, not legal, tax or investment advice. Laws change; confirm with the county and the statute.')); }
  fetch(API).then(r => r.json()).then(d => { paid = !!d.paid; signedIn = !!d.signedIn; progress = d.progress || {}; render(); }).catch(render);
})();
