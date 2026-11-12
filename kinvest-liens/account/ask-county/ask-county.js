// Ask the County page: prefill from ?state=&county=&parcel=&kind=, draft with our AI, review, then Send (Gmail) or Copy Message + official link.
(async function () {
  const $ = id => document.getElementById(id), API = '/.netlify/functions/askcounty';
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const q = new URLSearchParams(location.search);
  const say = (el, t, ok) => { el.textContent = t; el.style.color = ok === false ? '#fca5a5' : ''; };
  let st; try { const r = await fetch(API + '?act=status'); st = await r.json(); if (r.status === 401) { $('ac-msg').innerHTML = '<p class="notice">Sign in to use Ask the County.</p><p><a class="btn" href="/login/?next=' + encodeURIComponent(location.pathname + location.search) + '">Sign in</a></p>'; return; } } catch (e) { say($('ac-msg'), 'Could not reach the server.', false); return; }
  if (!st.paid) { $('ac-msg').innerHTML = '<p class="notice">Ask the County is part of the Pro plan.</p><p><a class="btn" href="/account/">See the Pro plan</a></p>'; return; }
  $('ac-app').hidden = false;
  const g = q.get('gmail'); if (g) say($('ac-msg'), {connected: 'Gmail connected.', mismatch: 'That Gmail does not match your signup email (' + st.email + '). Connect the Gmail account for ' + st.email + '.', failed: 'Gmail connection did not finish. Please try again.', noscope: 'Please allow "Send email on your behalf" so we can send your request.', off: 'Gmail sending is not set up yet.'}[g] || '', g === 'connected');
  function gmailBox() {
    const b = $('ac-gmail'); b.textContent = '';
    if (!st.gmail.available) { b.textContent = 'Sending from Gmail is not switched on yet. You can still draft and copy your message into the county’s official page.'; return; }
    if (st.gmail.connected) { b.append('Sending from your Gmail: ' + st.gmail.email + ' (send-only permission). '); const d = mk('button', 'btn small ghost', 'Disconnect'); d.type = 'button'; d.onclick = async () => { await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({act: 'disconnect'})}); st.gmail.connected = false; gmailBox(); }; b.append(d); return; }
    b.append('Connect the Gmail for ' + st.email + ' to send requests from your own address (send-only: we cannot read your mail). ');
    const a = mk('a', 'btn small', 'Connect Gmail'); a.href = API + '?act=oauth'; b.append(a);
  }
  gmailBox();
  // states and counties (from the official links we already list)
  STATES.slice().sort((a, b) => a.n.localeCompare(b.n)).forEach(s => $('ac-state').appendChild(new Option(s.n, s.a)));
  $('ac-state').value = (q.get('state') || 'FL').toUpperCase();
  const fillCounties = () => { const s = STATES.find(x => x.a === $('ac-state').value), dl = $('ac-counties'); dl.textContent = ''; const set = new Set(); (s ? s.links : []).forEach(([t]) => { const m = t.match(/^(.+?) (County|Parish|Borough)\b/); if (m) set.add(m[1]); }); [...set].sort().forEach(c => dl.appendChild(new Option(c))); };
  fillCounties(); $('ac-state').onchange = fillCounties;
  if (q.get('county')) $('ac-county').value = q.get('county');
  if (q.get('parcel')) $('ac-parcel').value = q.get('parcel');
  Object.entries(st.kinds).forEach(([k, label], i) => { const l = mk('label', 'small'); l.style.flexDirection = 'row'; l.style.alignItems = 'center'; l.style.gap = '8px'; const r = mk('input'); r.type = 'radio'; r.name = 'kind'; r.value = k; r.checked = (q.get('kind') || (q.get('parcel') ? 'status' : 'liens')) === k; r.onchange = () => { $('ac-qwrap').hidden = k !== 'custom'; }; l.append(r, label); $('ac-kinds').appendChild(l); });
  $('ac-qwrap').hidden = (document.querySelector('input[name=kind]:checked') || {}).value !== 'custom';
  let cur = null;
  $('ac-form').addEventListener('submit', async e => {
    e.preventDefault(); const btn = $('ac-draft'); btn.disabled = true; say($('ac-msg'), 'Drafting…');
    const kind = (document.querySelector('input[name=kind]:checked') || {}).value;
    const body = {act: 'draft', state: $('ac-state').value, county: $('ac-county').value.trim(), parcel: $('ac-parcel').value.trim(), kind, question: $('ac-q').value};
    try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}); const d = await r.json(); btn.disabled = false;
      if (!r.ok) { say($('ac-msg'), d.error || 'Could not draft it.', false); return; }
      say($('ac-msg'), ''); cur = Object.assign({}, body, d, {requestId: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))}); review();
    } catch (err) { btn.disabled = false; say($('ac-msg'), 'Could not reach the server.', false); }
  });
  function review() {
    $('ac-review').hidden = false; $('ac-subj').value = cur.subject; $('ac-body').value = cur.body; say($('ac-status'), '');
    $('ac-to').value = cur.mode === 'email' ? cur.to : 'No verified email: use the official page below';
    const o = $('ac-office'); o.textContent = 'Office: ' + cur.officeName + (cur.verifiedSource ? ' · address verified on the county’s site ' + cur.checked : '') + (cur.ai ? '' : ' · drafted from our template (AI unavailable)');
    const act = $('ac-actions'); act.textContent = '';
    if (cur.mode === 'email') {
      const send = mk('button', 'btn', 'Send'); send.type = 'button';
      send.onclick = async () => {
        if (send.disabled) return; send.disabled = true; say($('ac-status'), 'Sending…');
        const p = {act: 'send', requestId: cur.requestId, state: cur.state, county: cur.county, parcel: cur.parcel, kind: cur.kind, subject: $('ac-subj').value, body: $('ac-body').value};
        try { const r = await fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(p)}); const d = await r.json();
          if (r.ok && d.ok) { say($('ac-status'), 'Sent from ' + st.gmail.email + '. Replies will come to your inbox.', true); send.textContent = 'Sent'; loadHist(); return; }
          say($('ac-status'), d.error || 'Not sent.', false); if (!d.duplicate) send.disabled = false; if (d.needGmail) gmailBox();
        } catch (e) { say($('ac-status'), 'Could not reach the server. Check Sent requests before trying again.', false); send.disabled = false; }
      };
      if (!st.gmail.connected) { send.disabled = true; say($('ac-status'), 'Connect your Gmail above to send.', false); }
      act.append(send);
    }
    if (cur.link) { const a = mk('a', 'btn' + (cur.mode === 'email' ? ' ghost' : ''), 'Open official page'); a.href = cur.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = cur.linkTitle || ''; act.append(a); }
    const c = mk('button', 'btn ghost', 'Copy Message'); c.type = 'button';
    c.onclick = async () => { const txt = 'Subject: ' + $('ac-subj').value + '\n\n' + $('ac-body').value; try { await navigator.clipboard.writeText(txt); } catch (e) { $('ac-body').select(); document.execCommand('copy'); }
      say($('ac-status'), 'Copied. Paste it into the county’s request page or email.', true);
      fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({act: 'copied', requestId: cur.requestId, state: cur.state, county: cur.county, parcel: cur.parcel, kind: cur.kind, subject: $('ac-subj').value, office: cur.officeName, link: cur.link || ''})}).then(loadHist); };
    act.append(c);
    if (cur.mode !== 'email') act.append(mk('p', 'small muted', cur.link ? 'This county has no email address we could verify, or uses a request portal. Copy the message and paste it on the official page.' : 'We do not have a verified contact for this county yet. Copy the message and send it through the county’s website.'));
    $('ac-review').scrollIntoView({behavior: 'smooth'});
  }
  async function loadHist() {
    const r = await fetch(API + '?act=status'); const d = await r.json(); const h = $('ac-hist'); h.textContent = '';
    if (!d.history || !d.history.length) { h.appendChild(mk('p', 'small muted', 'No requests yet.')); return; }
    d.history.forEach(x => { const p = mk('div', 'usitem'); p.append(mk('b', '', x.subject)); p.append(mk('div', 'small', x.county + ' County, ' + x.state + (x.parcel ? ' · parcel ' + x.parcel : '') + ' · ' + x.kind));
      p.append(mk('div', 'small muted', (x.via === 'gmail' ? 'Sent to ' + x.to + ' from your Gmail' : 'Copied for the official page') + ' · ' + new Date(x.at).toLocaleString())); h.appendChild(p); });
  }
  loadHist();
  if (q.get('county') && (q.get('parcel') || q.get('kind'))) $('ac-form').scrollIntoView();
})();
