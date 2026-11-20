(function () {
  const $ = id => document.getElementById(id);
  const mk = (tag, text) => Object.assign(document.createElement(tag), {textContent:text || ''});
  const tabs = [...document.querySelectorAll('.work-tabs button')];
  const selected = $('work-state'), county = $('work-county');
  const map = $('work-geo').querySelector('iframe');
  const history = [], files = new Map();
  let index, composer, resultVersion = 0;
  const datasetCounty = text => String(text || '').toLowerCase().replace(/ county$/, '');
  const countyMeta = () => index.datasets.find(d => d.id === county.value);
  const button = (caption, fn) => {
    const node = mk('button',caption); node.type = 'button'; node.className = 'workshop-button'; node.addEventListener('click',fn); return node;
  };
  const link = (caption, path) => Object.assign(mk('a',caption),{href:path});
  const scope = () => ({states:selected.value ? [selected.value] : [], county:countyMeta()?.county || null});
  window.ppaWorkshopScope = scope;
  const browse = () => {
    const q = new URLSearchParams({embed:'1',picker:'1'});
    if (county.value) q.set('c',county.value);
    else if (selected.value) q.set('s',selected.value);
    map.src = '/map/?' + q;
    composer.setScope(countyMeta()?.county || index.allStates.find(s => s.a === selected.value)?.n || 'Nationwide');
  };
  const fillCounties = (id = '') => {
    county.replaceChildren(new Option('All counties',''));
    const local = index.datasets.filter(d => d.state === selected.value).sort((a,b) => a.county.localeCompare(b.county));
    local.forEach(d => county.append(new Option(d.county,d.id)));
    county.disabled = !local.length;
    county.value = id;
    if (county.selectedIndex < 0) county.selectedIndex = 0;
  };
  function open(panel, focus = false) {
    for (const tab of tabs) {
      const active = tab.id === 'work-tab-' + panel;
      tab.setAttribute('aria-selected',String(active)); tab.tabIndex = active ? 0 : -1;
      $(tab.getAttribute('aria-controls')).hidden = !active;
      if (active && focus) tab.focus();
    }
    if (panel === 'lists') loadLists();
  }
  tabs.forEach((tab,i) => {
    tab.addEventListener('click',() => open(tab.id.replace('work-tab-','')));
    tab.addEventListener('keydown', e => {
      const next = {ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[e.key];
      if (next === undefined) return;
      e.preventDefault(); open(tabs[next].id.replace('work-tab-',''),true);
    });
  });
  function draft(query) { open('ask'); composer.draft(query); }
  document.querySelectorAll('[data-prompt]').forEach(node => node.addEventListener('click',() => draft(node.dataset.prompt)));
  document.querySelectorAll('[data-panel]').forEach(node => node.addEventListener('click',() => {
    open(node.dataset.panel,true);
    if (node.hasAttribute('data-list-focus')) $('work-list-name').focus();
  }));
  async function loadLists(refresh = false) {
    if (!window.PPASel) return;
    await PPASel.ready();
    const status = refresh ? await PPASel.refresh() : PPASel.status();
    const lists = $('work-saved');
    lists.replaceChildren();
    if (!status?.paid) { lists.append(mk('li','Saved lists could not load.')); return; }
    if (!status.lists.length) { lists.append(mk('li','No saved lists yet. Create one or save research results from Properties.')); return; }
    status.lists.forEach(l => {
      const row = mk('li');
      row.append(mk('b',l.name),mk('span',l.items.length + (l.items.length === 1 ? ' property' : ' properties')));
      if (l.items.length) row.append(button('Download', () => PPASel.openDownload(l.items)));
      lists.append(row);
    });
  }
  $('work-new-list').addEventListener('submit', async e => {
    e.preventDefault();
    const go = e.currentTarget.querySelector('button'), field = $('work-list-name'), status = $('work-list-status');
    const name = field.value.trim(); if (!name || go.disabled || !window.PPASel) return;
    go.disabled = true;
    const reply = await PPASel.post({action:'colCreate',name});
    status.textContent = reply.ok ? 'List created.' : reply.d.error || 'Could not create the list.';
    go.disabled = false;
    if (reply.ok) { field.value = ''; loadLists(true); }
  });
  document.addEventListener('ppalists',() => { if (!$('work-lists').hidden) loadLists(true); });
  function read(d) {
    if (!files.has(d.id)) {
      files.set(d.id,fetch('/map/data/' + d.file).then(r => { if (!r.ok) throw new Error('data'); return r.json(); })
        .then(j => {
          const byId = new Map();
          for (const record of j.recs) {
            const parcel = String(j.dict.p ? j.dict.p[record.p] : record.p);
            const matches = byId.get(parcel) || [];
            matches.push(record); byId.set(parcel,matches);
          }
          return byId;
        }).catch(() => { files.delete(d.id); return null; }));
    }
    return files.get(d.id);
  }
  async function showProperties(data) {
    const result = $('work-results'), version = ++resultVersion;
    const rows = [...(data.results || []),...(data.parcel || [])].filter(r => r?.parcel);
    result.replaceChildren();
    if (!rows.length) { result.append(mk('p','This answer contains no parcel records.')); return; }
    const actions = mk('div'); actions.className = 'work-review';
    const chosen = new Set();
    const save = button('Save selected',() => PPASel.openSave([...chosen]));
    const exportBtn = button('Download selected',() => PPASel.openDownload([...chosen]));
    const compare = button('Compare selected',() => PPASel.openCompare([...chosen]));
    const update = () => { save.disabled = exportBtn.disabled = !chosen.size; compare.disabled = chosen.size < 2; };
    update(); actions.append(save,exportBtn,compare); result.append(actions);
    const list = mk('ul'); list.className = 'work-property-list'; result.append(list);
    const currency = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
    for (const row of rows) {
      const item = mk('li'), description = mk('div');
      description.append(mk('b',[row.county,row.state,row.parcel].filter(Boolean).join(' · ')));
      const amount = row.face ?? row.amount;
      description.append(mk('small',(amount == null ? 'Listed amount unavailable' : 'Listed amount ' + currency.format(amount)) + ' · ' +
        (row.market == null ? 'Market value unavailable' : 'Market value ' + currency.format(row.market))));
      item.append(description); list.append(item);
      const dataset = index.datasets.find(d => d.state === row.state && datasetCounty(d.county) === datasetCounty(row.county));
      if (!dataset) { if (row.state) item.append(link('State records','/liens/states/state/?s=' + encodeURIComponent(row.state))); continue; }
      const matches = (await read(dataset))?.get(String(row.parcel)) || [];
      if (version !== resultVersion) return;
      if (!matches.length) continue;
      item.append(link('Open on map','/map/?' + new URLSearchParams({c:dataset.id,p:row.parcel})));
      // Multiple sale records may share a parcel ID. Require an exact record before exporting.
      const exact = matches.length === 1 ? matches[0] : null;
      if (!exact || !window.PPASel) continue;
      const choice = {i:exact.i,d:dataset.id,t:row.county + ' · ' + row.parcel};
      const label = mk('label','Select'), input = mk('input'); input.type = 'checkbox'; input.setAttribute('aria-label','Select parcel ' + row.parcel);
      input.addEventListener('change', () => { if (input.checked) chosen.add(choice); else chosen.delete(choice); update(); });
      label.prepend(input); item.prepend(label);
    }
  }
  function showAnalysis(data) {
    const panel = $('work-insights'); panel.replaceChildren(mk('p',data.answer || 'No analysis returned.'));
    if (data.searched) panel.append(mk('p','Searched: ' + data.searched));
    if (Number.isFinite(data.total)) panel.append(mk('p',data.total.toLocaleString() + ' matching records'));
    if (data.plan?.length) {
      const steps = mk('ul'); data.plan.forEach(step => steps.append(mk('li',step))); panel.append(mk('h3','Research steps'),steps);
    }
    if (data.uncertainty?.length) {
      const notes = mk('ul'); data.uncertainty.forEach(note => notes.append(mk('li',note))); panel.append(mk('h3','What to verify'),notes);
    }
    if (data.sources?.length) {
      const sources = mk('ul'); data.sources.forEach(source => { const li = mk('li'); li.append(/^https?:\/\//i.test(source.url || '') ? link(source.name,source.url) : mk('span',source.name)); sources.append(li); });
      panel.append(mk('h3','Sources'),sources);
    }
  }
  addEventListener('ppa:workshop-result',e => {
    const {question,data} = e.detail;
    const earlier = history.indexOf(question); if (earlier >= 0) history.splice(earlier,1);
    history.unshift(question); if (history.length > 12) history.pop();
    showProperties(data).catch(() => {}); showAnalysis(data);
  });
  $('work-history').addEventListener('click',() => {
    const list = $('work-history-items'); list.replaceChildren();
    if (!history.length) list.append(mk('li','No questions yet.'));
    history.forEach(question => { const row = mk('li'); row.append(button(question,() => { $('work-history-dialog').close(); draft(question); })); list.append(row); });
    $('work-history-dialog').showModal();
  });
  addEventListener('ppa:workshop-ready',e => {
    if (!e.detail) return;
    index = e.detail.index; composer = e.detail;
    [...index.allStates].sort((a,b) => a.n.localeCompare(b.n)).forEach(s => selected.append(new Option(s.n,s.a)));
    selected.addEventListener('change',() => { fillCounties(); browse(); });
    county.addEventListener('change',browse);
    addEventListener('ppa:workshop-area',event => {
      const area = event.detail;
      if (!area?.state) return;
      selected.value = area.state; fillCounties(area.county || '');
      composer.setScope(countyMeta()?.county || index.allStates.find(s => s.a === selected.value)?.n || 'Nationwide');
    });
    for (const id of ['work-geo','work-quick','work-history']) $(id).hidden = false;
    document.querySelector('.work-tabs').hidden = false;
    $('work-ask').setAttribute('role','tabpanel'); $('work-ask').setAttribute('aria-labelledby','work-tab-ask');
    browse();
  },{once:true});
})();
