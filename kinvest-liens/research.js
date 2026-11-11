// Shared research checklist: used by the practice case and on live lien listings.
// Items: {key, title, why, finding (optional, shown when the visitor taps Check), source:{name,url}, checked, lesson:{href,label}, lookup:{text,href} (when nothing was pre-checked)}.
// Marks are 'verified' | 'followup' | 'unknown'. Nothing is saved here; the caller decides where marks go.
const Research = (function () {
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const LABEL = {verified: 'Verified', followup: 'Needs follow-up', unknown: 'Unknown'};
  function build(items, marks, onChange, opts) {
    opts = opts || {};
    const root = mk('div', 'rschk');
    items.forEach(it => {
      const card = mk('article', 'rsitem'); card.dataset.key = it.key;
      const h = mk('div', 'rsh'); h.append(mk('b', '', it.title), mk('span', 'rschip ' + (marks[it.key] || 'unknown'), LABEL[marks[it.key] || 'unknown'])); card.appendChild(h);
      if (it.why) card.appendChild(mk('p', 'small rswhy', it.why));
      const rec = mk('div', 'rsrec'); rec.hidden = !(opts.showAll || it.revealed);
      const fill = () => {
        rec.textContent = '';
        if (it.finding) rec.appendChild(mk('p', 'rsfind', it.finding)); else rec.appendChild(mk('p', 'rsfind muted', 'Not pre-checked for this certificate.'));
        const meta = mk('p', 'small rsmeta'); meta.append('Source: ');
        if (it.source && it.source.url) { const a = mk('a', '', it.source.name); a.href = it.source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; meta.appendChild(a); } else meta.append((it.source && it.source.name) || 'not recorded');
        meta.append(' · Checked: ' + (it.checked || 'not recorded')); rec.appendChild(meta);
        if (it.lookup) { const p = mk('p', 'small'); const a = mk('a', '', it.lookup.text); a.href = it.lookup.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.appendChild(a); rec.appendChild(p); }
        if (it.lesson) { const p = mk('p', 'small'); const a = mk('a', '', it.lesson.label); a.href = it.lesson.href; a.target = '_blank'; a.rel = 'noopener'; p.append('Learn more: ', a); rec.appendChild(p); }
      };
      fill();
      if (rec.hidden) {
        const b = mk('button', 'btn small', 'Check this'); b.type = 'button';
        b.addEventListener('click', () => { rec.hidden = false; b.remove(); if (opts.onOpen) opts.onOpen(it.key); });
        card.appendChild(b);
      }
      card.appendChild(rec);
      const seg = mk('div', 'rsseg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Mark ' + it.title);
      ['verified', 'followup', 'unknown'].forEach(m => {
        const b = mk('button', 'rsmark ' + m, LABEL[m]); b.type = 'button'; b.setAttribute('aria-pressed', String((marks[it.key] || 'unknown') === m));
        b.addEventListener('click', () => {
          marks[it.key] = m; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          const ch = h.querySelector('.rschip'); ch.className = 'rschip ' + m; ch.textContent = LABEL[m]; if (onChange) onChange(marks);
        });
        seg.appendChild(b);
      });
      card.appendChild(seg); root.appendChild(card);
    });
    return root;
  }
  return {build, LABEL};
})();
