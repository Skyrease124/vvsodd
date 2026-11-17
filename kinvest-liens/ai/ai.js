// PricePocket AI page: map to focus states + a chat box. Answers come from /.netlify/functions/ai.
(function () {
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const COL = {'Tax lien certificate':'#22c55e','Tax deed':'#3b82f6','Redeemable deed':'#f59e0b','Hybrid':'#a855f7','Municipal lien':'#06b6d4','Sources differ':'#94a3b8'};
  const by = {}; STATES.forEach(s => by[s.a] = s);
  const selected = new Set();

  let svgEl = null, badgeLayer = null, fxLayer = null, heatLayer = null;
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SUMMARY = typeof LIEN_SUMMARY !== 'undefined' ? LIEN_SUMMARY : [];
  const TOTALS = {}; SUMMARY.forEach(x => { TOTALS[x.state] = (TOTALS[x.state] || 0) + x.count; });
  const NS = 'http://www.w3.org/2000/svg';
  const sn = (t, at) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = k => Math.max(0, Math.min(255, Math.round(((n >> k) & 255) * f))); return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')'; };
  function drawMap() {
    const svg = sn('svg', {viewBox: '30 55 915 520', role: 'group', 'aria-label': 'Map of US states. Tap states to focus the AI.'}); svgEl = svg;
    const defs = sn('defs', {});
    Object.keys(COL).forEach((k, i) => { const g = sn('linearGradient', {id: 'ag' + i, x1: '0', y1: '0', x2: '0', y2: '1'}); g.appendChild(sn('stop', {offset: '0', 'stop-color': shade(COL[k], 1.22)})); g.appendChild(sn('stop', {offset: '1', 'stop-color': shade(COL[k], 0.78)})); defs.appendChild(g); });
    const bl = sn('filter', {id: 'aiblur', x: '-10%', y: '-10%', width: '120%', height: '130%'}); bl.appendChild(sn('feGaussianBlur', {stdDeviation: '7'})); defs.appendChild(bl);
    svg.appendChild(defs);
    const GRAD = {}; Object.keys(COL).forEach((k, i) => GRAD[k] = 'url(#ag' + i + ')');
    let idx = 0;
    const sh = sn('g', {class: 'aishadow', 'pointer-events': 'none'}), ex = sn('g', {class: 'aiextr', 'pointer-events': 'none'});
    sh.setAttribute('filter', 'url(#aiblur)'); svg.appendChild(sh); svg.appendChild(ex);
    const stg = sn('g', {}); svg.appendChild(stg); fxLayer = sn('g', {'pointer-events': 'none'});
    Object.keys(MAP_PATHS).forEach(a => {
      const s = by[a]; if (!s) return;
      const p = sn('path', {d: MAP_PATHS[a], class: 'aist', style: 'fill:' + (GRAD[s.sys] || COL[s.sys] || '#94a3b8') + ';--i:' + (idx++), tabindex: '0', role: 'button', 'aria-pressed': 'false', 'aria-label': s.n, 'data-a': a});
      const toggle = () => { if (selected.has(a)) selected.delete(a); else selected.add(a); p.classList.toggle('on', selected.has(a)); p.setAttribute('aria-pressed', String(selected.has(a))); ripple(p); label(a); stateCard(selected.has(a) ? a : ([...selected].pop() || null)); if (selected.has(a)) zoomTo([...selected]); else if (!selected.size) zoomOut(); else zoomTo([...selected]); };
      p.addEventListener('click', toggle); p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      const t = sn('title', {}); t.textContent = s.n + ': ' + s.sys; p.appendChild(t);
      stg.appendChild(p);
      const base = col => { const d = sn('path', {d: MAP_PATHS[a], class: 'aibase', style: 'fill:' + col + ';--i:' + (idx - 1), 'data-a': a}); return d; };
      const c0 = COL[s.sys] || '#94a3b8';
      ex.appendChild(base(shade(c0, .38))); const e2 = base(shade(c0, .5)); e2.classList.add('e2'); ex.appendChild(e2);
      const sd = sn('path', {d: MAP_PATHS[a]}); sh.appendChild(sd);
    });
    svg.appendChild(fxLayer);
    // pulsing dots where real lien lists exist
    Object.keys(TOTALS).forEach(a => {
      const el = stg.querySelector('[data-a="' + a + '"]'); let pos = typeof MAP_LABELS !== 'undefined' && MAP_LABELS[a]; if (!pos && el) { const bb = el.getBBox(); pos = [bb.x + bb.width / 2, bb.y + bb.height / 2 + 16]; } if (!pos) return;
      const r = Math.max(5, Math.min(13, 4 + Math.log10(TOTALS[a] + 1) * 2.4));
      if (el) el.classList.add('haslive');
      const g = sn('g', {class: 'live', transform: 'translate(' + pos[0] + ',' + (pos[1] - 16) + ')', 'pointer-events': 'none'});
      g.appendChild(sn('line', {class: 'beam3d', x1: 0, y1: 0, x2: 0, y2: -22})); g.appendChild(sn('ellipse', {class: 'foot', rx: r + 3, ry: (r + 3) * .45})); g.appendChild(sn('circle', {class: 'ring', r: r + 1})); g.appendChild(sn('circle', {class: 'ring r2', r: r + 1})); g.appendChild(sn('circle', {class: 'core', r}));
      svg.appendChild(g);
    });
    heatLayer = sn('g', {class: 'aiheats', 'pointer-events': 'none'}); svg.appendChild(heatLayer);
    badgeLayer = sn('g', {class: 'badges', 'pointer-events': 'none'}); svg.appendChild(badgeLayer);
    $('aimap').appendChild(svg);
    try { const bb = stg.getBBox(), pad = 14; const x0 = Math.max(bb.x - pad, 18), x1 = bb.x + bb.width + pad; svg.setAttribute('viewBox', [x0, bb.y - pad, x1 - x0, bb.height + pad * 2].join(' ')); } catch (e) {}
    baseVB = parseVB(svg.getAttribute('viewBox'));
  }
  // Gentle 3D tilt: follows a finger or mouse over the map, and sways slowly when idle. Paused when hidden or with reduced motion.
  function tilt() {
    const stage = $('aistage'), map = $('aimap'); if (!stage || !map || REDUCED) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, idle = 0;
    const set = () => { map.style.transform = 'rotateX(' + (16 - cy * 5).toFixed(2) + 'deg) rotateY(' + (cx * 9).toFixed(2) + 'deg)'; };
    const run = () => { cx += (tx - cx) * .12; cy += (ty - cy) * .12; set(); raf = (Math.abs(tx - cx) + Math.abs(ty - cy) > .002) ? requestAnimationFrame(run) : 0; };
    const kick = () => { if (!raf) raf = requestAnimationFrame(run); };
    const aim = e => { const r = stage.getBoundingClientRect(), q = e.touches ? e.touches[0] : e; tx = Math.max(-1, Math.min(1, ((q.clientX - r.left) / r.width - .5) * 2)); ty = Math.max(-1, Math.min(1, ((q.clientY - r.top) / r.height - .5) * 2)); kick(); clearTimeout(idle); idle = setTimeout(() => { tx = 0; ty = 0; kick(); }, 1800); };
    ['pointermove', 'touchmove'].forEach(n => stage.addEventListener(n, aim, {passive: true}));
  }
  // ---- Fly-to zoom: the map eases in on the states in an answer, and back out on Reset ----
  let baseVB = null, vbAnim = 0;
  const parseVB = v => v.split(/\s+/).map(Number);
  function flyTo(vb) {
    if (!svgEl || !baseVB) return; const k = baseVB[2] / vb[2], W = svgEl.getBoundingClientRect().width || 1, px = W / baseVB[2] / 1;
    const dx = ((baseVB[0] + baseVB[2] / 2) - (vb[0] + vb[2] / 2)) * px, dy = ((baseVB[1] + baseVB[3] / 2) - (vb[1] + vb[3] / 2)) * px;
    svgEl.style.transform = k === 1 && !dx && !dy ? '' : 'scale(' + k.toFixed(3) + ') translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
  }
  function zoomTo(codes) {
    if (!svgEl || !baseVB) return; const els = codes.map(c => svgEl.querySelector('.aist[data-a="' + c + '"]')).filter(Boolean); if (!els.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; els.forEach(e => { const b = e.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); });
    const ar = baseVB[2] / baseVB[3]; let w = Math.max(x1 - x0, 360) * 1.3, h = Math.max(y1 - y0, 360 / ar) * 1.3; if (w / h < ar) w = h * ar; else h = w / ar;
    if (w >= baseVB[2] * .85) return flyTo(baseVB);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; flyTo([cx - w / 2, cy - h / 2 + 12, w, h]);
  }
  function zoomOut() { if (baseVB) flyTo(baseVB); }
  // ---- State info card: tap a state to see its key facts ----
  function stateCard(a) {
    const box = $('aicard'); if (!box) return; box.textContent = ''; if (!a) { box.hidden = true; return; }
    const st = by[a]; box.hidden = false;
    const h = mk('div', 'aich'); h.append(mk('b', '', st.n), mk('span', 'aipill', st.sys)); const x = mk('button', 'aix', '\u00d7'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', () => { selected.delete(a); const p = svgEl.querySelector('.aist[data-a="' + a + '"]'); if (p) { p.classList.remove('on'); p.setAttribute('aria-pressed', 'false'); } label(); stateCard(null); }); h.appendChild(x); box.appendChild(h);
    const dl = mk('dl', 'aidl'); [['Interest / penalty', st.rate], ['Redemption', st.red], ['Bidding', st.bid], ['Listings on the site', TOTALS[a] ? TOTALS[a].toLocaleString('en-US') : 'No parcel list yet']].forEach(([k, v]) => { if (!v) return; const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); }); box.appendChild(dl);
    if (st.v) box.appendChild(mk('p', 'small muted', 'Sources differ for this state \u2014 verify with the county.'));
    const act = mk('div', 'aiact'); const q = mk('button', 'btn small', 'Ask the AI about ' + st.n); q.type = 'button'; q.addEventListener('click', () => ask('Tell me how tax sales work in ' + st.n + ' and what to check before bidding'));
    const pg = mk('a', 'btn small ghost', 'Open ' + a + ' page'); pg.href = '../liens/states/state/?s=' + a; act.append(q, pg); box.appendChild(act);
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  }
  // Mouse tilt on answer cards (touch screens keep the flat press effect so scrolling is never disturbed).
  (function () {
    if (REDUCED || !window.matchMedia || !matchMedia('(hover: hover)').matches) return;
    const chat = $('chat'); if (!chat) return; let cur = null;
    const off = () => { if (cur) { cur.classList.remove('tilt'); cur.style.removeProperty('--tx'); cur.style.removeProperty('--ty'); cur = null; } };
    chat.addEventListener('pointermove', e => {
      const c = e.target.closest && e.target.closest('.scard,.tablewrap'); if (!c) return off(); if (cur && cur !== c) off();
      const r = c.getBoundingClientRect(); cur = c; c.classList.add('tilt');
      c.style.setProperty('--ty', (((e.clientX - r.left) / r.width - .5) * 6).toFixed(2) + 'deg'); c.style.setProperty('--tx', ((.5 - (e.clientY - r.top) / r.height) * 4).toFixed(2) + 'deg');
    });
    chat.addEventListener('pointerleave', off);
  })();
  function ripple(p) {
    if (REDUCED || !fxLayer) return; const bb = p.getBBox();
    for (let k = 0; k < 2; k++) { const c = sn('circle', {class: 'airipple', cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2, r: 60, style: 'animation-delay:' + (k * 160) + 'ms'}); fxLayer.appendChild(c); setTimeout(() => c.remove(), 1400); }
  }
  function label(last) {
    const l = [...selected].map(a => by[a].n);
    const info = a => by[a].n + ' \u00b7 ' + by[a].sys + (TOTALS[a] ? ' \u00b7 ' + TOTALS[a].toLocaleString('en-US') + ' listings' : '');
    $('aisel').textContent = l.length > 1 ? 'Focused: ' + l.join(', ') : l.length === 1 ? 'Focused: ' + info([...selected][0]) : (last ? info(last) : 'Tap states to focus, or just ask');
    $('aiclear').hidden = !l.length && !document.querySelector('.aist.hit');
  }
  // The map reacts to answers: states in the answer glow, the rest dim, and gold badges show rank or count.
  function react(d) {
    clearReact();
    const codes = []; const counts = {};
    if (d.kind === 'states' || d.kind === 'liens') (d.results || []).forEach(r => { if (r.state) { if (!codes.includes(r.state)) codes.push(r.state); counts[r.state] = (counts[r.state] || 0) + 1; } });
    else (d.scope || []).forEach(c => codes.push(c));
    if (!codes.length) return;
    document.querySelectorAll('.aist').forEach(p => { const code = p.getAttribute('data-a'); p.classList.toggle('hit', codes.includes(code)); p.classList.toggle('dim', !codes.includes(code)); });
    const ranked = d.kind === 'states' && ['rate', 'months'].includes(d.sortBy);
    codes.forEach((c, i) => {
      let pos = typeof MAP_LABELS !== 'undefined' && MAP_LABELS[c];
      if (!pos) { const el = document.querySelector('.aist[data-a="' + c + '"]'); if (el) { const bb = el.getBBox(); pos = [bb.x + bb.width / 2, bb.y + bb.height / 2]; } }
      if (!pos) return;
      const g = sn('g', {class: 'badge', transform: 'translate(' + pos[0] + ',' + pos[1] + ')', style: '--d:' + (i * 90) + 'ms'});
      g.appendChild(sn('circle', {r: 15})); const t = sn('text', {y: 6}); t.textContent = ranked ? String(i + 1) : (d.kind === 'liens' && counts[c] > 1 ? '\u00d7' + counts[c] : '\u2713'); g.appendChild(t);
      badgeLayer.appendChild(g);
    });
    // Heat: ranked answers shade each state from strongest (bright gold) to weakest, drawn on top of the state tile
    if (ranked && fxLayer) { const n = codes.length; codes.forEach((c, i) => { const el = svgEl.querySelector('.aist[data-a="' + c + '"]'); if (!el) return; const hp = sn('path', {d: MAP_PATHS[c], class: 'aiheat', style: 'fill:#ffd166;opacity:' + (0.78 - 0.55 * (n > 1 ? i / (n - 1) : 0)).toFixed(2) + ';animation-delay:' + (i * 70) + 'ms'}); heatLayer.appendChild(hp); }); }
    zoomTo(codes);
    $('aiclear').hidden = false;
  }
  function clearReact() { document.querySelectorAll('.aist.hit,.aist.dim').forEach(p => p.classList.remove('hit', 'dim')); if (badgeLayer) badgeLayer.textContent = ''; if (heatLayer) heatLayer.textContent = ''; }
  $('aiclear').addEventListener('click', () => { selected.clear(); document.querySelectorAll('.aist.on').forEach(p => { p.classList.remove('on'); p.setAttribute('aria-pressed', 'false'); }); clearReact(); stateCard(null); zoomOut(); $('chat').textContent = ''; $('aiidle').hidden = false; label(); });

  function statesTable(rows) {
    const wrap = mk('div', 'tablewrap'), t = mk('table', 'liens aistates'), hr = t.createTHead().insertRow();
    ['State', 'Type', 'Interest / penalty', 'Redemption', 'Bidding'].forEach(h => hr.appendChild(mk('th', '', h)));
    const tb = t.createTBody();
    rows.forEach(r => {
      const tr = tb.insertRow(); const c0 = tr.insertCell(); const a = mk('a', '', r.name); a.href = '../liens/states/state/?s=' + r.state; c0.appendChild(a); if (r.verify) c0.appendChild(mk('span', 'small muted', ' (verify)'));
      c0.dataset.label = 'State'; [['Type', r.system], ['Interest / penalty', r.rate], ['Redemption', r.redemption], ['Bidding', r.bidding]].forEach(([k, v]) => { const td = tr.insertCell(); td.dataset.label = k; td.textContent = v; });
    });
    wrap.appendChild(t); return wrap;
  }
  function lienCards(rows) {
    const box = mk('div');
    rows.forEach((r, i) => {
      const c = mk('article', 'scard'), h = mk('div', 'scardh');
      c.style.setProperty('--k', i);
      const L = {state: r.state, county: r.county, parcel: r.parcel, address: r.area, desc: r.use};
      if ((r.state || 'FL') === 'FL') { const th = mk('div', 'lthumb'); c.appendChild(th); ParcelData.thumb(L, th); }
      else if (typeof LandMap !== 'undefined' && typeof LAND_OUTLINES !== 'undefined' && LAND_OUTLINES[r.county]) { const th = mk('div', 'lthumb loading'); c.appendChild(th); LandMap.thumb(landSpec(L), th); }
      h.append(mk('b', '', (i + 1) + '. ' + r.county + (/^City of /.test(r.county) ? '' : ' County') + ' parcel ' + r.parcel), mk('span', 'sscore', 'Score ' + r.score + '/100'));
      c.appendChild(h);
      c.appendChild(mk('p', 'small muted', [r.area, r.use && r.use.toLowerCase(), r.acres != null && r.acres + ' acres'].filter(Boolean).join(' · ')));
      const dl = mk('dl', 'stfacts');
      [r.noPrice ? ['Price', r.priceNote || 'Not on the list'] : ['Tax owed', '$' + Number(r.face).toFixed(2)], ['County land value', r.market != null ? money(r.market) : 'unknown'], ['Value vs tax owed', r.coverage != null ? Math.round(r.coverage).toLocaleString('en-US') + '\u00d7' : 'n/a']].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); });
      c.appendChild(dl);
      const fl = mk('ul', 'sflags'); (r.green || []).forEach(t => fl.appendChild(mk('li', 'g', t))); (r.red || []).forEach(t => fl.appendChild(mk('li', 'r', t))); c.appendChild(fl);
      const act = mk('div', 'sact');
      const mb = mk('button', 'btn small', 'Show on map'); mb.type = 'button'; mb.addEventListener('click', () => LienMap.open({county: r.county, parcel: r.parcel, amount: r.face, market: r.market, use: r.use, acres: r.acres})); act.appendChild(mb);
      const bb = LienBuy.button({county: r.county, parcel: r.parcel, amount: r.face, certList: r.certList, saleDate: r.saleDate}, 'btn small'); if (bb) act.appendChild(bb);
      act.appendChild(LienSave.button({county: r.county, parcel: r.parcel, face: r.face, market: r.market, use: r.use, acres: r.acres, certList: r.certList, saleDate: r.saleDate}, 'btn small ghost'));
      const st = mk('a', 'btn small ghost', 'Open ' + r.state + ' page'); st.href = '../liens/states/state/?s=' + r.state; act.appendChild(st);
      c.appendChild(act); box.appendChild(c);
    });
    return box;
  }

  function add(q) {
    $('chat').textContent = ''; clearReact(); // one answer at a time
    const turn = mk('section', 'aiturn');
    turn.appendChild(mk('p', 'aiq', 'You: ' + q));
    const out = mk('div', 'aiout thinking'); out.append(mk('span', 'aidots'), mk('span', '', ' Scanning the map\u2026')); turn.appendChild(out);
    $('aiidle').hidden = true; $('chat').appendChild(turn);
    $('aistage').scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: 'start'});
    return out;
  }
  // While the AI works: a beam sweeps the map and states light up west to east.
  let thinkTimer = null;
  function think(on) {
    $('aistage').classList.toggle('scan', on); $('aiform').classList.toggle('busy', on);
    clearInterval(thinkTimer); thinkTimer = null;
    if (!on || REDUCED) return;
    const els = [...document.querySelectorAll('.aist')].map(p => ({p, x: p.getBBox().x})).sort((a, b) => a.x - b.x).map(o => o.p);
    const scope = selected.size ? els.filter(p => selected.has(p.getAttribute('data-a'))) : els; let i = 0;
    thinkTimer = setInterval(() => { const p = scope[i++ % scope.length]; p.classList.add('think'); setTimeout(() => p.classList.remove('think'), 520); }, selected.size ? 260 : 70);
  }
  // Answers type themselves out, word by word.
  // Answers write themselves smoothly: words fade in one after another, paced by the screen's refresh (no jumps).
  function typeOut(el, text) {
    return new Promise(res => {
      if (REDUCED || !text) { el.textContent = text || ''; return res(); }
      el.textContent = ''; el.classList.add('typing');
      const words = String(text).split(/(\s+)/), rate = Math.max(28, words.length / 2.6); // words per second; long answers finish in about 2.6 s
      let shown = 0, t0 = null;
      const frame = t => {
        if (t0 === null) t0 = t;
        const want = Math.min(words.length, Math.floor((t - t0) / 1000 * rate));
        if (want > shown) { const frag = document.createDocumentFragment(); for (; shown < want; shown++) { const w = words[shown]; if (/^\s+$/.test(w)) frag.appendChild(document.createTextNode(w)); else { const sp = document.createElement('span'); sp.className = 'aiw'; sp.textContent = w; frag.appendChild(sp); } } el.appendChild(frag); }
        if (shown < words.length) requestAnimationFrame(frame); else { el.classList.remove('typing'); res(); }
      };
      requestAnimationFrame(frame);
    });
  }
  async function ask(q) {
    q = (q || '').replace(/\s+/g, ' ').trim(); if (q.length < 3) return;
    $('aigo').disabled = true; $('aiq').value = '';
    const out = add(q); think(true); const t0 = Date.now();
    try {
      const r = await fetch('/.netlify/functions/ai', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({question: q, states: [...selected]})});
      const d = await r.json().catch(() => ({}));
      if (!REDUCED) await new Promise(x => setTimeout(x, Math.max(0, 900 - (Date.now() - t0))));
      think(false); out.textContent = ''; out.classList.remove('thinking');
      if (!r.ok) { out.className = 'aiout err'; out.textContent = d.error || 'Something went wrong. Please try again.'; }
      else {
        react(d);
        // Lay the answer out as: summary sentence, bullet points ("- " lines), and a "Verify:" line.
        const lines = String(d.answer || '').split(/\n+/).map(x => x.trim()).filter(Boolean), bullets = lines.filter(x => /^[-•*]\s+/.test(x)), verify = lines.filter(x => /^verify:/i.test(x)), rest = lines.filter(x => !bullets.includes(x) && !verify.includes(x));
        const ap = mk('p', 'aians', ''); out.appendChild(ap); await typeOut(ap, rest.join(' '));
        if (bullets.length) { const ul = mk('ul', 'aians aibul'); out.appendChild(ul); for (const b of bullets) { const li = mk('li', ''); ul.appendChild(li); const t = b.replace(/^[-•*]\s+/, ''), m = t.match(/^([^:]{2,70}):\s*(.*)$/); if (m) { li.appendChild(mk('b', '', m[1] + ': ')); const sp = mk('span'); li.appendChild(sp); await typeOut(sp, m[2]); } else await typeOut(li, t); } }
        if (verify.length) { const vp = mk('p', 'aiverify small', ''); out.appendChild(vp); await typeOut(vp, verify.join(' ')); }
        out.scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest'});
        out.appendChild(mk('p', 'small muted', d.searched + (d.understood ? '' : ' (I could not fully read your wording, so I used a broad search)')));
        if (d.kind === 'states' && d.results.length) { out.appendChild(mk('p', 'small muted', 'Showing ' + d.results.length + ' of ' + d.total + ' states:')); out.appendChild(statesTable(d.results)); }
        else if (d.kind === 'liens' && d.results.length) { out.appendChild(mk('p', 'small muted', 'Showing ' + d.results.length + ' of ' + d.total + ' liens:')); out.appendChild(lienCards(d.results)); }
        if (d.table && d.table.rows.length) { const wrap = mk('div', 'tablewrap'), t = mk('table', 'liens'), hr = t.createTHead().insertRow(); d.table.columns.forEach(c => hr.appendChild(mk('th', '', c))); const tb = t.createTBody(); d.table.rows.forEach(r => { const tr = tb.insertRow(); r.forEach(v => tr.insertCell().textContent = v == null ? '\u2013' : (typeof v === 'number' ? v.toLocaleString('en-US') : String(v))); }); wrap.appendChild(t); out.appendChild(wrap); const a = mk('a', 'small', 'Open the New York page \u2192'); a.href = '../liens/states/state/?s=NY'; out.appendChild(a); }
      }
    } catch (e) { think(false); out.classList.remove('thinking'); out.className = 'aiout err'; out.textContent = 'Could not reach PricePocket AI. Please try again.'; }
    think(false); $('aigo').disabled = false;
  }
  $('aiform').addEventListener('submit', e => { e.preventDefault(); ask($('aiq').value); });
  [['Highest interest', 'Which states pay the highest interest?'], ['Shortest redemption', 'Which states have the shortest redemption period?'], ['Cheapest liens', 'List the cheapest liens with the most land value behind them'], ['Most valuable lots', 'Most valuable lots with under $2,000 tax owed']].forEach(([t, q]) => {
    const b = mk('button', 'aichip', t); b.type = 'button'; b.addEventListener('click', () => ask(q)); $('aichips').appendChild(b);
  });

  function idle() {
    const h = new Date().getHours();
    $('aihello').textContent = (h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + '. What are we hunting today?';
    const total = SUMMARY.reduce((t, x) => t + x.count, 0), nStates = Object.keys(TOTALS).length;
    [[total, 'listings'], [SUMMARY.length, 'official lists'], [STATES.length, 'state classes']].forEach(([v, lab]) => {
      const d = mk('div', 'aistat'), b = mk('b', '', REDUCED ? v.toLocaleString('en-US') : '0'); d.append(b, mk('span', '', lab)); $('aistats').appendChild(d);
      if (!REDUCED) { const t0 = performance.now(), dur = 1400; const tick = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(v * e).toLocaleString('en-US'); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    });
    [['\uD83D\uDCC8', 'Compare states', 'Which states pay the highest interest?'], ['\u23F1\uFE0F', 'Fast turnarounds', 'Which states have the shortest redemption period?'], ['\uD83D\uDCB0', 'Small budgets', 'List the cheapest liens with the most land value behind them'], ['\uD83C\uDFE1', 'Bigger lots', 'Most valuable lots with under $2,000 tax owed'], ['\uD83C\uDF34', 'Florida only', 'Best Florida liens under $500 owed'], ['\uD83D\uDDFD', 'New York history', 'How many properties were on the New York City lien sale lists?']].forEach(([ic, t, q], k) => {
      const b = mk('button', 'aitrycard'); b.type = 'button'; b.style.setProperty('--k', k); b.append(mk('span', 'ic', ic), mk('b', '', t), mk('span', 'ex', '\u201c' + q + '\u201d')); b.addEventListener('click', () => ask(q)); $('aitry').appendChild(b);
    });
    $('aifine').textContent = 'Educational only, not advice. Verify with the county. ' + total.toLocaleString('en-US') + ' listings from ' + SUMMARY.length + ' official lists in ' + nStates + ' states.';
    const EX = ['Cheapest liens in Florida with a road', 'Which states pay the highest interest?', 'Lots over 1 acre with under $1,000 owed', 'No flood zones, best value in Colorado', 'Which states have the shortest redemption?'];
    if (!REDUCED) { let i = 0; setInterval(() => { if (document.activeElement === $('aiq') || $('aiq').value) return; $('aiq').placeholder = 'Try: ' + EX[i++ % EX.length]; }, 3200); }
  }
  (async () => {
    let d = null; try { d = await (await fetch('/.netlify/functions/ai')).json(); } catch (e) {}
    const g = $('gate');
    if (!d || !d.enabled) { g.hidden = false; g.textContent = 'PricePocket AI is not switched on yet.'; return; }
    if (!d.signedIn) { g.hidden = false; g.innerHTML = '<b>🔒 Pro members only.</b> <a href="/login/?next=/ai/">Sign in</a> or <a href="/account/?mode=up">create an account</a>. PricePocket AI is for Pro members ($5.50 a week).'; return; }
    if (!d.paid) { g.hidden = false; g.innerHTML = '<b>🔒 Pro members only.</b> PricePocket AI is for Pro members ($5.50 a week). <a href="/account/">See my plan</a>'; return; }
    $('app').hidden = false; drawMap(); tilt(); idle();
  })();
})();
