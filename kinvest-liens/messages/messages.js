/* Private messages. All permissions are enforced by /.netlify/functions/messages. Text is always rendered with textContent. */
(function () {
  'use strict';
  const API = '/.netlify/functions/messages', $ = id => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const get = async q => { try { const r = await fetch(API + '?' + new URLSearchParams(q), { credentials: 'same-origin', cache: 'no-store' }); return { s: r.status, j: await r.json().catch(() => ({})) }; } catch (e) { return { s: 0, j: { error: 'offline' } }; } };
  const post = async o => { try { const r = await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }); return { s: r.status, j: await r.json().catch(() => ({})) }; } catch (e) { return { s: 0, j: { error: 'No connection. Tap to retry.' } }; } };
  const initials = n => (String(n || '?').replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase();
  const av = (p, sm) => { const a = mk('div', 'dm-av' + (sm ? ' sm' : '') + (p.founder && !p.photo ? ' f' : '')); if (p.photo || p.founder) { const i = mk('img'); i.alt = ''; i.src = p.photo || '/img/logo-mark.png'; a.append(i); } else a.textContent = initials(p.name); return a; };
  const short = iso => { const d = new Date(iso), n = new Date(); if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); if (n - d < 6 * 864e5) return d.toLocaleDateString('en-US', { weekday: 'short' }); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  const dayOf = iso => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const cmidNew = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const root = $('root'), q = new URLSearchParams(location.search);
  let timer = null; const stop = () => { clearTimeout(timer); timer = null; };

  function sheet(build) { return new Promise(res => { const ov = mk('div', 'dm-ov'), sh = mk('div', 'dm-sheet'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); const close = v => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 220); res(v); }; ov.onclick = e => { if (e.target === ov) close(null); }; build(sh, close); ov.append(sh); document.body.append(ov); requestAnimationFrame(() => ov.classList.add('on')); }); }
  const options = (title, text, opts) => sheet((sh, close) => { sh.append(mk('h3', '', title)); if (text) sh.append(mk('p', '', text)); opts.forEach(([v, l, bad]) => { const b = mk('button', 'opt' + (bad ? ' bad' : ''), l); b.type = 'button'; b.onclick = () => close(v); sh.append(b); }); const c = mk('button', 'opt', 'Cancel'); c.type = 'button'; c.onclick = () => close(null); sh.append(c); });
  async function reportFlow(cid, messageId) {
    const cat = await options(messageId ? 'Report message' : 'Report user', 'Reports are private and reviewed by PricePocketAsset.', [['Spam', 'Spam'], ['Harassment', 'Harassment'], ['Scam', 'Scam'], ['Fake account', 'Impersonation'], ['Inappropriate content', 'Inappropriate content'], ['Other', 'Other']]); if (!cat) return;
    const r = await post({ action: 'report', cid, category: cat, messageId: messageId || '' }); await options(r.s === 200 ? 'Report sent' : 'Could not send', r.s === 200 ? 'Thank you. PricePocketAsset will review it.' : (r.j.error || ''), [['ok', 'OK']]);
  }

  // ---------------- inbox ----------------
  async function inbox(folder) {
    stop(); document.body.classList.remove('dm-in-chat'); document.title = 'Messages | PricePocketAsset'; root.textContent = ''; root.append(mk('h1', '', 'Messages'));
    const seg = mk('div', 'dm-seg'), list = mk('div'); root.append(seg, list);
    const tabs = [['inbox', 'Messages'], ['requests', 'Requests']]; const btn = {};
    tabs.forEach(([k, l]) => { const b = mk('button', '', l); b.type = 'button'; b.setAttribute('aria-selected', String(k === folder)); b.onclick = () => { history.replaceState(null, '', '/messages/' + (k === 'requests' ? '?f=requests' : '')); inbox(k); }; btn[k] = b; seg.append(b); });
    async function load() {
      const x = await get({ list: folder }); if (x.s === 401) { root.textContent = ''; const e = mk('div', 'dm-empty'); e.append(mk('b', '', 'Sign in to see your messages')); const a = mk('a', 'dm-pill go', 'Sign in'); a.href = '/login/?next=/messages/'; e.append(a); root.append(e); return; }
      if (x.s !== 200) { timer = setTimeout(load, 15000); return; }
      const c = x.j.counts || {}; btn.requests.textContent = 'Requests'; if (c.requests) btn.requests.append(mk('b', '', String(c.requests))); btn.inbox.textContent = 'Messages'; if (c.unread) btn.inbox.append(mk('b', '', String(c.unread)));
      list.textContent = '';
      if (!x.j.rows.length) { const e = mk('div', 'dm-empty'); e.append(mk('b', '', folder === 'requests' ? 'No message requests' : 'No messages yet'), mk('span', '', folder === 'requests' ? 'You are all caught up.' : 'Start a conversation from someone’s PricePocket profile.')); list.append(e); }
      x.j.rows.forEach(r => { const a = mk('a', 'dm-row' + (r.unread ? ' unread' : '')); a.href = '/messages/?c=' + r.cid; a.onclick = e => { e.preventDefault(); history.pushState(null, '', a.href); chat({ cid: r.cid }); };
        const mid = mk('div', 'dm-mid'), top = mk('div', 'dm-top'); top.append(mk('b', '', r.other.name), mk('time', '', short(r.at))); mid.append(top, mk('div', 'dm-prev', (r.mine ? 'You: ' : '') + r.preview)); a.append(av(r.other), mid); if (r.unread) a.append(mk('span', 'dm-badge', String(r.unread))); list.append(a); });
      timer = setTimeout(load, document.hidden ? 60000 : 15000);
    }
    load();
  }

  // ---------------- conversation ----------------
  async function chat(o) {
    stop(); document.body.classList.add('dm-in-chat'); root.textContent = '';
    let info, cid = o.cid;
    if (o.to) { const x = await get({ to: o.to }); if (x.s === 401) { location.href = '/login/?next=' + encodeURIComponent(location.pathname + location.search); return; } if (x.s !== 200) { root.append(mk('div', 'dm-empty', x.j.error || 'This account is not available.')); return; } info = x.j; cid = info.cid; history.replaceState(null, '', '/messages/?c=' + cid + '&to=' + encodeURIComponent(o.to)); }
    const wrap = mk('div', 'dm-chat'), head = mk('div', 'dm-head'), back = mk('button', 'dm-back', '‹'), whoA = mk('a', 'dm-who'), more = mk('button', 'dm-more', '⋯');
    back.type = more.type = 'button'; back.setAttribute('aria-label', 'Back to messages'); more.setAttribute('aria-label', 'Conversation options');
    back.onclick = () => { history.pushState(null, '', '/messages/'); inbox('inbox'); };
    const list = mk('div', 'dm-list'), note = mk('div'), comp = mk('div', 'dm-comp'), ta = mk('textarea'), send = mk('button', 'dm-send', '↑');
    ta.rows = 1; ta.maxLength = 2000; ta.placeholder = 'Message'; ta.setAttribute('aria-label', 'Message'); send.type = 'button'; send.setAttribute('aria-label', 'Send'); send.disabled = true; comp.append(ta, send);
    head.append(back, whoA, more); wrap.append(head, list, note, comp); root.append(wrap);
    const seen = new Map(); let lastId = '', other = info ? info.other : null, canSend = info ? info.canSend : false, state = {};
    const paintHead = () => { whoA.textContent = ''; if (!other) return; whoA.href = '/community/profile/?u=' + encodeURIComponent(other.username); const t = mk('div'); t.append(mk('b', '', other.name), mk('small', '', '@' + other.username)); whoA.append(av(other, true), t); document.title = other.name + ' | Messages'; };
    paintHead();
    let lastDay = '';
    const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    function addMsg(m, { pending, failed } = {}) {
      const key = m.id || m.cmid; let el = seen.get(key) || (m.cmid && seen.get(m.cmid));
      if (el) { el.classList.remove('pending', 'failed'); if (m.id) { seen.set(m.id, el); el.dataset.id = m.id; } const meta = el.nextSibling; if (meta && meta.classList.contains('dm-meta')) meta.textContent = short(m.at); return; }
      const d = dayOf(m.at || new Date().toISOString()); if (d !== lastDay) { list.append(mk('div', 'dm-day', d)); lastDay = d; }
      el = mk('div', 'dm-msg' + (m.mine ? ' me' : '') + (pending ? ' pending' : '') + (failed ? ' failed' : '')); const b = mk('div', 'dm-bub', m.body); el.append(b); if (m.id) el.dataset.id = m.id;
      if (!m.mine && m.id) { let t; b.addEventListener('touchstart', () => { t = setTimeout(() => msgMenu(m), 550); }, { passive: true }); b.addEventListener('touchend', () => clearTimeout(t)); b.addEventListener('contextmenu', e => { e.preventDefault(); msgMenu(m); }); }
      const meta = mk('div', 'dm-meta', pending ? 'Sending…' : short(m.at)); if (!m.mine) meta.style.textAlign = 'left';
      const stick = nearBottom(); list.append(el, meta); seen.set(key, el); if (m.cmid) seen.set(m.cmid, el); if (stick || m.mine) list.scrollTop = list.scrollHeight;
      return el;
    }
    const msgMenu = async m => { const v = await options('Message', '', [['report', 'Report message', true]]); if (v === 'report') reportFlow(cid, m.id); };
    function paintState() {
      note.textContent = ''; note.className = ''; comp.hidden = !canSend;
      if (state.incomingRequest) { note.className = 'dm-note'; note.append(mk('div', '', (other ? other.name : 'This member') + ' wants to send you a message. They won’t know you saw it unless you accept.')); const a = mk('div', 'acts');
        [['accept', 'Accept', 'go'], ['decline', 'Decline', ''], ['block', 'Block', 'bad'], ['report', 'Report', 'bad']].forEach(([k, l, c]) => { const b = mk('button', 'dm-pill ' + c, l); b.type = 'button'; b.onclick = async () => {
          if (k === 'report') return reportFlow(cid); if (k === 'block') { if ((await options('Block ' + (other ? other.name : '') + '?', 'They won’t be able to message you or see your profile.', [['y', 'Block', true]])) !== 'y') return; await post({ action: 'block', cid }); history.pushState(null, '', '/messages/'); return inbox('requests'); }
          const r = await post({ action: 'decide', cid, decision: k }); if (r.s === 200) { if (k === 'accept') refresh(true); else { history.pushState(null, '', '/messages/'); inbox('requests'); } } }; a.append(b); }); note.append(a); }
      else if (state.outgoingRequest) { note.className = 'dm-note'; note.textContent = 'Message request sent. You can send up to 3 messages until they accept.'; }
      else if (!canSend) { note.className = 'dm-note'; note.textContent = state.blocked ? 'You can’t message this account.' : (info && info.reason === 'privacy' ? 'This member isn’t accepting messages from you.' : 'You can’t reply to this conversation.'); }
      else if (info && info.mode === 'request' && !seen.size) { note.className = 'dm-note'; note.textContent = 'Your first message will be sent as a message request.'; }
    }
    let busy = false, quiet = 0;
    async function refresh(force) {
      if (busy) return; busy = true; let x;
      try { x = cid ? await get(Object.assign({ c: cid }, lastId && !force ? { since: lastId } : {})) : { s: 404, j: {} }; } finally { busy = false; }
      if (x.s === 200) { state = x.j; other = x.j.other; canSend = x.j.canSend; paintHead(); const before = seen.size; x.j.messages.forEach(m => { addMsg(m); lastId = m.id > lastId ? m.id : lastId; }); quiet = seen.size > before ? 0 : quiet + 1; paintState(); }
      else if (x.s === 404 && !info) { list.textContent = ''; list.append(mk('div', 'dm-empty', 'Conversation not found.')); comp.hidden = true; return; }
      else if (x.s === 404 && info) { paintState(); }
      // Fast while the chat is active, slower when quiet, paused when the tab is hidden.
      timer = setTimeout(refresh, document.hidden ? 30000 : quiet > 20 ? 10000 : 3000);
    }
    async function doSend(text, cmid, el) {
      const r = await post({ action: 'send', to: other.username, body: text, cmid });
      if (r.s === 200) { if (!cid) cid = r.j.cid; addMsg({ id: r.j.message.id, cmid, mine: true, body: r.j.message.body, at: r.j.message.at }); lastId = r.j.message.id > lastId ? r.j.message.id : lastId; if (r.j.state === 'request') { state.outgoingRequest = true; paintState(); } }
      else { const e = seen.get(cmid); if (e) { e.classList.remove('pending'); e.classList.add('failed'); const meta = e.nextSibling; meta.textContent = (r.j.error || 'Not sent.') + ' '; if (r.s === 0 || r.s >= 500) { const rt = mk('button', '', 'Retry'); rt.type = 'button'; rt.onclick = () => { e.classList.remove('failed'); e.classList.add('pending'); meta.textContent = 'Sending…'; doSend(text, cmid); }; meta.append(rt); } } }
    }
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; send.disabled = !ta.value.trim(); };
    ta.addEventListener('input', fit);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send.click(); } });
    send.onclick = () => { const text = ta.value.trim(); if (!text || !other) return; const cmid = cmidNew(); addMsg({ cmid, mine: true, body: text, at: new Date().toISOString() }, { pending: true }); ta.value = ''; fit(); ta.focus(); doSend(text, cmid); };
    more.onclick = async () => { if (!other) return; const v = await options(other.name, '', [['profile', 'View profile'], ['report', 'Report user', true], ['block', 'Block', true], ['delete', 'Delete conversation', true]]);
      if (v === 'profile') location.href = whoA.href; if (v === 'report') reportFlow(cid);
      if (v === 'block' && (await options('Block ' + other.name + '?', 'They won’t be able to message you or see your profile. They are not told.', [['y', 'Block', true]])) === 'y') { await post({ action: 'block', cid }); refresh(true); }
      if (v === 'delete' && (await options('Delete this conversation?', 'It is removed from your Messages. The other person keeps their copy.', [['y', 'Delete', true]])) === 'y') { await post({ action: 'hide', cid }); history.pushState(null, '', '/messages/'); inbox('inbox'); } };
    // keep the composer above the iPhone keyboard
    if (window.visualViewport) { const vv = () => { if (innerWidth < 760) wrap.style.height = visualViewport.height + 'px'; list.scrollTop = list.scrollHeight; }; visualViewport.addEventListener('resize', vv); }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && document.body.contains(wrap)) { stop(); refresh(); } });
    if (info && !info.exists) { canSend = info.canSend; paintState(); if (canSend) ta.focus(); }
    if (cid && (!info || info.exists)) refresh(true); else timer = null;
  }

  window.addEventListener('popstate', () => { const p = new URLSearchParams(location.search); p.get('c') || p.get('to') ? chat({ cid: p.get('c'), to: p.get('to') }) : inbox(p.get('f') === 'requests' ? 'requests' : 'inbox'); });
  if (q.get('to') && !q.get('c')) chat({ to: q.get('to') }); else if (q.get('c')) chat({ cid: q.get('c') }); else inbox(q.get('f') === 'requests' ? 'requests' : 'inbox');
})();
