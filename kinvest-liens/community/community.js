/* Community pages: hub, profile, settings. Everything shown comes from /.netlify/functions/community; permission checks happen on the server. */
(function () {
  'use strict';
  const API = '/.netlify/functions/community';
  const $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const get = async q => { try { const r = await fetch(API + '?' + new URLSearchParams(q), { credentials: 'same-origin' }); return { s: r.status, j: await r.json().catch(() => ({})) }; } catch (e) { return { s: 0, j: { error: 'Could not reach the server.' } }; } };
  const post = async o => { try { const r = await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }); return { s: r.status, j: await r.json().catch(() => ({})) }; } catch (e) { return { s: 0, j: { error: 'Could not reach the server.' } }; } };
  const initials = n => (String(n || '?').replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase();
  const ICON = { founder: '👑', verified: '✓', pro: '★', early: '☀', helpful: '🤝', top: '🏆', leader: '🧭', educator: '🎓' };
  const ROLE_FALLBACK = 'Member';
  const month = ym => { if (!ym) return ''; const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };

  // ---- sheet (Apple-style, replaces browser pop-ups) ----
  function sheet(o) {
    return new Promise(res => {
      const ov = mk('div', 'cm-ov'), sh = mk('div', 'cm-sheet'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', o.title);
      sh.append(mk('h3', '', o.title)); if (o.text) sh.append(mk('p', '', o.text));
      const vals = {}; const body = mk('div', 'form');
      (o.fields || []).forEach(f => {
        const l = mk('label', '', f.label); let inp;
        if (f.type === 'select') { inp = mk('select'); f.options.forEach(x => { const op = mk('option', '', x[1] || x); op.value = x[0] || x; inp.appendChild(op); }); }
        else if (f.type === 'radio') { const g = mk('div', 'radio'); f.options.forEach((x, i) => { const r = mk('label'), ri = mk('input'); ri.type = 'radio'; ri.name = f.key; ri.value = x; ri.checked = i === 0; r.append(ri, document.createTextNode(x)); g.appendChild(r); }); vals[f.key] = () => (g.querySelector('input:checked') || {}).value; l.appendChild(g); body.appendChild(l); return; }
        else if (f.type === 'textarea') { inp = mk('textarea'); inp.maxLength = f.max || 500; } else { inp = mk('input'); inp.type = 'text'; inp.maxLength = f.max || 80; }
        if (f.value != null) inp.value = f.value; if (f.placeholder) inp.placeholder = f.placeholder; vals[f.key] = () => inp.value.trim(); l.appendChild(inp); body.appendChild(l);
      });
      if ((o.fields || []).length) sh.append(body);
      const row = mk('div', 'row'), no = mk('button', 'btn2', 'Cancel'), yes = mk('button', 'btn2 ' + (o.danger ? 'solid danger' : 'primary'), o.confirm || 'OK'); no.type = yes.type = 'button';
      const key = e => { if (e.key === 'Escape') done(null); };
      const done = v => { document.removeEventListener('keydown', key); ov.classList.remove('on'); setTimeout(() => ov.remove(), 180); res(v); };
      no.onclick = () => done(null); ov.onclick = e => { if (e.target === ov) done(null); };
      yes.onclick = () => { const out = {}; Object.keys(vals).forEach(k => out[k] = vals[k]()); done(o.fields ? out : true); };
      document.addEventListener('keydown', key); row.append(no, yes); sh.append(row); ov.append(sh); document.body.append(ov); requestAnimationFrame(() => { ov.classList.add('on'); const f = sh.querySelector('input,textarea,select'); if (f) f.focus({ preventScroll: true }); });
    });
  }
  // ---- the blue check ----
  // Founder: a 3D-style blue seal with a glossy highlight, a slow light sweep and a gentle float. Awarded (verified) members get the same seal, still and simpler.
  let vbN = 0;
  function vbadge(kind, px) {
    const id = 'vb' + (++vbN), ns = 'http://www.w3.org/2000/svg', n = 12, pts = [];
    for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2, r = i % 2 ? 25.6 : 29.2; pts.push((32 + r * Math.cos(a)).toFixed(2) + ',' + (32 + r * Math.sin(a)).toFixed(2)); }
    const s = document.createElementNS(ns, 'svg'); s.setAttribute('viewBox', '0 0 64 64'); s.setAttribute('width', px); s.setAttribute('height', px); s.setAttribute('role', 'img'); s.setAttribute('aria-label', kind === 'founder' ? 'Verified: official PricePocketAsset account' : 'Verified account'); s.setAttribute('class', 'vb' + (kind === 'founder' ? ' f' : ''));
    s.innerHTML = '<defs>'
      + '<linearGradient id="' + id + 'a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd6ff"/><stop offset=".45" stop-color="#1f86ff"/><stop offset="1" stop-color="#0a3ea8"/></linearGradient>'
      + '<linearGradient id="' + id + 'r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f6ff"/><stop offset=".5" stop-color="#5aa9ff"/><stop offset="1" stop-color="#0a3a96"/></linearGradient>'
      + '<radialGradient id="' + id + 'c" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#6cc4ff"/><stop offset=".55" stop-color="#1569e6"/><stop offset="1" stop-color="#0a3a9a"/></radialGradient>'
      + '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
      + '<linearGradient id="' + id + 's" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
      + '<clipPath id="' + id + 'k"><polygon points="' + pts.join(' ') + '"/></clipPath></defs>'
      + '<polygon points="' + pts.join(' ') + '" fill="url(#' + id + 'r)" stroke="url(#' + id + 'r)" stroke-width="4" stroke-linejoin="round"/>'
      + '<polygon points="' + pts.join(' ') + '" fill="url(#' + id + 'a)" stroke="url(#' + id + 'a)" stroke-width="2.2" stroke-linejoin="round" transform="translate(32 32) scale(.93) translate(-32 -32)"/>'
      + '<circle cx="32" cy="32" r="19.5" fill="url(#' + id + 'c)" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/>'
      + '<path d="M21.5 33.5l7.6 7.6 14.4-16.6" fill="none" stroke="#04256e" stroke-opacity=".45" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 2.2)"/>'
      + '<path d="M21.5 33.5l7.6 7.6 14.4-16.6" fill="none" stroke="#fff" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<ellipse cx="25" cy="17.5" rx="13" ry="6.4" fill="url(#' + id + 'g)" transform="rotate(-24 25 17.5)" opacity=".8"/>'
      + (kind === 'founder' ? '<g clip-path="url(#' + id + 'k)"><rect class="sweep" x="-28" y="-6" width="22" height="76" fill="url(#' + id + 's)" transform="rotate(20 32 32)"/></g>' : '');
    return s;
  }
  // ---- shared pieces ----
  function avatar(p, cls) {
    const a = mk('div', cls + (p.founder ? ' f' : ''));
    if (p.photo) { a.classList.add('ph'); const i = mk('img'); i.src = p.photo; i.alt = ''; i.loading = 'lazy'; a.appendChild(i); }
    else if (p.founder) { const i = mk('img'); i.src = '/img/logo-mark.png'; i.alt = ''; a.appendChild(i); } else a.textContent = initials(p.name);
    return a;
  }
  function badgePill(p) { const w = []; if (p.founder) w.push(mk('span', 'pill founder', '👑 Founder / Owner')); return w; }
  function personRow(p, o) {
    const r = mk('div', 'person' + (p.system ? ' sys' : '')), av = avatar(p, 'mini');
    const g = mk('div', 'grow'), a = mk('a', 'nm', p.name); a.href = '/community/profile/?u=' + encodeURIComponent(p.username);
    const sub = mk('div', 'sub', p.system ? '👑 Founder Connection' : '@' + p.username + (p.role ? ' · ' + p.role : ''));
    if (p.verified || p.founder) { const w = mk('div', 'nmrow'); w.append(a, vbadge(p.founder ? 'founder' : 'verified', 18)); g.append(w, sub); } else g.append(a, sub); if (p.system) g.append(mk('div', 'sub', 'Official PricePocketAsset account · connected since you joined.')); r.append(av, g); if (!p.system) badgePill(p).forEach(x => r.appendChild(x));
    if (o && o.follow && !p.founder && !p.self) { const b = mk('button', 'btn2 ' + (p.following ? '' : 'outline'), p.following ? 'Following' : 'Follow'); b.type = 'button'; b.onclick = async () => { b.disabled = true; const x = await post({ action: p.following ? 'unfollow' : 'follow', uid: p.uid }); b.disabled = false; if (x.s === 200) { p.following = !p.following; b.textContent = p.following ? 'Following' : 'Follow'; b.className = 'btn2 ' + (p.following ? '' : 'outline'); } else alert(x.j.error || 'Could not do that.'); }; r.appendChild(b); }
    if (o && o.message && p.canMessage && !p.self) { const ms = mk('a', 'btn2 msg', '\u2709 Message'); ms.href = '/messages/?to=' + encodeURIComponent(p.username); ms.setAttribute('aria-label', 'Message ' + p.name); r.appendChild(ms); }
    return r;
  }
  // Followers / Following list in a sheet, with Follow and Message next to each name
  async function peopleSheet(P, kind) {
    const ov = mk('div', 'cm-ov'), sh = mk('div', 'cm-sheet ppl'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    const top = mk('div', 'ppl-top'), x = mk('button', 'cp-x', 'Done'); x.type = 'button'; top.append(mk('h3', '', kind === 'followers' ? 'Followers' : 'Following'), x); sh.append(top);
    const list = mk('div', 'people'); list.append(mk('div', 'muted small', 'Loading\u2026')); sh.append(list);
    const close = () => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 200); }; x.onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
    ov.append(sh); document.body.append(ov); requestAnimationFrame(() => ov.classList.add('on'));
    const r = await get({ u: P.username, list: kind }); const rows = r.j.rows || []; list.textContent = '';
    rows.forEach(p => list.append(personRow(p, { follow: true, message: true })));
    
    if (!rows.length && !(kind === 'followers' && P.founder)) list.append(mk('div', 'empty', kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'));
  }
  function needSignin(root) { root.textContent = ''; const c = mk('div', 'card'); c.append(mk('h3', '', 'Sign in to join the community'), mk('p', 'muted', 'The PricePocketAsset community is for members. Sign in or create a free account to see profiles.')); const a = mk('a', 'btn2 primary', 'Sign in'); a.href = '/login/?next=' + encodeURIComponent(location.pathname + location.search); c.append(a); root.appendChild(c); }

  // ---- HUB ----
  async function hub() {
    const root = $('root'); const m = await get({ me: 1 }); if (m.s === 401) return needSignin(root);
    const me = m.j.me; root.textContent = '';
    const top = mk('div', 'hub-top'), h = mk('h1', '', 'Community'); const sb = mk('div', 'search'); sb.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    const inp = mk('input'); inp.type = 'search'; inp.placeholder = 'Search members by username'; inp.setAttribute('aria-label', 'Search members'); sb.appendChild(inp); top.append(h, sb); root.appendChild(top);
    const res = mk('div', 'people'); res.setAttribute('aria-live', 'polite'); root.appendChild(res);
    let t = null; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => { res.textContent = ''; if (inp.value.trim().length < 2) return; const x = await get({ search: inp.value.trim() }); (x.j.rows || []).forEach(p => res.appendChild(personRow(p, { follow: true }))); if (!(x.j.rows || []).length) res.appendChild(mk('div', 'empty', 'No members found with that username.')); }, 250); });
    const grid = mk('div', 'grid'); root.appendChild(grid); const l = mk('div', 'col'), r = mk('div', 'col'); grid.append(l, r);
    const mine = mk('div', 'card'); mine.append(mk('h3', '', 'Your profile'));
    const row = mk('div', 'person'); row.append(avatar(me, 'mini' + (me.founder ? ' f' : '')), (() => { const g = mk('div', 'grow'), a = mk('a', 'nm', me.name); a.href = '/community/profile/?u=' + me.username; g.append(a, mk('div', 'sub', '@' + me.username)); return g; })()); mine.append(row);
    const incomplete = me.name === 'New member' || !me.role; if (incomplete) mine.append(mk('p', 'muted small', 'Add your name, role and interests so other investors know who you are.'));
    const ed = mk('a', 'btn2 primary', incomplete ? 'Set up your profile' : 'Edit profile'); ed.href = '/community/settings/'; ed.style.marginTop = '10px'; mine.append(ed); l.append(mine);
    const fo = mk('div', 'card'); fo.append(mk('h3', '', 'Official'));
    const fl = (await get({ u: me.username, list: 'following' })).j.rows || []; const sys = fl.find(x => x.system); if (sys) fo.append(personRow(sys)); else if (me.founder) fo.append(mk('p', 'muted', 'You are the Founder. Every member is connected to you automatically.')); l.append(fo);
    const fc = mk('div', 'feed'); const nb = mk('button', 'cp-prompt'); nb.type = 'button'; nb.append(avatar(me, 'mini'), mk('span', '', 'Share something with the community…')); fc.append(mk('h2', 'feed-h', 'Latest posts'), nb); root.insertBefore(fc, grid);
    const loadFeed = async () => { fc.querySelectorAll('.plist').forEach(x => x.remove()); await postList(fc, { feed: 1 }, me.owner, 'No posts yet. Be the first to share something.'); }; nb.onclick = () => composer(me.paid, loadFeed); loadFeed();
    const sg = mk('div', 'card'); sg.append(mk('h3', '', 'Suggested members')); const sx = (await get({ suggest: 1 })).j.rows || []; const list = mk('div', 'people'); sx.forEach(p => list.appendChild(personRow(p, { follow: true }))); if (!sx.length) list.appendChild(mk('div', 'empty', 'As more members complete their profiles, they will show up here.')); sg.append(list); r.append(sg);
    const soon = mk('div', 'card'); soon.append(mk('h3', '', 'Coming next')); const s = mk('div', 'soon'); [['Following feed', 'Posts and shared properties from people you follow.'], ['Discussions', 'Ask questions and learn from other investors.'], ['Educational posts', 'Guides on liens, deeds, and county research.'], ['Groups', 'Join groups by state, county or strategy.'], ['Direct messages', 'Private conversations, with your privacy choices.']].forEach(([a, b]) => { const d = mk('div'); d.append(mk('b', '', a), document.createTextNode(b)); s.appendChild(d); }); soon.append(s); r.append(soon);
    if (me.owner) ownerPanel(l);
  }
  async function ownerPanel(col) {
    const c = mk('div', 'card'); c.append(mk('h3', '', 'Owner tools')); const msg = mk('p', 'msg'); msg.setAttribute('role', 'status');
    const bf = mk('button', 'btn2', 'Give every member a profile and the Founder connection'); bf.type = 'button'; bf.onclick = async () => { bf.disabled = true; const x = await post({ action: 'ownerBackfill' }); bf.disabled = false; msg.className = 'msg ' + (x.s === 200 ? 'ok' : 'bad'); msg.textContent = x.s === 200 ? 'Done. ' + x.j.newProfiles + ' new profiles, ' + x.j.newConnections + ' new Founder connections (running it again changes nothing).' : (x.j.error || 'Failed.'); };
    const aw = mk('button', 'btn2', 'Award a badge'); aw.type = 'button'; aw.style.marginLeft = '8px'; aw.onclick = async () => { const o = await get({ options: 1 }); const v = await sheet({ title: 'Award a badge', text: 'Type the member’s username. Verified and contribution badges are only ever given by you.', fields: [{ key: 'username', label: 'Username', placeholder: 'member123456' }, { key: 'verified', label: 'Verified', type: 'select', options: [['', 'Leave as is'], ['yes', 'Verified'], ['no', 'Not verified']] }, { key: 'award', label: 'Contribution badge', type: 'select', options: [['', 'None'], ...Object.entries(o.j.awards || {})] }], confirm: 'Save' }); if (!v) return;
      const t = await get({ u: v.username }); if (t.s !== 200) { msg.className = 'msg bad'; msg.textContent = 'No member with that username.'; return; } const b = { action: 'ownerAward', username: v.username }; if (v.verified) b.verified = v.verified === 'yes'; if (v.award) b.awards = [v.award]; const x = await post(b); msg.className = 'msg ' + (x.s === 200 ? 'ok' : 'bad'); msg.textContent = x.s === 200 ? 'Saved.' : (x.j.error || 'Failed.'); };
    c.append(bf, aw, msg);
    const rp = (await get({ reports: 1 })).j.reports || []; c.append(mk('h4', '', 'Reports (' + rp.filter(x => x.status === 'open').length + ' open)')); rp.slice(0, 8).forEach(x => { const d = mk('div', 'person'); const g = mk('div', 'grow'); g.append(mk('b', '', x.category + ' · @' + x.targetName), mk('div', 'sub', 'from @' + x.byName + ' · ' + x.at.slice(0, 10) + (x.details ? ' · ' + x.details : ''))); if (x.postText) g.append(mk('div', 'sub', 'Post: “' + x.postText + '”')); if (x.dm) { g.append(mk('div', 'sub', 'Reported private message: “' + x.dm.text + '”')); if (x.status === 'open') { const rmb = mk('button', 'btn2', 'Remove message'); rmb.type = 'button'; rmb.onclick = async () => { const r = await fetch('/.netlify/functions/messages', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ownerRemove', cid: x.dm.cid, messageId: x.dm.messageId }) }); if (r.ok) { rmb.textContent = 'Removed'; rmb.disabled = true; } }; g.append(rmb); } } d.append(g); if (x.post && x.status === 'open') { const dp = mk('button', 'btn2', 'Delete post'); dp.type = 'button'; dp.onclick = async () => { const r = await post({ action: 'deletePost', key: x.post }); if (r.s === 200 || r.s === 404) { await post({ action: 'ownerCloseReport', id: x.id }); d.remove(); } }; d.append(dp); } if (x.status === 'open') { const cl = mk('button', 'btn2', 'Close'); cl.type = 'button'; cl.onclick = async () => { await post({ action: 'ownerCloseReport', id: x.id }); d.remove(); }; d.append(cl); } c.append(d); });
    const vr = (await get({ verifyRequests: 1 })).j.requests || []; c.append(mk('h4', '', 'Verification requests (' + vr.length + ')'));
    vr.forEach(x => { const d = mk('div', 'person'), g = mk('div', 'grow'); g.append(mk('b', '', x.name + ' (@' + x.username + ')'), mk('div', 'sub', Number(x.followers || 0).toLocaleString('en-US') + ' followers' + (x.note ? ' \u00B7 ' + x.note : ''))); d.append(g);
      [['Approve', true], ['Decline', false]].forEach(([l, a]) => { const b = mk('button', 'btn2' + (a ? ' primary' : ''), l); b.type = 'button'; b.onclick = async () => { b.disabled = true; await post({ action: 'ownerVerifyDecision', username: x.username, approve: a }); d.remove(); }; d.append(b); }); c.append(d); });
    col.append(c);
  }

  // ---- PricePocket Live on the profile (the only place the LIVE indicator appears) ----
  var LIVE_API = '/.netlify/functions/live';
  async function liveGet(q) { try { var r = await fetch(LIVE_API + '?' + q, { credentials: 'same-origin' }); return { s: r.status, j: await r.json().catch(function () { return {}; }) }; } catch (e) { return { s: 0, j: {} }; } }
  async function livePost(o) { try { var r = await fetch(LIVE_API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }); return { s: r.status, j: await r.json().catch(function () { return {}; }) }; } catch (e) { return { s: 0, j: { error: 'Could not reach PricePocketAsset. Check your connection.' } }; } }
  function goLiveSheet(P, current) {
    var ov = mk('div', 'cm-ov'), sh = mk('div', 'cm-sheet'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', 'Go live');
    sh.append(mk('h3', '', 'Go live'), mk('p', '', 'Start a public live video. Anyone signed in to PricePocketAsset can join from your profile. Your camera and microphone turn on when you start.'));
    var f = mk('div', 'form'), l1 = mk('label', '', 'Live title'), ti = mk('input'); ti.type = 'text'; ti.maxLength = 80; ti.placeholder = 'Florida Tax Deed Q&A'; ti.setAttribute('autocomplete', 'off'); l1.appendChild(ti);
    var l2 = mk('label', '', 'Who can watch'), vs = mk('select'); var o1 = mk('option', '', 'Public'); o1.value = 'public'; var o2 = mk('option', '', 'Subscribers Only \u2014 Coming Soon'); o2.value = 'subscribers'; o2.disabled = true; vs.append(o1, o2); l2.appendChild(vs); f.append(l1, l2); sh.appendChild(f);
    var msg = mk('p', 'msg bad'); msg.setAttribute('role', 'alert'); sh.appendChild(msg);
    var row = mk('div', 'row'), no = mk('button', 'btn2', 'Cancel'), go = mk('button', 'btn2 solid danger', 'Start live'); no.type = go.type = 'button'; row.append(no, go); sh.appendChild(row);
    var done = function () { ov.classList.remove('on'); setTimeout(function () { ov.remove(); }, 180); };
    no.onclick = done; ov.onclick = function (e) { if (e.target === ov) done(); };
    go.onclick = async function () {
      msg.textContent = ''; var title = ti.value.trim(); if (title.length < 3) { msg.textContent = 'Give your live a title (at least 3 characters).'; ti.focus(); return; }
      go.disabled = true; go.textContent = 'Checking camera\u2026';
      // ask for camera and microphone FIRST so a denial never leaves a live running with nobody in it
      try { var st = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); st.getTracks().forEach(function (t) { t.stop(); }); }
      catch (e) { go.disabled = false; go.textContent = 'Start live'; msg.textContent = (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) ? 'Camera access is required to go live. Open your browser settings and allow camera and microphone access for PricePocketAsset, then try again.' : (!navigator.mediaDevices ? 'This browser cannot use the camera. Try Safari or Chrome.' : 'We could not open your camera or microphone. Check that nothing else is using them.'); return; }
      go.textContent = 'Starting\u2026'; var r = await livePost({ action: 'start', title: title, visibility: 'public' });
      if (r.s === 200 && r.j.session) { location.href = '/live/?s=' + r.j.session.id; return; }
      go.disabled = false; go.textContent = 'Start live'; msg.textContent = r.j.error || 'Could not start the live. Please try again.';
    };
    document.body.appendChild(ov); ov.appendChild(sh); requestAnimationFrame(function () { ov.classList.add('on'); ti.focus({ preventScroll: true }); });
  }
  // The red ring, LIVE NOW card and JOIN LIVE button. Refreshes by itself while the profile is open.
  function liveBlock(P, R, head, act) {
    var box = mk('section', 'lvbox'); box.hidden = true; var av = head.querySelector('.cm-av'), goBtn = null, cur = null;
    if (R.self) { goBtn = mk('button', 'btn2 live', '\u25CF Go live'); goBtn.type = 'button'; goBtn.onclick = function () { cur ? (location.href = '/live/?s=' + cur.id) : goLiveSheet(P); }; act.prepend(goBtn); }
    function paint(live) {
      cur = live; if (av) av.classList.toggle('live', !!live); box.hidden = !live; box.textContent = '';
      if (goBtn) goBtn.textContent = live ? '\u25CF Return to your live' : '\u25CF Go live';
      if (!live) return;
      var l = mk('div', 'lvl'); l.append(mk('span', 'lvtag', '\u25CF LIVE NOW'), mk('b', 'lvt', live.title)); var w = live.viewers != null ? live.viewers + ' watching' : ''; if (w) l.appendChild(mk('span', 'lvw', w)); box.appendChild(l);
      var b = mk('a', 'btn2 live', R.self ? 'Return to live' : 'Join live'); b.href = '/live/?s=' + live.id; box.appendChild(b);
    }
    var timer = null; async function tick() { var r = await liveGet('u=' + encodeURIComponent(P.username)); if (r.s === 200) paint(r.j.live || null); }
    tick(); timer = setInterval(function () { if (!document.hidden) { if (!document.body.contains(box)) { clearInterval(timer); return; } tick(); } }, 8000);
    return box;
  }


  // ---- POSTS ----
  const ago = iso => { const s = (Date.now() - Date.parse(iso)) / 1000; if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; if (s < 604800) return Math.floor(s / 86400) + 'd'; return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  function upsell(title, text) { return sheet({ title, text, confirm: 'See plans' }).then(v => { if (v) location.href = '/plans/'; }); }
  function composer(paid, after) {
    if (!paid) return upsell('Posting is for paid members', 'Upgrade to share posts with the PricePocketAsset community. Everyone can still read posts.');
    const ov = mk('div', 'cm-ov'), sh = mk('div', 'cm-sheet compose'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', 'New post');
    const top = mk('div', 'cp-top'), no = mk('button', 'cp-x', 'Cancel'), ttl = mk('b', '', 'New post'), go = mk('button', 'cp-go', 'Post'); no.type = go.type = 'button'; go.disabled = true; top.append(no, ttl, go);
    const ta = mk('textarea'); ta.maxLength = 1000; ta.placeholder = 'Share an update, a question or a tip…'; ta.setAttribute('aria-label', 'Post text');
    const foot = mk('div', 'cp-foot'), cnt = mk('span', '', '0 / 1,000'), msg = mk('span', 'cp-msg'); msg.setAttribute('role', 'status'); foot.append(msg, cnt);
    // photos: up to 4, shrunk on the phone (max 1600 px) and uploaded one at a time
    const photos = [], strip = mk('div', 'cp-photos'), addB = mk('button', 'cp-add', '📷 Photo'); addB.type = 'button'; addB.setAttribute('aria-label', 'Add photos');
    const shrink = file => new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); let q = 0.85, d = c.toDataURL('image/jpeg', q); while (d.length > 1.9e6 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); } res(d); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('bad')); }; im.src = u; });
    const paintPh = () => { strip.textContent = ''; photos.forEach((ph, i) => { const t = mk('div', 'cp-th' + (ph.id ? '' : ' up')); t.style.backgroundImage = 'url("' + ph.data + '")'; const x = mk('button', 'cp-rm', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove photo'); x.onclick = () => { photos.splice(i, 1); paintPh(); }; t.append(x); strip.append(t); }); addB.hidden = photos.length >= 4; go.disabled = (!ta.value.trim() && !photos.length) || photos.some(p => !p.id); };
    addB.onclick = () => { const f = mk('input'); f.type = 'file'; f.accept = 'image/*'; f.multiple = true; f.hidden = true; document.body.append(f); setTimeout(() => f.remove(), 600000);
      f.onchange = async () => { const files = [...(f.files || [])].slice(0, 4 - photos.length); for (const file of files) { let d; try { d = await shrink(file); } catch (e) { msg.textContent = 'One photo could not be opened.'; continue; } const ph = { data: d, id: '' }; photos.push(ph); paintPh();
        const r = await post({ action: 'uploadPostPhoto', data: d }); if (r.s === 200) ph.id = r.j.id; else { photos.splice(photos.indexOf(ph), 1); msg.textContent = r.j.error || 'Photo upload failed.'; if (r.j.upgrade) { close(); return upsell('Posting is for paid members', r.j.error); } } paintPh(); } }; f.click(); };
    foot.prepend(addB);
    sh.append(top, ta, strip, foot, mk('p', 'muted small', 'Posts are public to all members. Links show as plain text. Verify before you bid. Nothing here is investment advice.'));
    const close = () => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 200); };
    ta.oninput = () => { const n = ta.value.length; cnt.textContent = n.toLocaleString('en-US') + ' / 1,000'; go.disabled = (!ta.value.trim() && !photos.length) || photos.some(p => !p.id); };
    no.onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
    go.onclick = async () => { go.disabled = true; msg.textContent = 'Posting…'; const r = await post({ action: 'createPost', text: ta.value, photos: photos.map(p => p.id) }); if (r.s === 200) { close(); after && after(); } else { go.disabled = false; msg.textContent = r.j.error || 'Could not post.'; if (r.j.upgrade) { close(); upsell('Posting is for paid members', r.j.error); } } };
    ov.append(sh); document.body.append(ov); requestAnimationFrame(() => { ov.classList.add('on'); ta.focus(); });
  }
  function postCard(p, owner, onGone) {
    const c = mk('article', 'pcard'), hd = mk('div', 'p-hd'), a = p.author; hd.append(avatar(a, 'mini'));
    const g = mk('div', 'grow'), nmr = mk('div', 'nmrow'), ln = mk('a', 'nm', a.name); ln.href = '/community/profile/?u=' + encodeURIComponent(a.username); nmr.append(ln); if (a.verified || a.founder) nmr.append(vbadge(a.founder ? 'founder' : 'verified', 16));
    const t = mk('time', 'sub', '@' + a.username + ' · ' + ago(p.at)); t.dateTime = p.at; t.title = new Date(p.at).toLocaleString(); g.append(nmr, t); hd.append(g);
    const mw = mk('div'); mw.style.position = 'relative'; const dots = mk('button', 'btn2 icon', '⋯'); dots.type = 'button'; dots.setAttribute('aria-label', 'Post options'); mw.append(dots); hd.append(mw);
    dots.onclick = e => { e.stopPropagation(); const old = mw.querySelector('.menu'); if (old) return old.remove(); const m = mk('div', 'menu'); m.setAttribute('role', 'menu');
      const it = (l, cls, fn) => { const b = mk('button', cls || '', l); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.onclick = () => { m.remove(); fn(); }; m.appendChild(b); };
      if (p.mine || owner) it('Delete post', 'danger', async () => { if (!(await sheet({ title: 'Delete this post?', text: 'This cannot be undone.', confirm: 'Delete', danger: true }))) return; const r = await post({ action: 'deletePost', key: p.key }); if (r.s === 200) { c.remove(); onGone && onGone(); } else alert(r.j.error || 'Could not delete.'); });
      if (!p.mine) it('Report post', 'danger', async () => { const o = await get({ options: 1 }); const v = await sheet({ title: 'Report this post', text: 'Reports are private and reviewed by PricePocketAsset.', fields: [{ key: 'category', type: 'radio', label: 'Reason', options: o.j.reportCategories }, { key: 'details', type: 'textarea', label: 'Details (optional)', max: 500 }], confirm: 'Send report' }); if (!v) return; const r = await post({ action: 'reportPost', key: p.key, category: v.category, details: v.details }); sheet({ title: r.s === 200 ? 'Report sent' : 'Could not send', text: r.s === 200 ? 'Thank you. PricePocketAsset will review it.' : (r.j.error || ''), confirm: 'OK' }); });
      mw.appendChild(m); setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0); };
    c.append(hd); if (p.text) c.append(mk('p', 'p-tx', p.text));
    if ((p.photos || []).length) { const g = mk('div', 'p-ph n' + p.photos.length); p.photos.forEach((u, i) => { const b = mk('button', 'p-im'); b.type = 'button'; b.setAttribute('aria-label', 'Open photo ' + (i + 1)); const im = mk('img'); im.src = u; im.alt = ''; im.loading = 'lazy'; b.append(im); b.onclick = () => viewer(p.photos, i); g.append(b); }); c.append(g); }
    c.append(actionBar(p, c)); return c;
  }
  // ---- like / comment / share ----
  const HEART = '\u2665', BUBBLE = '\ud83d\udcac', SHARE = '\u2197';
  function actionBar(p, card) {
    const bar = mk('div', 'p-bar'), lk = mk('button', 'p-act' + (p.liked ? ' on' : '')), cm = mk('button', 'p-act'), sh = mk('button', 'p-act'), cnt = mk('button', 'p-cnt');
    lk.type = cm.type = sh.type = cnt.type = 'button';
    const paintL = () => { lk.textContent = HEART + ' Like'; lk.classList.toggle('on', !!p.liked); lk.setAttribute('aria-pressed', String(!!p.liked)); cnt.textContent = p.likes ? HEART + ' ' + p.likes : ''; cnt.hidden = !p.likes; };
    const paintC = () => { cm.textContent = BUBBLE + ' ' + (p.comments ? p.comments : 'Comment'); };
    sh.textContent = SHARE + ' Share'; paintL(); paintC();
    lk.onclick = async () => { const on = !p.liked; p.liked = on; p.likes = Math.max(0, (p.likes || 0) + (on ? 1 : -1)); paintL(); const r = await post({ action: on ? 'like' : 'unlike', key: p.key }); if (r.s === 200) { p.likes = r.j.likes; p.liked = r.j.liked; } else { p.liked = !on; p.likes += on ? -1 : 1; } paintL(); };
    cnt.onclick = async () => { const x = await get({ likers: p.key }); const ov = mk('div', 'cm-ov'), shh = mk('div', 'cm-sheet'); shh.append(mk('h3', '', 'Liked by')); const list = mk('div', 'people'); (x.j.rows || []).forEach(r => list.append(personRow(r))); shh.append(list); const ok2 = mk('button', 'btn2', 'Close'); ok2.type = 'button'; ok2.style.marginTop = '12px'; ok2.onclick = () => ov.remove(); shh.append(ok2); ov.onclick = e => { if (e.target === ov) ov.remove(); }; ov.append(shh); document.body.append(ov); requestAnimationFrame(() => ov.classList.add('on')); };
    let panel = null;
    cm.onclick = async () => { if (panel) { panel.remove(); panel = null; return; } panel = mk('div', 'p-cmts'); card.append(panel); await commentsPanel(p, panel, paintC); };
    sh.onclick = () => shareSheet(p);
    const left = mk('div', 'p-cl'); left.append(cnt); bar.append(lk, cm, sh); const wrap = mk('div'); wrap.append(left, bar); return wrap;
  }
  async function commentsPanel(p, host, paintC) {
    const list = mk('div', 'p-clist'); host.append(list);
    const load = async () => { const x = await get({ comments: p.key }); list.textContent = ''; (x.j.rows || []).forEach(c => list.append(commentRow(c, p, paintC, load))); if (!(x.j.rows || []).length) list.append(mk('div', 'muted small', 'No comments yet.')); };
    await load();
    const me = window.__cmMe || (window.__cmMe = (await get({ me: 1 })).j.me || {});
    if (!me.paid) { const n = mk('div', 'p-cup'); n.append(mk('span', 'muted small', 'Commenting is for paid members. ')); const a = mk('a', '', 'See plans'); a.href = '/plans/'; n.append(a); host.append(n); return; }
    const f = mk('div', 'p-cform'), ta = mk('textarea'), go = mk('button', 'p-csend', 'Post'); ta.maxLength = 500; ta.rows = 1; ta.placeholder = 'Write a comment…'; ta.setAttribute('aria-label', 'Write a comment'); go.type = 'button'; go.disabled = true;
    ta.oninput = () => { go.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; };
    go.onclick = async () => { go.disabled = true; const r = await post({ action: 'comment', key: p.key, text: ta.value }); if (r.s === 200) { ta.value = ''; p.comments = r.j.comments; paintC(); await load(); } else alert(r.j.error || 'Could not post.'); ta.oninput(); };
    f.append(ta, go); host.append(f); ta.focus();
  }
  function commentRow(c, p, paintC, reload) {
    const r = mk('div', 'p-c'), b = mk('div', 'p-cb'), nm = mk('a', 'nm', c.author.name); nm.href = '/community/profile/?u=' + encodeURIComponent(c.author.username);
    const hd = mk('div', 'p-ch'); hd.append(nm); if (c.author.verified || c.author.founder) hd.append(vbadge(c.author.founder ? 'founder' : 'verified', 13)); b.append(hd, mk('div', 'p-ct', c.text));
    const meta = mk('div', 'p-cm', ago(c.at));
    if (c.canDelete) { const d = mk('button', '', 'Delete'); d.type = 'button'; d.onclick = async () => { if (!(await sheet({ title: 'Delete this comment?', confirm: 'Delete', danger: true }))) return; const x = await post({ action: 'deleteComment', key: c.key }); if (x.s === 200) { p.comments = Math.max(0, (p.comments || 1) - 1); paintC(); reload(); } }; meta.append(d); }
    if (!c.mine) { const rp = mk('button', '', 'Report'); rp.type = 'button'; rp.onclick = async () => { const o = await get({ options: 1 }); const v = await sheet({ title: 'Report this comment', text: 'Reports are private and reviewed by PricePocketAsset.', fields: [{ key: 'category', type: 'radio', label: 'Reason', options: o.j.reportCategories }], confirm: 'Send report' }); if (!v) return; const x = await post({ action: 'reportComment', key: c.key, category: v.category }); sheet({ title: x.s === 200 ? 'Report sent' : 'Could not send', text: x.s === 200 ? 'Thank you.' : (x.j.error || ''), confirm: 'OK' }); }; meta.append(rp); }
    r.append(avatar(c.author, 'mini'), (() => { const w = mk('div', 'grow'); w.append(b, meta); return w; })()); return r;
  }
  function shareSheet(p) {
    const url = location.origin + '/community/post/?k=' + p.key, ov = mk('div', 'cm-ov'), sh = mk('div', 'cm-sheet'); sh.append(mk('h3', '', 'Share post'), mk('p', 'muted small', 'Only signed-in PricePocketAsset members can open the link.'));
    const msg = mk('p', 'msg'); const opt = (l, fn) => { const b = mk('button', 'btn2', l); b.type = 'button'; b.style.cssText = 'width:100%;justify-content:center;margin-bottom:8px'; b.onclick = fn; sh.append(b); };
    const close = () => ov.remove();
    opt('\ud83d\udd17 Copy link', async () => { try { await navigator.clipboard.writeText(url); msg.className = 'msg ok'; msg.textContent = 'Link copied.'; } catch (e) { msg.textContent = url; } });
    if (navigator.share) opt('\u2197 Share…', async () => { try { await navigator.share({ title: 'PricePocketAsset post', url }); close(); } catch (e) { /* cancelled */ } });
    opt('\u2709 Send in Messages', async () => { const v = await sheet({ title: 'Send to', fields: [{ key: 'u', label: 'Username', placeholder: 'member username' }], confirm: 'Next' }); if (v && v.u) location.href = '/messages/?to=' + encodeURIComponent(v.u.replace(/^@/, '')) + '&text=' + encodeURIComponent(url); });
    const c = mk('button', 'btn2', 'Close'); c.type = 'button'; c.style.cssText = 'width:100%;justify-content:center'; c.onclick = close; sh.append(msg, c);
    ov.onclick = e => { if (e.target === ov) close(); }; ov.append(sh); document.body.append(ov); requestAnimationFrame(() => ov.classList.add('on'));
  }
  // ---- single post page (shared links) ----
  async function postPage() {
    const root = $('root'), k = new URLSearchParams(location.search).get('k') || ''; const x = await get({ post: k }); if (x.s === 401) return needSignin(root);
    root.textContent = ''; const back = mk('a', 'btn2', '\u2039 Community'); back.href = '/community/'; back.style.margin = '14px 0'; root.append(back);
    if (x.s !== 200) { root.append(mk('div', 'empty', 'This post is not available.')); return; }
    const me = (await get({ me: 1 })).j.me || {}; const card = postCard(x.j.post, me.owner); root.append(card);
    const cm = card.querySelectorAll('.p-act')[1]; if (cm) cm.click();
  }
  // full-screen photo viewer: swipe between photos, tap outside or × to close
  function viewer(urls, start) {
    const ov = mk('div', 'pv'), x = mk('button', 'pv-x', '×'), track = mk('div', 'pv-t'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    urls.forEach(u => { const f = mk('div', 'pv-f'), im = mk('img'); im.src = u; im.alt = ''; f.append(im); track.append(f); });
    const close = () => { ov.remove(); document.removeEventListener('keydown', key); }, key = e => { if (e.key === 'Escape') close(); };
    x.onclick = close; ov.onclick = e => { if (e.target === ov || e.target.classList.contains('pv-f')) close(); }; document.addEventListener('keydown', key);
    ov.append(track, x); if (urls.length > 1) ov.append(mk('div', 'pv-n', urls.length + ' photos · swipe')); document.body.append(ov); requestAnimationFrame(() => { track.scrollLeft = start * track.clientWidth; });
  }
  async function postList(host, q, owner, emptyText) {
    const x = await get(q); const rows = x.j.rows || []; const list = mk('div', 'plist'); host.append(list);
    rows.forEach(p => list.append(postCard(p, owner))); if (!rows.length) list.append(mk('div', 'empty', emptyText)); return x.j;
  }
  async function postsTab(pane, P, R, J) {
    if (R.self) { const nb = mk('button', 'cp-prompt'); nb.type = 'button'; nb.append(avatar(P, 'mini'), mk('span', '', 'What’s on your mind?')); nb.onclick = () => composer(J.paid, () => { pane.textContent = ''; postsTab(pane, P, R, J); }); pane.append(nb); }
    await postList(pane, { u: P.username, posts: 1 }, J.owner, R.self ? 'You have not posted yet.' : P.name + ' has not posted yet.');
  }

  // ---- PROFILE ----
  async function profile() {
    const root = $('root'), q = new URLSearchParams(location.search); let name = q.get('u');
    if (!name) { const m = await get({ me: 1 }); if (m.s === 401) return needSignin(root); name = m.j.me.username; history.replaceState(null, '', '?u=' + name); }
    const x = await get({ u: name }); if (x.s === 401) return needSignin(root);
    if (x.s === 404) { root.textContent = ''; const c = mk('div', 'card'); c.append(mk('h3', '', 'Profile not available'), mk('p', 'muted', 'This profile does not exist or is not available to you.')); const a = mk('a', 'btn2', 'Back to Community'); a.href = '/community/'; c.append(a); root.append(c); return; }
    if (x.j.blockedByMe) { root.textContent = ''; const c = mk('div', 'card'); c.append(mk('h3', '', 'You blocked ' + x.j.profile.name), mk('p', 'muted', 'You will not see each other’s activity or be able to follow or message each other.')); const b = mk('button', 'btn2 primary', 'Unblock'); b.type = 'button'; b.onclick = async () => { await post({ action: 'unblock', uid: x.j.profile.uid }); location.reload(); }; c.append(b); root.append(c); return; }
    const P = x.j.profile, R = x.j.rel; document.title = P.name + ' (@' + P.username + ') | PricePocketAsset Community'; root.textContent = '';
    const cover = mk('div', 'cm-cover cv-' + (P.cover || 'forest')); cover.setAttribute('role', 'img'); cover.setAttribute('aria-label', 'Profile cover'); if (P.coverPhoto) { cover.classList.add('photo'); cover.style.backgroundImage = 'url("' + P.coverPhoto + '")'; } root.appendChild(cover);
    const head = mk('div', 'cm-head'); head.append(avatar(P, 'cm-av')); 
    const id = mk('div', 'cm-id'), nm = mk('div', 'cm-name'); nm.append(mk('h1', '', P.name)); if (P.verified || P.founder) nm.append(vbadge(P.founder ? 'founder' : 'verified', P.founder ? 34 : 28)); badgePill(P).forEach(b => nm.appendChild(b)); id.append(nm, mk('div', 'cm-user', '@' + P.username));
    const meta = mk('div', 'cm-meta'); if (P.role) meta.append(mk('span', '', P.role)); if (P.location) meta.append(mk('span', '', '📍 ' + P.location)); if (P.joined) meta.append(mk('span', '', 'Member since ' + month(P.joined))); id.append(meta);
    if (P.bio) id.append(mk('p', 'cm-bio', P.bio)); if ((P.interests || []).length) { const ch = mk('div', 'chips'); P.interests.forEach(i => ch.append(mk('span', 'chip', i))); id.append(ch); }
    const side = mk('div', 'cm-side'), st = mk('div', 'cm-stats'); [[P.stats.followers, 'Followers', 'followers'], [P.stats.following, 'Following', 'following'], [P.stats.posts, 'Posts', 'posts']].forEach(([n, l, k]) => { const d = mk('button', 'cm-stat'); d.type = 'button'; d.setAttribute('aria-label', l + ': ' + n); d.append(mk('b', '', Number(n).toLocaleString('en-US')), mk('span', '', l)); d.onclick = () => k === 'posts' ? (window.__cmShow && window.__cmShow('posts')) : peopleSheet(P, k); st.appendChild(d); });
    const act = mk('div', 'cm-act'); side.append(st, act); head.append(id, side); root.appendChild(head);
    const refresh = () => location.reload();
    if (R.self) { const e = mk('a', 'btn2 primary', 'Edit profile'); e.href = '/community/settings/'; act.appendChild(e); }
    else {
      if (R.system) { const s = mk('span', 'btn2 sys', '👑 Founder Connection'); s.setAttribute('role', 'status'); s.title = 'Official PricePocketAsset Account. Connected since you joined PricePocketAsset.'; act.appendChild(s); }
      else { const f = mk('button', 'btn2 ' + (R.following ? '' : 'primary'), R.following ? 'Following' : 'Follow'); f.type = 'button'; if (!R.following && !R.canFollow) { f.disabled = true; f.textContent = 'Not accepting followers'; }
        f.onclick = async () => { if (R.following && !(await sheet({ title: 'Unfollow ' + P.name + '?', confirm: 'Unfollow', danger: true }))) return; f.disabled = true; const r = await post({ action: R.following ? 'unfollow' : 'follow', uid: P.uid }); if (r.s === 200) refresh(); else { f.disabled = false; alert(r.j.error || 'Could not do that.'); } }; act.appendChild(f); }
      if (R.canMessage.ok) { const m = mk('a', 'btn2 outline', '✉ Message'); m.href = '/messages/?to=' + encodeURIComponent(P.username); act.appendChild(m); }
      const mw = mk('div'); mw.style.position = 'relative'; const dots = mk('button', 'btn2 icon', '⋯'); dots.type = 'button'; dots.setAttribute('aria-label', 'More actions'); dots.setAttribute('aria-haspopup', 'menu'); mw.appendChild(dots); act.appendChild(mw);
      dots.onclick = e => { e.stopPropagation(); const old = mw.querySelector('.menu'); if (old) return old.remove(); const m = mk('div', 'menu'); m.setAttribute('role', 'menu');
        const it = (l, cls, fn) => { const b = mk('button', cls || '', l); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.onclick = () => { m.remove(); fn(); }; m.appendChild(b); };
        it('Copy profile link', '', () => { try { navigator.clipboard.writeText(location.origin + '/community/profile/?u=' + P.username); } catch (e) {} });
        if (R.system) it('Mute Founder posts…', '', () => { location.href = '/community/settings/#notifications'; });
        if (R.canBlock) it('Block ' + P.name, 'danger', async () => { if (await sheet({ title: 'Block ' + P.name + '?', text: 'You will stop following each other and neither of you can see the other’s profile, follow, or message.', confirm: 'Block', danger: true })) { const r = await post({ action: 'block', uid: P.uid }); if (r.s === 200) refresh(); else alert(r.j.error || 'Could not block.'); } });
        it('Report ' + P.name, 'danger', async () => { const o = await get({ options: 1 }); const v = await sheet({ title: 'Report ' + P.name, text: 'Tell us what is wrong. Reports are private and reviewed by PricePocketAsset.', fields: [{ key: 'category', type: 'radio', label: 'Reason', options: o.j.reportCategories }, { key: 'details', type: 'textarea', label: 'Details (optional)', max: 500 }], confirm: 'Send report', danger: true }); if (v) { const r = await post({ action: 'report', uid: P.uid, category: v.category, details: v.details }); alert(r.s === 200 ? 'Thank you. Your report was sent.' : (r.j.error || 'Could not send the report.')); } });
        mw.appendChild(m); setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0); };
    }
    // tabs
    root.appendChild(liveBlock(P, R, head, act));
    const tabs = mk('div', 'tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Profile sections'); const pane = mk('div', 'pane'); pane.setAttribute('role', 'tabpanel'); pane.setAttribute('aria-live', 'polite');
    const T = [['posts', 'Posts'], ['about', 'About'], ['collections', 'Collections'], ['community', 'Community'], ['reputation', 'Reputation']];
    const show = async k => { tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === k))); pane.textContent = ''; history.replaceState(null, '', '?u=' + P.username + (k === 'posts' ? '' : '&tab=' + k)); await ({ posts: postsTab, about, activity, collections, community, reputation }[k])(pane, P, R, x.j); };
    T.forEach(([k, l]) => { const b = mk('button', '', l); b.type = 'button'; b.dataset.k = k; b.setAttribute('role', 'tab'); b.onclick = () => show(k); tabs.appendChild(b); });
    window.__cmShow = k => { show(k); tabs.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    root.append(tabs, pane); const first = q.get('tab'); show(T.some(t => t[0] === first) ? first : 'posts');
  }
  function badgeGrid(P) { const g = mk('div', 'badges'); (P.badges || []).forEach(b => { const d = mk('div', 'badge b-' + b.key), i = mk('i', '', b.key === 'verified' ? '' : (ICON[b.key] || '★')); if (b.key === 'verified') i.appendChild(vbadge('verified', 30)); const t = mk('div'); t.append(mk('b', '', b.label), mk('span', '', b.desc)); d.append(i, t); g.appendChild(d); }); if (!(P.badges || []).length) g.appendChild(mk('div', 'empty', 'No badges yet.')); return g; }
  async function about(pane, P, R) {
    const g = mk('div', 'grid'), l = mk('div', 'col'), r = mk('div', 'col'); g.append(l, r); pane.appendChild(g);
    const c = mk('div', 'card'); c.append(mk('h3', '', 'About me')); const dl = mk('dl', 'rows');
    [['Profession', P.role || 'Not added yet'], ['Experience level', P.experience || 'Not added yet'], ['Location', P.location || (R.self ? 'Hidden. Only you can see it.' : 'Not shared')], ['Member since', month(P.joined) || ''], ['Interests', (P.interests || []).join(', ') || 'Not added yet']].forEach(([k, v]) => { const d = mk('div'); d.append(mk('dt', '', k), mk('dd', '', v)); dl.appendChild(d); }); c.append(dl); if (P.bio) c.append(mk('p', '', P.bio)); l.appendChild(c);
    if (P.founder) { const n = mk('div', 'card founder-note'); n.append(mk('h3', '', '👑 From the Founder')); const bq = mk('blockquote', '', P.pinned || 'Welcome to PricePocketAsset. Better data, smarter decisions, greater opportunities.'); n.append(bq, mk('div', 'sig', '— ' + P.name + ', Founder of PricePocketAsset')); l.appendChild(n); }
    const rc = mk('div', 'card'); rc.append(mk('h3', '', 'Reputation & badges')); rc.append(badgeGrid(P)); r.appendChild(rc);
    if (R.self) { const pc = mk('div', 'card'); pc.append(mk('h3', '', 'Privacy')); pc.append(mk('p', 'muted small', 'Your email, phone, payment details and private portfolio are never shown here. You choose what else is public.')); const a = mk('a', 'btn2', 'Manage privacy'); a.href = '/community/settings/#privacy'; pc.append(a); r.appendChild(pc); }
  }
  async function activity(pane, P, R) {
    const seg = mk('div', 'seg'); ['Posts', 'Comments', 'Shared properties', 'Questions'].forEach((t, i) => { const b = mk('button', i ? '' : 'on', t); b.type = 'button'; b.onclick = () => { seg.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; seg.appendChild(b); }); pane.appendChild(seg);
    if (P.activityHidden) pane.appendChild(mk('div', 'empty', 'This member keeps their activity private.'));
    else pane.appendChild(mk('div', 'empty', (R.self ? 'You have no community activity yet. ' : P.name + ' has no community activity yet. ') + 'Posts, comments, questions and shared properties will appear here as the community grows.'));
  }
  async function collections(pane, P, R) {
    const x = await get({ u: P.username, collections: 1 }); const cols = x.j.collections || [];
    if (R.self) { const b = mk('button', 'btn2 primary', '+ New collection'); b.type = 'button'; b.style.marginBottom = '14px'; b.onclick = async () => { const v = await sheet({ title: 'New collection', text: 'Group properties you want to remember. You choose who can see it.', fields: [{ key: 'name', label: 'Name', placeholder: 'e.g. Florida Tax Liens', max: 60 }, { key: 'visibility', label: 'Who can see it', type: 'select', options: [['private', 'Private (only me)'], ['public', 'Public (members can see it)']] }], confirm: 'Create' }); if (v && v.name) { const r = await post({ action: 'saveCollection', name: v.name, visibility: v.visibility }); if (r.s === 200) { pane.textContent = ''; collections(pane, P, R); } else alert(r.j.error || 'Could not create it.'); } }; pane.appendChild(b); pane.appendChild(mk('p', 'muted small', 'Your private PricePocketAsset portfolio is never shown unless you add a property to a public collection yourself.')); }
    if (!cols.length) { pane.appendChild(mk('div', 'empty', R.self ? 'No collections yet. Create one to organize properties you are watching.' : P.name + ' has no public collections.')); return; }
    const g = mk('div', 'colgrid'); const arts = ['cv-forest', 'cv-lake', 'cv-field', 'cv-dusk', 'cv-clay', 'cv-slate'];
    cols.forEach((c, i) => { const d = mk('div', 'coll'), art = mk('div', 'art ' + arts[i % arts.length]), inn = mk('div', 'in'); inn.append(mk('b', '', c.name), mk('span', 'pill ' + (c.visibility === 'public' ? 'pub' : 'priv'), c.visibility === 'public' ? 'PUBLIC' : 'PRIVATE'), mk('div', 'muted small', c.count + (c.count === 1 ? ' property' : ' properties')));
      if (R.self) { const row = mk('div'); row.style.cssText = 'display:flex;gap:6px;margin-top:10px'; const tg = mk('button', 'btn2', c.visibility === 'public' ? 'Make private' : 'Make public'); tg.type = 'button'; tg.style.minHeight = '36px'; tg.onclick = async () => { await post({ action: 'saveCollection', id: c.id, visibility: c.visibility === 'public' ? 'private' : 'public' }); pane.textContent = ''; collections(pane, P, R); }; const del = mk('button', 'btn2 danger', 'Delete'); del.type = 'button'; del.style.minHeight = '36px'; del.onclick = async () => { if (await sheet({ title: 'Delete “' + c.name + '”?', text: 'The collection is removed. The properties themselves are not affected.', confirm: 'Delete', danger: true })) { await post({ action: 'deleteCollection', id: c.id }); pane.textContent = ''; collections(pane, P, R); } }; row.append(tg, del); inn.append(row); }
      d.append(art, inn); g.appendChild(d); }); pane.appendChild(g);
  }
  async function community(pane, P, R) {
    const g = mk('div', 'grid'), l = mk('div', 'col'), r = mk('div', 'col'); g.append(l, r); pane.appendChild(g);
    const mk2 = async (kind, host, title) => { const c = mk('div', 'card'); c.append(mk('h3', '', title)); const list = mk('div', 'people'); c.append(list); host.appendChild(c); const x = await get({ u: P.username, list: kind }); const rows = x.j.rows || [];
      rows.forEach(p => list.appendChild(personRow(p, { follow: true }))); if (kind === 'followers' && P.founder) list.appendChild(mk('div', 'empty', Number(x.j.systemCount || 0).toLocaleString('en-US') + ' members are connected to the Founder automatically.')); else if (!rows.length) list.appendChild(mk('div', 'empty', kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.')); };
    await mk2('following', l, 'Following'); await mk2('followers', r, 'Followers');
    if (!R.self) { const m = await get({ u: P.username, mutual: 1 }); const rows = m.j.rows || []; if (rows.length) { const c = mk('div', 'card'); c.append(mk('h3', '', 'Mutual connections (' + rows.length + ')')); const list = mk('div', 'people'); rows.forEach(p => list.appendChild(personRow(p, { follow: true }))); c.append(list); r.prepend(c); } }
    const gc = mk('div', 'card'); gc.append(mk('h3', '', 'Groups'), mk('div', 'empty', 'Community groups are coming soon.')); r.appendChild(gc);
  }
  async function reputation(pane, P, R) {
    const c = mk('div', 'card'); c.append(mk('h3', '', 'Reputation & badges'), badgeGrid(P), mk('p', 'muted small', 'Reputation is about trust and helpfulness. Follower count never decides it. Verified and contribution badges are given by PricePocketAsset.')); pane.appendChild(c);
    if (R && R.self) {
      const m = (await get({ me: 1 })).j.me, v = (m && m.verify) || {}; const vc = mk('div', 'card'); vc.append(mk('h3', '', 'Verification (blue check)'));
      if (v.verified) vc.append(mk('p', '', 'Your account is verified.'));
      else {
        vc.append(mk('p', 'muted', 'The blue check is chosen by PricePocketAsset. Right now only the official account has it. Members can ask for it once they have ' + Number(v.min || 1000).toLocaleString('en-US') + ' followers and a complete profile. You have ' + Number(v.followers || 0).toLocaleString('en-US') + '.'));
        if (v.requested) vc.append(mk('p', 'msg ok', 'Your request is with PricePocketAsset.'));
        else { const b = mk('button', 'btn2 primary', 'Request verification'); b.type = 'button'; b.disabled = !v.canRequest; if (!v.canRequest) b.title = v.complete ? 'Not enough followers yet' : 'Complete your profile first'; b.onclick = async () => { const f = await sheet({ title: 'Request verification', text: 'Tell us why you should be verified (optional).', fields: [{ key: 'note', type: 'textarea', label: 'Note', max: 300 }], confirm: 'Send request' }); if (!f) return; const r = await post({ action: 'requestVerify', note: f.note }); if (r.s === 200) { pane.textContent = ''; reputation(pane, P, R); } else alert(r.j.error || 'Could not send the request.'); }; vc.append(b); }
      }
      pane.appendChild(vc);
    }
  }


  // ---- photo picker: choose, drag and zoom, save. The canvas re-encode drops hidden location/camera data. ----
  function cropSheet(file, kind) {
    return new Promise(res => {
      const W = kind === 'avatar' ? 512 : 1500, H = kind === 'avatar' ? 512 : 500;
      const ov = mk('div', 'cm-ov'), sh = mk('div', 'cm-sheet crop'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', 'Adjust photo');
      sh.append(mk('h3', '', kind === 'avatar' ? 'Profile photo' : 'Background photo'), mk('p', 'muted small', 'Drag to move. Use the slider to zoom.'));
      const cv = mk('canvas', 'crop-cv' + (kind === 'avatar' ? ' round' : '')); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
      const zr = mk('input'); zr.type = 'range'; zr.min = '1'; zr.max = '4'; zr.step = '0.01'; zr.value = '1'; zr.setAttribute('aria-label', 'Zoom');
      const row = mk('div', 'row'), no = mk('button', 'btn2', 'Cancel'), yes = mk('button', 'btn2 primary', 'Save'); no.type = yes.type = 'button'; row.append(no, yes);
      const msg = mk('p', 'msg'); msg.setAttribute('role', 'status'); sh.append(cv, zr, msg, row);
      const img = new Image(), url = URL.createObjectURL(file); let base = 1, z = 1, ox = 0, oy = 0;
      const clamp = () => { const s = base * z, w = img.naturalWidth * s, h = img.naturalHeight * s; ox = Math.min(0, Math.max(W - w, ox)); oy = Math.min(0, Math.max(H - h, oy)); };
      const draw = () => { clamp(); const s = base * z; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, ox, oy, img.naturalWidth * s, img.naturalHeight * s); };
      img.onload = () => { base = Math.max(W / img.naturalWidth, H / img.naturalHeight); ox = (W - img.naturalWidth * base) / 2; oy = (H - img.naturalHeight * base) / 2; draw(); };
      img.onerror = () => { msg.className = 'msg bad'; msg.textContent = 'This picture could not be opened. Try a JPG or PNG.'; yes.disabled = true; };
      img.src = url;
      zr.oninput = () => { const cx = W / 2, cy = H / 2, old = z; z = +zr.value; ox = cx - (cx - ox) * z / old; oy = cy - (cy - oy) * z / old; draw(); };
      let drag = null; cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, ox, oy }; cv.setPointerCapture(e.pointerId); };
      cv.onpointermove = e => { if (!drag) return; const k = W / cv.getBoundingClientRect().width; ox = drag.ox + (e.clientX - drag.x) * k; oy = drag.oy + (e.clientY - drag.y) * k; draw(); };
      cv.onpointerup = cv.onpointercancel = () => { drag = null; };
      const done = v => { URL.revokeObjectURL(url); ov.classList.remove('on'); setTimeout(() => ov.remove(), 200); res(v); };
      no.onclick = () => done(null);
      yes.onclick = () => { let q = 0.86, d = cv.toDataURL('image/jpeg', q); while (d.length > 1.9e6 && q > 0.4) { q -= 0.1; d = cv.toDataURL('image/jpeg', q); } done(d); };
      ov.append(sh); document.body.append(ov); requestAnimationFrame(() => ov.classList.add('on'));
    });
  }
  function photoCard(me) {
    const c = mk('div', 'card'); c.id = 'photos'; c.append(mk('h3', '', 'Photos'));
    if (!me.paid) { c.append(mk('p', 'muted', 'Changing your profile photo and background photo is part of the paid plan.')); const a = mk('a', 'btn2 primary', 'See plans'); a.href = '/plans/'; c.append(a); return c; }
    const prev = mk('div', 'ph-prev'), cov = mk('div', 'ph-cover cv-' + (me.cover || 'forest')); if (me.coverPhoto) cov.style.backgroundImage = 'url("' + me.coverPhoto + '")'; const av = avatar(me, 'ph-av'); prev.append(cov, av); c.append(prev);
    const msg = mk('p', 'msg'); msg.setAttribute('role', 'status');
    const pick = kind => { const f = mk('input'); f.type = 'file'; f.hidden = true; document.body.appendChild(f); setTimeout(() => f.remove(), 600000); f.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif'; f.onchange = async () => { const file = f.files && f.files[0]; if (!file) return; if (file.size > 30 * 1024 * 1024) { msg.className = 'msg bad'; msg.textContent = 'Please choose a picture under 30 MB.'; return; } const d = await cropSheet(file, kind); if (!d) return; msg.className = 'msg'; msg.textContent = 'Saving…'; const r = await post({ action: 'setPhoto', kind, data: d }); msg.className = 'msg ' + (r.s === 200 ? 'ok' : 'bad'); msg.textContent = r.s === 200 ? 'Saved.' : (r.j.error || 'Could not save.'); if (r.s === 200) { if (kind === 'avatar') { av.className = 'ph-av ph'; av.textContent = ''; const i = mk('img'); i.src = d; i.alt = ''; av.append(i); } else cov.style.backgroundImage = 'url("' + d + '")'; } }; f.click(); };
    const rm = async kind => { const r = await post({ action: 'setPhoto', kind, data: null }); if (r.s === 200) location.reload(); };
    const row = mk('div', 'ph-row'); [['Change photo', () => pick('avatar')], ['Change background', () => pick('cover')]].forEach(([l, fn]) => { const b = mk('button', 'btn2 primary', l); b.type = 'button'; b.onclick = fn; row.append(b); });
    if (me.photo) { const b = mk('button', 'btn2', 'Remove photo'); b.type = 'button'; b.onclick = () => rm('avatar'); row.append(b); }
    if (me.coverPhoto) { const b = mk('button', 'btn2', 'Remove background'); b.type = 'button'; b.onclick = () => rm('cover'); row.append(b); }
    c.append(row, msg, mk('p', 'muted small', 'JPG, PNG, WebP or HEIC. Pictures are resized on your phone and hidden location data is removed before upload.')); return c;
  }

  // ---- SETTINGS ----
  async function settings() {
    const root = $('root'), m = await get({ me: 1 }); if (m.s === 401) return needSignin(root); const me = m.j.me, o = (await get({ options: 1 })).j; root.textContent = '';
    const top = mk('div', 'hub-top'); top.append(mk('h1', '', 'Edit profile & privacy')); const back = mk('a', 'btn2', 'View my profile'); back.href = '/community/profile/?u=' + me.username; top.append(back); root.appendChild(top);
    const form = mk('div', 'form'), msg = mk('p', 'msg'); msg.setAttribute('role', 'status');
    const card = (t, id) => { const c = mk('div', 'card'); if (id) c.id = id; c.append(mk('h3', '', t)); return c; };
    const field = (l, el) => { const lb = mk('label', '', l); lb.append(el); return lb; };
    const inp = (v, max) => { const i = mk('input'); i.type = 'text'; i.maxLength = max || 60; i.value = v || ''; return i; };
    const sel = (opts, v, blank) => { const s = mk('select'); if (blank) { const b = mk('option', '', blank); b.value = ''; s.appendChild(b); } opts.forEach(x => { const op = mk('option', '', Array.isArray(x) ? x[1] : x); op.value = Array.isArray(x) ? x[0] : x; s.appendChild(op); }); s.value = v || ''; return s; };
    const tog = (title, sub, on) => { const d = mk('div', 'tog'), t = mk('div'); t.append(mk('b', '', title), mk('span', '', sub)); const w = mk('label', 'sw'), i = mk('input'); i.type = 'checkbox'; i.checked = !!on; i.setAttribute('aria-label', title); w.append(i, mk('i')); d.append(t, w); return [d, i]; };
    // profile
    const c1 = card('Profile'), name = inp(me.name, 40), user = inp(me.username, 20), role = sel(me.founderView ? [...o.roles, 'Founder & Owner'] : o.roles, me.role, 'Choose a role'), exp = sel(o.experience, me.experience, 'Choose a level'), bio = mk('textarea'); bio.maxLength = 280; bio.value = me.bio || '';
    const city = inp(me.city, 40), stt = inp(me.state, 2); stt.placeholder = 'FL'; const two = mk('div', 'two'); two.append(field('Display name', name), field('Username', user));
    const two2 = mk('div', 'two'); two2.append(field('Profession or role', role), field('Experience level', exp)); const two3 = mk('div', 'two'); two3.append(field('City (optional)', city), field('State (optional)', stt));
    const cov = mk('div', 'covers'); let cover = me.cover; ['forest', 'lake', 'field', 'dusk', 'clay', 'slate'].forEach(k => { const b = mk('button', 'cv-' + k); b.type = 'button'; b.setAttribute('aria-label', 'Cover ' + k); b.setAttribute('aria-pressed', String(k === cover)); b.onclick = () => { cover = k; cov.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }; cov.appendChild(b); });
    const f1 = mk('div', 'form'); f1.append(two, two2, field('Short bio (280 characters)', bio), two3, field('Cover', cov)); let pin = null; if (me.founderView) { pin = mk('textarea'); pin.maxLength = 600; pin.value = ''; pin.placeholder = 'Official message pinned to your profile'; f1.append(field('Pinned Founder message', pin)); } c1.append(f1);
    // interests
    const c2 = card('Investor interests'), chips = mk('div', 'chips'); const chosen = new Set(me.interests || []); o.interests.forEach(i => { const b = mk('button', 'chip', i); b.type = 'button'; const paint = () => { b.style.background = chosen.has(i) ? 'var(--brand)' : ''; b.style.color = chosen.has(i) ? '#fff' : ''; b.setAttribute('aria-pressed', String(chosen.has(i))); }; paint(); b.onclick = () => { chosen.has(i) ? chosen.delete(i) : chosen.add(i); paint(); }; chips.appendChild(b); }); c2.append(chips);
    // privacy
    const pv = me.privacy, c3 = card('Privacy', 'privacy'); const [t1, showLoc] = tog('Show my city and state', 'Off by default. Never your street address.', pv.showLocation), [t2, showAct] = tog('Show my activity', 'Posts, comments and shared properties on your profile.', pv.showActivity), [t3, disc] = tog('Appear in member search and suggestions', 'People can still open your profile link.', pv.discoverable), [t4, proB] = tog('Show my Pro Member badge', 'Reveals that you have an active membership.', pv.showProBadge);
    const wf = sel([['everyone', 'Everyone'], ['nobody', 'Nobody']], pv.whoCanFollow), wm = sel([['everyone', 'Everyone'], ['following', 'People I follow'], ['followers', 'My followers'], ['mutual', 'Mutual follows'], ['nobody', 'Nobody']], pv.whoCanMessage), cd = sel([['private', 'Private (only me)'], ['public', 'Public']], pv.collectionsDefault);
    const sels = mk('div', 'form'); sels.style.marginTop = '12px'; const [tReq, allowReq] = tog('Allow message requests', 'People outside your choice above can send a request you can accept or decline.', pv.allowRequests !== false); window.__allowReq = allowReq; sels.append(field('Who can follow me', wf), field('Who can message me', wm), field('New collections start as', cd)); c3.append(t1, t2, t3, t4, sels, tReq);
    // notifications
    const nt = me.notif, c4 = card('Notifications', 'notifications'); const [n1, fp] = tog('Founder posts', 'Turn off to mute posts from the Founder. The Founder connection stays.', nt.founderPosts !== 'muted'), [n2, fa] = tog('Founder announcements', 'Turn off to mute official announcements.', nt.founderAnnouncements !== 'muted'), [n3, nf] = tog('New followers', 'Tell me when someone follows me.', nt.follows !== false), [n4, nm] = tog('Message notifications', 'Push me when I get a private message.', nt.messages !== false);
    const fq = sel([['instant', 'As they happen'], ['daily', 'Daily summary'], ['weekly', 'Weekly summary']], nt.frequency); const fqW = mk('div', 'form'); fqW.style.marginTop = '12px'; fqW.append(field('How often', fq)); const [n6, soc] = tog('Likes and comments', 'Push me when someone likes or comments on my posts.', nt.social !== false); const [n5, mpv] = tog('Show message preview', 'Off: notifications only say "You have a new private message."', nt.msgPreview !== false); c4.append(n1, n2, n3, n4, n5, n6, fqW, mk('p', 'muted small', 'Everyone is connected to the official PricePocketAsset account for life. You can mute it here, but you cannot remove the connection.'));
    const save = mk('button', 'btn2 primary', 'Save changes'); save.type = 'button'; save.style.cssText = 'width:100%;justify-content:center;min-height:52px'; 
    save.onclick = async () => { save.disabled = true; msg.className = 'msg'; msg.textContent = 'Saving…';
      const b = { action: 'saveProfile', name: name.value, username: user.value.toLowerCase(), role: role.value, experience: exp.value, bio: bio.value, city: city.value, state: stt.value, cover, interests: [...chosen], privacy: { showLocation: showLoc.checked, showActivity: showAct.checked, discoverable: disc.checked, showProBadge: proB.checked, whoCanFollow: wf.value, whoCanMessage: wm.value, allowRequests: window.__allowReq.checked, collectionsDefault: cd.value }, notif: { founderPosts: fp.checked ? 'on' : 'muted', founderAnnouncements: fa.checked ? 'on' : 'muted', follows: nf.checked, messages: nm.checked, msgPreview: mpv.checked, social: soc.checked, frequency: fq.value } };
      if (pin && pin.value.trim()) b.pinned = pin.value; const r = await post(b); save.disabled = false; msg.className = 'msg ' + (r.s === 200 ? 'ok' : 'bad'); msg.textContent = r.s === 200 ? 'Saved.' : (r.j.error || 'Could not save.'); if (r.s === 200) { back.href = '/community/profile/?u=' + b.username; msg.scrollIntoView({ block: 'nearest' }); } };
    form.append(photoCard(me), c1, c2, c3, c4); root.append(form, msg, save); if (location.hash) { const t = $(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }
  // ---- WELCOME (shown once, right after sign-up) ----
  async function welcome() {
    const root = $('root'), raw = new URLSearchParams(location.search).get('next') || '/map/', next = /^\/(?!\/)[A-Za-z0-9/_\-?=&.%#]*$/.test(raw) ? raw : '/map/';
    const m = await get({ me: 1 }); if (m.s === 401) return needSignin(root); const me = m.j.me, o = (await get({ options: 1 })).j; root.textContent = '';
    const card = mk('div', 'card wl'); card.append(mk('h1', '', 'Set up your profile'), mk('p', 'muted', 'This is how other investors see you in the Community. You can change it any time.'));
    if (me.paid) card.append(photoCard(me)); else { const ph = mk('div', 'wl-av'); ph.append(avatar(me, 'ph-av')); card.append(ph); }
    const f = mk('div', 'form'), fld = (l, el) => { const x = mk('label', '', l); x.append(el); return x; }, inp = (v, max, ph) => { const i = mk('input'); i.type = 'text'; i.maxLength = max; i.value = v || ''; if (ph) i.placeholder = ph; return i; };
    const name = inp(me.name === 'New member' ? '' : me.name, 40, 'Your name'), user = inp(me.username, 20), sel = (opts, v, blank) => { const s2 = mk('select'); const b = mk('option', '', blank); b.value = ''; s2.append(b); opts.forEach(x => { const op = mk('option', '', x); op.value = x; s2.append(op); }); s2.value = v || ''; return s2; };
    const role = sel(o.roles, me.role, 'Choose a role'), exp = sel(o.experience, me.experience, 'Choose a level');
    const chips = mk('div', 'chips'), chosen = new Set(me.interests || []); o.interests.forEach(i => { const b = mk('button', 'chip', i); b.type = 'button'; const paint = () => { b.classList.toggle('on', chosen.has(i)); b.setAttribute('aria-pressed', String(chosen.has(i))); }; paint(); b.onclick = () => { chosen.has(i) ? chosen.delete(i) : chosen.add(i); paint(); }; chips.append(b); });
    f.append(fld('Display name', name), fld('Username', user), fld('Role', role), fld('Experience', exp), fld('Interests', chips)); card.append(f);
    const msg = mk('p', 'msg'); msg.setAttribute('role', 'status'); const row = mk('div', 'wl-row'), skip = mk('a', 'btn2', 'Skip for now'), save = mk('button', 'btn2 primary', 'Save and continue'); skip.href = next; save.type = 'button';
    save.onclick = async () => { save.disabled = true; msg.className = 'msg'; msg.textContent = 'Saving…'; const b = { action: 'saveProfile', username: user.value.trim().toLowerCase(), role: role.value, experience: exp.value, interests: [...chosen] }; if (name.value.trim()) b.name = name.value.trim(); const r = await post(b); save.disabled = false; if (r.s === 200) location.href = next; else { msg.className = 'msg bad'; msg.textContent = r.j.error || 'Could not save.'; } };
    row.append(skip, save); card.append(msg, row); root.append(card);
  }
  const page = document.body.dataset.page; ({ hub, profile, settings, post: postPage, welcome }[page] || (() => {}))();
})();
