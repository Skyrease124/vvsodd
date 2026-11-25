// Research Releases presentation: release history grouped by stage, pending approvals, and the release form in one section.
// Reads only owner-only views the dashboard already uses (research releases and the intake count). It writes nothing:
// withdrawals stay in the AI Brain Control Center, and the 48 hour Pro early access rule is applied by the server as before.
(function () {
  const O = window.OUI, main = document.querySelector('main'), form = document.getElementById('form');
  if (!O || !main || !form) return;
  document.body.classList.add('ou', 'p-rel');
  main.querySelector('h1').textContent = 'Research Releases';
  main.querySelectorAll(':scope > p, :scope > .notice').forEach(n => { if (n.id !== 'status') n.classList.add('ou-hide'); });
  document.getElementById('status').classList.add('ou-sub');
  // The release form folds into a section.
  const box = O.el('div', 'ou-card'); form.before(box); const h = O.el('h2', '', 'New release'); box.append(h, form);
  O.fold(box, [h], {icon: 'upload', color: '#30b46c', sub: O.el('span', 'ou-sub', 'Pro now, Free after 48 hours')});
  const links = O.el('div', 'ou-links'); links.innerHTML = '<a href="/owner/certificates/">Certificate Review</a><a href="/reviewed-certificates.html">Member research updates</a><a href="/owner/brain/#researchPanel">Withdraw a release</a>';
  box.after(links);
  // Stages.
  const label = O.el('div', 'ou-label', 'Release stages'); const list = O.el('div', 'ou-list'); links.after(label, list);
  const fmt = iso => (iso ? new Date(iso).toLocaleString() : 'None');
  const group = (name, icon, color, sub) => { const g = O.el('div', 'ou-card'); const t = O.el('h2', '', name); g.append(t, O.el('div', 'ou-rel-list')); O.fold(g, [t], {icon, color, sub: O.el('span', 'ou-sub', sub), pills: [O.pill('0', 'off')]}); list.appendChild(g); return g; };
  const pending = group('Pending approvals', 'check', '#ff9f0a', 'Waiting in the intake for your approval');
  const early = group('Pro early access', 'clock', '#7a5af8', 'Pro members now, Free after 48 hours');
  const pub = group('Public releases', 'globe', '#30b46c', 'Visible to every viewer');
  const hist = group('Publication history', 'table', '#8e8e93', 'Withdrawn releases and reasons');
  const fill = (g, rows) => { const body = g.querySelector('.ou-rel-list'); body.replaceChildren();
    rows.forEach(r => { const line = O.el('div', 'ou-rel'); line.append(O.el('b', '', r[0]), O.el('span', 'ou-sub', r[1])); body.appendChild(line); });
    if (!rows.length) body.appendChild(O.el('p', 'ou-sub', 'None.'));
    const p = g.querySelector('.ou-pill'); p.textContent = String(rows.length); p.className = 'ou-pill ' + (rows.length ? 'ok' : 'off'); };
  [pending, early, pub, hist].forEach(g => fill(g, []));
  const get = url => fetch(url, {credentials: 'same-origin', cache: 'no-store'}).then(r => (r.ok ? r.json() : null)).catch(() => null);
  get('/.netlify/functions/research-updates?scope=owner').then(d => {
    if (!d || !Array.isArray(d.releases)) return;
    const now = Date.now(), rel = d.releases;
    const line = r => [r.title || 'Release', [r.state, r.county, r.parcelId].filter(Boolean).join(' · ') + ' · Free ' + fmt(r.freeReleaseAt)];
    fill(early, rel.filter(r => !r.withdrawn && r.releaseMode !== 'immediate_critical' && Date.parse(r.freeReleaseAt) > now).map(line));
    fill(pub, rel.filter(r => !r.withdrawn && (r.releaseMode === 'immediate_critical' || Date.parse(r.freeReleaseAt) <= now)).map(r => [r.title || 'Release', [r.state, r.county, r.parcelId].filter(Boolean).join(' · ')]));
    fill(hist, rel.filter(r => r.withdrawn).map(r => [r.title || 'Release', 'Withdrawn ' + fmt(r.withdrawnAt) + ' · ' + ((r.withdrawal && r.withdrawal.reason) || 'No reason recorded')]));
  });
  get('/.netlify/functions/owner-property-intake').then(d => {
    if (!d || !Array.isArray(d.items)) return;
    fill(pending, d.items.filter(i => i.status && /awaiting approval|awaiting_approval|Verified, awaiting/i.test(String(i.status.label || i.status))).map(i => [i.title, [i.state, i.county].filter(Boolean).join(' · ')]));
  });
  O.cleanTree(main);
})();
