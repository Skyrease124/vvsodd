// Parcel detail page: /liens/parcel/?k=STATE|County|ParcelID|Certificate
(async function () {
  const $ = id => document.getElementById(id), mk = PF.mk;
  const FILES = {'Palm Beach': 'liens-palmbeach.js', 'Larimer': 'liens-larimer.js', 'Pinal': 'liens-pinal.js', 'Coconino': 'liens-coconino.js', 'Leon': 'liens-leon.js', 'Manatee': 'liens-manatee.js', 'Alachua': 'liens-alachua.js', 'Bay': 'liens-bay.js', 'Miami-Dade': 'liens-miamidade.js', 'Saguache': 'liens-saguache.js', 'El Paso': 'liens-elpaso.js', 'Boulder': 'liens-boulder.js', 'Scott': 'liens-scott.js', 'Davidson': 'liens-davidson.js', 'Wayne': 'liens-wayne.js', 'Walton': 'liens-walton.js', 'Santa Rosa': 'liens-santarosa.js', 'Volusia': 'liens-volusia.js', 'Pasco': 'liens-pasco.js', 'Osceola': 'liens-osceola.js', 'Sarasota': 'liens-sarasota.js', 'Duval': 'liens-duval.js', 'Escambia': 'liens-escambia.js', 'Hillsborough': 'liens-hillsborough.js', 'Hernando': 'liens-hernando.js', 'Nassau': 'liens-nassau.js'};
  const k = new URLSearchParams(location.search).get('k') || '', key = PF.parseKey(k);
  if (!key.county || !FILES[key.county]) { $('ptitle').textContent = 'Parcel not found'; $('psub').textContent = 'This link does not point to a parcel we list.'; return; }
  $('back').href = '/liens/states/state/?s=' + encodeURIComponent(key.state); 
  await new Promise(r => { const s = document.createElement('script'); s.src = '/liens/states/' + FILES[key.county]; s.onload = r; s.onerror = r; document.head.appendChild(s); });
  let l = LIENS.find(x => PF.key(x) === k);
  const tl = await PF.tl({state: key.state, county: key.county});
  let gone = false;
  if (!l && tl && tl.gone && tl.gone[k]) { l = Object.assign({state: key.state, county: key.county, status: 'No longer listed. Outcome unconfirmed.', source: tl.lastVerified && tl.lastVerified.sourceUrl || ''}, tl.gone[k]); gone = true; }
  if (!l) { $('ptitle').textContent = 'Parcel ' + key.parcel; $('psub').textContent = 'We do not have this parcel in the ' + key.county + ' County list.'; return; }
  document.title = 'Parcel ' + l.parcel + ' | PricePocketAsset';
  $('ptitle').textContent = 'Parcel ' + l.parcel;
  $('psub').textContent = l.county + ' County, ' + (l.state || 'FL') + (l.cert ? ' · certificate ' + l.cert : '') + (l.owner ? ' · Owner: ' + l.owner : '') + (l.address ? ' · ' + l.address : '');
  if (gone) { const n = mk('p', 'notice', 'No longer listed. Outcome unconfirmed.'); n.setAttribute('role', 'status'); $('pstatus').appendChild(n); }
  const f = $('pfacts'); const add = (a, b) => { if (b == null || b === '') return; const d = mk('div', 'pfact'); d.append(mk('span', 'small muted', a), mk('b', '', b)); f.appendChild(d); };
  add(l.priceLabel === 'Sold for' ? 'Actual sale price' : PF.amountLabel(l), l.amount != null ? PF.money(l.amount) : (l.priceLabel ? 'Not listed' : '')); add('Payoff (list date)', l.payoff != null ? PF.money(l.payoff) : ''); add('Sale', l.saleDate); add('Rate', l.rate); add('Acres', l.acres); add('Use', l.use); add('County value', l.market != null ? PF.money(l.market).replace('.00', '') : '');
  if (l.mailing) add('Owner mailing address', l.mailing);
  const act = $('pact');
  act.appendChild(PF.watchButton(l, 'btn small'));
  const hasMap = (typeof PARCEL_MAPS !== 'undefined' && PARCEL_MAPS[l.county]) || (l.state || 'FL') === 'FL';
  const geo = await (async () => { const c = await PF.cfg(l); const g = c && c.geo ? await PF.json(PF.base + 'geo-' + c.slug + '.json') : null; return g && g.geo[l.parcel]; })();
  if (geo) { l.lat = geo[0]; l.lng = geo[1]; l.geoQuality = geo[2]; }
  if (hasMap || geo) { const b = mk('button', 'btn small ghost', 'Show on map'); b.type = 'button'; b.addEventListener('click', () => LienMap.open(l)); act.appendChild(b); }
  const rb = mk('button', 'btn small ghost', 'Research'); rb.type = 'button'; rb.addEventListener('click', () => LienResearch.open(l)); act.appendChild(rb);
  act.appendChild(LienSave.button(l, 'btn small ghost')); const bb = LienBuy.button(l, 'btn small ghost'); if (bb) act.appendChild(bb);
  const w = mk('a', 'btn small ghost', 'Bid or Pass worksheet'); w.href = '#ws'; act.appendChild(w);
  $('map').hidden = true;
  if (PF.REPORT_COUNTIES.includes(l.county)) { $('rep').hidden = false; PF.reportButtons(act, l, () => PF._rep); PF.report($('rep'), l); }
  if ((l.state || 'FL') === 'FL') ParcelData.rec(l).then(({r}) => { $('cl').hidden = false; $('cl').appendChild(CleanupData.section(l, r)); });
  await PF.timeline($('tl'), l);
  await PF.nearby($('nb'), l);
  await PF.worksheet($('ws'), l);
  if (location.hash === '#ws') $('ws').scrollIntoView();
})();
