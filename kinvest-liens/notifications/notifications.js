/* The bell page: follows, likes, comments and retail alerts, plus a shortcut to unread messages. Text rendered with textContent only. */
(function () {
  'use strict';
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const root = document.getElementById('root');
  const initials = n => (String(n || '?').replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase();
  const av = p => { const a = mk('div', 'dm-av' + (p && p.founder && !p.photo ? ' f' : '')); if (p && (p.photo || p.founder)) { const i = mk('img'); i.alt = ''; i.src = p.photo || '/img/logo-mark.png'; a.append(i); } else a.textContent = p ? initials(p.name) : ''; return a; };
  const ICON = { like: '♥', comment: '💬', follow: '👤', retail: '🛍️' };
  const ago = iso => { const s = (Date.now() - Date.parse(iso)) / 1000; if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  (async () => {
    let r; try { r = await fetch('/.netlify/functions/notifications', { credentials: 'same-origin', cache: 'no-store' }); } catch (e) { root.textContent = 'Could not load.'; return; }
    if (r.status === 401) { location.href = '/login/?next=/notifications/'; return; }
    const d = await r.json(); root.textContent = ''; root.append(mk('h1', '', 'Notifications'));
    const m = d.messages || {}; if (m.unread || m.requests) { const a = mk('a', 'dm-row unread'); a.href = m.unread ? '/messages/' : '/messages/?f=requests'; const ic = mk('div', 'dm-av'); ic.textContent = '✉'; const mid = mk('div', 'dm-mid'); mid.append(mk('b', '', 'Messages'), mk('div', 'dm-prev', [m.unread ? m.unread + ' unread' : '', m.requests ? m.requests + ' request' + (m.requests > 1 ? 's' : '') : ''].filter(Boolean).join(' · '))); a.append(ic, mid, mk('span', 'dm-badge', String(m.unread + m.requests))); root.append(a); }
    if (!d.items.length && !(m.unread || m.requests)) { const e = mk('div', 'dm-empty'); e.append(mk('b', '', 'No notifications yet'), mk('span', '', 'Likes, comments, new followers and retail alerts show up here.')); root.append(e); }
    d.items.forEach(it => { const a = mk('a', 'dm-row' + (it.read ? '' : ' unread')); a.href = it.path || '/'; const left = it.actor ? av(it.actor) : (() => { const x = mk('div', 'dm-av'); x.textContent = ICON[it.kind] || '•'; return x; })();
      const mid = mk('div', 'dm-mid'), t = mk('div', 'nt-text', it.text); const meta = mk('div', 'dm-prev', (ICON[it.kind] || '') + ' ' + ago(it.at)); mid.append(t, meta); a.append(left, mid); if (!it.read) a.append(mk('span', 'nt-dot')); root.append(a); });
    fetch('/.netlify/functions/notifications', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  })();
})();
