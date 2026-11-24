// Owner Dashboard: property intake, research withdrawal and preview-only live checks.
// Nothing here publishes by itself. Every write is an explicit owner action with a confirmation.
// Server text is always written with textContent, never as HTML.
(function () {
 'use strict';
 const $ = id => document.getElementById(id);
 const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
 const fmt = iso => (iso ? new Date(iso).toLocaleString() : '—');
 const INTAKE = '/.netlify/functions/owner-property-intake';
 const RESEARCH = '/.netlify/functions/research-updates';
 const LIVE = '/.netlify/functions/owner-brain-live-checks';
 const REASON = 'The request did not finish. Refresh before trying again.';
 const STATUS_LABEL = {awaiting_verification: 'Awaiting verification', awaiting_approval: 'Verified, awaiting your approval', released: 'Released', rejected: 'Rejected', withdrawn: 'Withdrawn'};
 const OUTCOME_LABEL = {ok: 'OK', failed: 'Failed', not_configured: 'Not configured', budget_limited: 'Allowance used up'};
 const say = (node, text, bad) => { node.textContent = text; node.className = 'pi-status' + (bad ? ' pi-bad' : ''); };

 async function call(url, method, body) {
  const options = {method, credentials: 'same-origin', cache: 'no-store'};
  if (body) { options.headers = {'Content-Type': 'application/json'}; options.body = JSON.stringify(body); }
  const response = await window.PPABrainRequest(url, options);
  const data = await response.json();
  if (!response.ok) throw Error(data.error || REASON);
  return data;
 }

 // Form building blocks.
 const field = (text, node) => { const l = el('label', '', text); l.appendChild(node); return l; };
 const area = (placeholder, rows) => { const t = el('textarea'); t.rows = rows || 3; t.placeholder = placeholder; t.maxLength = 1400; return t; };
 const check = text => { const label = el('label', 'pi-check'); const box = el('input'); box.type = 'checkbox'; label.append(box, ' ' + text); return {label, box}; };
 const button = (text, cls, onClick) => { const b = el('button', cls || 'pi-btn', text); b.type = 'button'; b.addEventListener('click', onClick); return b; };
 const option = (value, text) => { const o = el('option', '', text); o.value = value; return o; };
 const auditBlock = audit => {
  const d = el('details');
  d.appendChild(el('summary', '', 'Audit history (' + ((audit || []).length) + ')'));
  const list = el('ul', 'pi-audit');
  for (const a of audit || []) list.appendChild(el('li', '', fmt(a.at) + ' · ' + a.action + ' · ' + a.by + (a.note ? ' · ' + a.note : '')));
  d.appendChild(list);
  return d;
 };

 // ---- Property intake ----
 let intakeItems = [];
 async function loadIntake() {
  const status = $('intakeStatus');
  try {
   const data = await call(INTAKE, 'GET');
   intakeItems = data.items || [];
   renderIntake();
   if (!intakeItems.length) say(status, 'Nothing is waiting for review.');
  } catch (error) { say(status, error.message, true); }
 }
 function renderIntake() {
  const list = $('intakeList');
  list.replaceChildren();
  for (const item of intakeItems) list.appendChild(intakeCard(item));
 }
 function intakeCard(item) {
  const card = el('article', 'pi-card');
  card.appendChild(el('p', 'pi-meta', [item.kindLabel, item.state, item.county, item.parcelId].filter(Boolean).join(' · ')));
  card.appendChild(el('h3', '', item.title));
  card.appendChild(el('p', 'pi-desc', item.description));
  card.appendChild(el('p', 'pi-meta', 'Origin: ' + item.origin + ' · ' + (STATUS_LABEL[item.status] || item.status)));
  if (item.verification) card.appendChild(el('p', 'pi-meta', 'Verified ' + fmt(item.verification.verifiedAt) + ' · official source: ' + item.verification.evidenceUrl));
  if (item.approval && item.approval.releaseMode) card.appendChild(el('p', 'pi-meta', 'Release: ' + (item.approval.releaseMode === 'immediate_critical' ? 'critical, everyone now' : 'Pro first, Free after 48 hours') + ' · approved ' + fmt(item.approval.at)));
  const actions = el('div', 'pi-actions');
  const panel = el('div', 'pi-form');
  panel.hidden = true;
  if (item.status === 'awaiting_verification') {
   actions.appendChild(toggle('Verify this item', panel, p => verifyForm(item, p)));
  } else if (item.status === 'awaiting_approval') {
   actions.appendChild(toggle('Approve…', panel, p => approveForm(item, p)));
   actions.appendChild(toggle('Reject…', panel, p => rejectForm(item, p)));
  } else if (item.status === 'released') {
   actions.appendChild(button('Withdraw…', 'pi-btn pi-danger', () => openWithdraw('intake', item.id, item.title)));
  }
  card.append(actions, panel, auditBlock(item.audit));
  return card;
 }
 // Opens a form in the card's panel; pressing the same button again closes it.
 function toggle(label, panel, fill) {
  return button(label, 'pi-btn pi-quiet', () => {
   if (!panel.hidden && panel.dataset.open === label) { panel.hidden = true; return; }
   panel.replaceChildren();
   panel.dataset.open = label;
   fill(panel);
   panel.hidden = false;
  });
 }
 // Runs one write. Success is reported above the list; a failure stays inside the card.
 async function run(action, okText, msg) {
  try {
   await action();
   say($('intakeStatus'), okText);
   await loadIntake();
   await loadResearch();
  } catch (error) { say(msg, error.message, true); }
 }
 function verifyForm(item, panel) {
  const url = el('input'); url.type = 'url'; url.placeholder = 'https://… the official county record';
  const notes = area('What you checked and how the parcel matches (at least 15 characters)', 3);
  const official = check('I checked the official county record myself.');
  const identity = check('The parcel number and the address match the record.');
  const msg = el('p', 'pi-status');
  panel.append(field('Official source (https only)', url), field('Verification notes', notes), official.label, identity.label, msg);
  panel.appendChild(button('Save verification', 'pi-btn', () => {
   const link = url.value.trim();
   if (!/^https:\/\//.test(link)) return say(msg, 'The official source must start with https://', true);
   if (notes.value.trim().length < 15) return say(msg, 'Write at least 15 characters of notes.', true);
   if (!official.box.checked || !identity.box.checked) return say(msg, 'Tick both checks first.', true);
   run(() => call(INTAKE, 'POST', {confirmed: true, action: 'verify', id: item.id, evidenceUrl: link, notes: notes.value.trim(),
    checklist: {officialSource: official.box.checked, identityMatched: identity.box.checked}}), 'Verified. Next: approve it or reject it.', msg);
  }));
 }
 function approveForm(item, panel) {
  const mode = el('select');
  mode.append(option('pro_first_48h', 'Pro first, Free after 48 hours (standard)'), option('immediate_critical', 'Critical: release to everyone now'));
  const reason = area('Critical reason: what is inaccurate or misleading, and why it cannot wait (at least 40 characters)', 3);
  reason.hidden = true;
  const critical = check('I confirm this critical release is needed: the public information is inaccurate or misleading.');
  critical.label.hidden = true;
  const checked = check('I personally checked the official record for this item.');
  mode.addEventListener('change', () => { const crit = mode.value === 'immediate_critical'; reason.hidden = !crit; critical.label.hidden = !crit; });
  const msg = el('p', 'pi-status');
  panel.append(field('Release', mode), reason, critical.label, checked.label, msg);
  panel.appendChild(button('Approve and release', 'pi-btn', () => {
   if (!checked.box.checked) return say(msg, 'Tick the check first.', true);
   const crit = mode.value === 'immediate_critical';
   if (crit && (!critical.box.checked || reason.value.trim().length < 40)) return say(msg, 'A critical release needs the confirmation and a reason of at least 40 characters.', true);
   run(() => call(INTAKE, 'POST', {confirmed: true, action: 'approve', id: item.id, releaseMode: mode.value,
    criticalReason: crit ? reason.value.trim() : undefined, criticalConfirmed: crit ? critical.box.checked : undefined}),
   crit ? 'Released to everyone now.' : 'Released to Pro now. Free and anonymous viewers see it after 48 hours.', msg);
  }));
 }
 function rejectForm(item, panel) {
  const notes = area('Why this is rejected (at least 15 characters)', 2);
  const msg = el('p', 'pi-status');
  panel.append(field('Rejection note', notes), msg);
  panel.appendChild(button('Reject: nothing is published', 'pi-btn pi-danger', () => {
   if (notes.value.trim().length < 15) return say(msg, 'Write at least 15 characters explaining the rejection.', true);
   run(() => call(INTAKE, 'POST', {confirmed: true, action: 'reject', id: item.id, notes: notes.value.trim()}), 'Rejected. Nothing was published.', msg);
  }));
 }
 async function submitIntake() {
  const status = $('intakeStatus');
  if (!$('intakeConfirm').checked) return say(status, 'Tick the confirmation first. Nothing is saved until you do.', true);
  let items;
  try { items = JSON.parse($('intakeJson').value); } catch { return say(status, 'The text is not valid JSON. Check commas and quotes.', true); }
  if (!Array.isArray(items)) return say(status, 'Paste a JSON array of items.', true);
  say(status, 'Saving for verification…');
  try {
   const data = await call(INTAKE, 'POST', {confirmed: true, action: 'submit', items});
   say(status, data.notice + ' Created ' + data.created + '; duplicates skipped ' + data.duplicates.length + '.');
   await loadIntake();
  } catch (error) { say(status, error.message, true); }
 }

 // ---- Research releases ----
 let researchItems = [];
 function releaseStatus(r) {
  if (r.withdrawn) return 'Withdrawn ' + fmt(r.withdrawnAt) + ' · reason: ' + ((r.withdrawal && r.withdrawal.reason) || '—');
  if (r.releaseMode === 'immediate_critical') return 'Released to everyone now';
  if (r.freeReleaseAt && Date.parse(r.freeReleaseAt) <= Date.now()) return 'Public to every viewer';
  return 'Pro now · Free after ' + fmt(r.freeReleaseAt);
 }
 async function loadResearch() {
  const status = $('researchStatus');
  try {
   const data = await call(RESEARCH + '?scope=owner', 'GET');
   researchItems = data.releases || [];
   const list = $('researchList');
   list.replaceChildren();
   for (const r of researchItems) list.appendChild(researchCard(r));
   say(status, researchItems.length ? '' : 'No research releases yet.');
  } catch (error) { say(status, error.message, true); }
 }
 function researchCard(r) {
  const card = el('article', 'pi-card');
  card.appendChild(el('p', 'pi-meta', [r.type, r.state, r.county, r.parcelId].filter(Boolean).join(' · ')));
  card.appendChild(el('h3', '', r.title));
  card.appendChild(el('p', 'pi-meta', releaseStatus(r)));
  card.appendChild(auditBlock(r.audit));
  if (!r.withdrawn) card.appendChild(button('Withdraw from every viewer…', 'pi-btn pi-danger', () => openWithdraw('research', r.id, r.title)));
  return card;
 }

 // ---- Withdrawal confirmation (shared by intake and research) ----
 let pending = null;
 function openWithdraw(kind, id, title) {
  pending = {kind, id};
  $('withdrawTitle').textContent = 'Withdraw: ' + title;
  $('withdrawReason').value = '';
  $('withdrawError').textContent = '';
  $('withdrawDialog').showModal();
  $('withdrawReason').focus();
 }
 async function confirmWithdraw(event) {
  event.preventDefault();
  const reason = $('withdrawReason').value.trim();
  if (!pending) return;
  if (reason.length < 15) { $('withdrawError').textContent = 'Write at least 15 characters explaining the withdrawal.'; return; }
  $('withdrawConfirm').disabled = true;
  try {
   const data = pending.kind === 'intake'
    ? await call(INTAKE, 'POST', {confirmed: true, action: 'withdraw', id: pending.id, reason})
    : await call(RESEARCH, 'POST', {action: 'withdraw', id: pending.id, reason});
   $('withdrawDialog').close();
   pending = null;
   say($('researchStatus'), 'Withdrawn at ' + fmt(data.withdrawnAt || new Date().toISOString()) + '. It no longer appears for any viewer.');
   await loadIntake();
   await loadResearch();
  } catch (error) {
   $('withdrawError').textContent = error.message;
  } finally {
   $('withdrawConfirm').disabled = false;
  }
 }

 // ---- Live checks (preview only; the panel stays hidden where the endpoint answers 404) ----
 async function loadLive() {
  const status = $('liveStatus');
  try {
   const response = await window.PPABrainRequest(LIVE, {credentials: 'same-origin', cache: 'no-store'});
   if (response.status === 404) { $('liveChecksPanel').hidden = true; return; }
   const data = await response.json();
   if (!response.ok) throw Error(data.error || REASON);
   $('liveChecksPanel').hidden = false;
   renderLive(data.items || []);
   say(status, '');
  } catch (error) { say(status, error.message, true); }
 }
 function renderLive(items) {
  const list = $('liveList');
  list.replaceChildren();
  for (const item of items) {
   const card = el('article', 'pi-card');
   card.appendChild(el('h3', '', item.label));
   card.appendChild(el('p', 'pi-meta', item.cost));
   card.appendChild(el('p', 'pi-meta', item.available ? 'Configured on the server. The value is never shown.' : (item.missing || 'Not configured.')));
   card.appendChild(el('p', 'pi-meta', item.limitPerDay != null ? 'Used today: ' + (item.usedToday || 0) + ' of ' + item.limitPerDay : 'Shared budget, checked on each run'));
   if (item.last) card.appendChild(el('p', 'pi-meta', 'Last run ' + fmt(item.last.at) + ': ' + (OUTCOME_LABEL[item.last.outcome] || item.last.outcome) + '. ' + item.last.detail));
   const msg = el('p', 'pi-status');
   const btn = button('Run once…', 'pi-btn', () => runLive(item, btn, msg));
   btn.disabled = !item.available;
   card.append(btn, msg);
   list.appendChild(card);
  }
 }
 async function runLive(item, btn, msg) {
  if (!window.confirm('Run "' + item.label + '" once?\n\n' + item.cost)) return;
  btn.disabled = true;
  say(msg, 'Running…');
  try {
   const data = await call(LIVE, 'POST', {confirmed: true, action: 'run', name: item.name});
   say(msg, (OUTCOME_LABEL[data.result.outcome] || data.result.outcome) + ': ' + data.result.detail);
  } catch (error) {
   say(msg, error.message, true);
  } finally {
   btn.disabled = false;
  }
  await loadLive();
 }

 $('intakeSubmit').addEventListener('click', submitIntake);
 $('intakeRefresh').addEventListener('click', loadIntake);
 $('researchRefresh').addEventListener('click', loadResearch);
 $('liveRefresh').addEventListener('click', loadLive);
 $('withdrawCancel').addEventListener('click', () => { pending = null; $('withdrawDialog').close(); });
 $('withdrawForm').addEventListener('submit', confirmWithdraw);
 loadIntake();
 loadResearch();
 loadLive();
})();
