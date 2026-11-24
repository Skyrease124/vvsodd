// Owner approval queue for validator-verified Wayne corrections, and the NVIDIA consolidation panel.
// Every write is an explicit owner action. Nothing here publishes a correction by itself.
(function () {
 'use strict';
 const $ = id => document.getElementById(id);
 const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
 const fmt = iso => (iso ? new Date(iso).toLocaleString() : '—');
 const REVIEW = '/.netlify/functions/owner-brain-review';
 const NVIDIA = '/.netlify/functions/owner-brain-nvidia';
 const OPINION = '/.netlify/functions/owner-brain-second-opinion';
 const REASON = 'The request did not finish. Refresh the queue before trying again.';

 async function call(url, method, body) {
  const options = {method, credentials: 'same-origin', cache: 'no-store'};
  if (body) { options.headers = {'Content-Type': 'application/json'}; options.body = JSON.stringify(body); }
  const response = await window.PPABrainRequest(url, options);
  const data = await response.json();
  if (!response.ok) throw Error(data.error || REASON);
  return data;
 }

 async function loadQueue() {
  const status = $('approvalStatus');
  try {
   const data = await call(REVIEW, 'GET');
   const entries = data.entries || [];
   // Open validator decisions (pending, or approved but never published), and corrections already public
   // from older validator approvals. Owners can approve or withdraw the latter from here.
   const open = e => e.decision === 'pending_owner_review' || (e.decision === 'approved_for_staging' && e.reviewedBy !== 'owner' && e.publishStatus !== 'published');
   const publicLegacy = e => e.decision === 'approved_for_staging' && e.reviewedBy !== 'owner' && e.publishStatus === 'published';
   const pending = entries.filter(e => e.dataset === 'MI-wayne' && open(e));
   const legacy = entries.filter(e => e.dataset === 'MI-wayne' && publicLegacy(e));
   const waiting = entries.filter(e => e.dataset === 'MI-wayne' && e.decision === 'approved_for_staging' && e.reviewedBy === 'owner' && e.publishStatus !== 'published');
   status.textContent = pending.length + ' waiting for your decision · ' + legacy.length + ' already public from older validator approvals · ' + waiting.length + ' approved and waiting to publish';
   renderQueue(pending.concat(legacy));
  } catch (error) {
   status.textContent = 'Queue unavailable: ' + error.message;
  }
 }

 function renderQueue(items) {
  const box = $('approvalItems');
  box.replaceChildren();
  if (!items.length) { box.append(el('p', 'small', 'No validator-verified corrections are waiting for review.')); return; }
  for (const entry of items.slice(0, 25)) {
   const card = el('article', 'approval-card');
   const isPublic = entry.publishStatus === 'published';
   card.append(el('h3', '', 'Parcel ' + entry.parcelId + ' · record ' + entry.recordId + (isPublic ? ' · already public' : '')));
   card.append(el('p', 'small', (isPublic ? 'Published from a validator approval ' : 'Validator checked ') + fmt(entry.reviewedAt) + ': official identity, address and polygon matched.'));
   const link = el('a', '', 'Open the official evidence');
   link.href = entry.evidenceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
   card.append(link);
   const lat = Number(entry.proposedPosition?.lat), lon = Number(entry.proposedPosition?.lon);
   card.append(el('p', 'small', 'Proposed centre: ' + (Number.isFinite(lat) ? lat.toFixed(5) : '—') + ', ' + (Number.isFinite(lon) ? lon.toFixed(5) : '—')));

   const notes = el('textarea'); notes.rows = 3; notes.maxLength = 1000; notes.placeholder = 'Your review note (at least 15 characters)'; notes.setAttribute('aria-label', 'Review note');
   const confirmLabel = el('label', 'small'); const confirm = el('input'); confirm.type = 'checkbox';
   confirmLabel.append(confirm, document.createTextNode(' I personally checked the official county record.'));
   const mode = el('select'); mode.setAttribute('aria-label', 'Release timing');
   mode.append(new Option('Pro first, Free after 48 hours', 'pro_first_48h'), new Option('Critical: release to everyone now', 'immediate_critical'));
   const criticalBox = el('div', 'approval-critical'); criticalBox.hidden = true;
   const criticalConfirm = el('input'); criticalConfirm.type = 'checkbox';
   const criticalLabel = el('label', 'small'); criticalLabel.append(criticalConfirm, document.createTextNode(' I confirm this corrects inaccurate or misleading information.'));
   const reason = el('textarea'); reason.rows = 2; reason.maxLength = 500; reason.placeholder = 'Why this is critical (at least 40 characters)'; reason.setAttribute('aria-label', 'Critical reason');
   criticalBox.append(criticalLabel, reason);
   mode.addEventListener('change', () => { criticalBox.hidden = mode.value !== 'immediate_critical'; });

   const approve = el('button', '', 'Approve'); approve.type = 'button';
   const reject = el('button', 'danger', isPublic ? 'Withdraw from public map' : 'Reject'); reject.type = 'button';
   const result = el('p', 'small'); result.setAttribute('role', 'status');
   const actions = el('div', 'controls'); actions.append(approve, reject);
   card.append(notes, confirmLabel, mode, criticalBox, actions, result);
   box.append(card);

   const send = async (action) => {
    if (!confirm.checked && action === 'approve') { result.textContent = 'Confirm that you personally checked the official record.'; return; }
    const verb = action === 'approve' ? (mode.value === 'immediate_critical' ? 'Approve and release to everyone now' : 'Approve; Pro first, Free after 48 hours') : (isPublic ? 'Withdraw this public correction from every viewer' : 'Reject');
    if (!window.confirm(verb + ' this correction for parcel ' + entry.parcelId + '?')) return;
    approve.disabled = reject.disabled = true;
    try {
     const data = await call(REVIEW, 'POST', {action, dataset: 'MI-wayne', recordId: entry.recordId, confirmed: true,
      notes: notes.value, officialSourceConfirmed: confirm.checked, evidenceUrl: entry.evidenceUrl,
      releaseMode: action === 'approve' ? mode.value : undefined,
      criticalConfirmed: criticalConfirm.checked, criticalReason: reason.value});
     result.textContent = data.notice || 'Saved.';
     await loadQueue();
    } catch (error) {
     result.textContent = error.message;
     approve.disabled = reject.disabled = false;
    }
   };
   approve.addEventListener('click', () => send('approve'));
   reject.addEventListener('click', () => send('reject'));
  }
 }

 async function publishApproved() {
  const result = $('approvalStatus');
  if (!window.confirm('Publish every approved correction that is waiting? Each publication uses the shared official GIS budget.')) return;
  try {
   const data = await call(REVIEW, 'POST', {action: 'publish-approved', confirmed: true});
   result.textContent = data.notice || 'Publication attempted.';
   await loadQueue();
  } catch (error) { result.textContent = error.message; }
 }

 const STATE_TEXT = {completed: 'Completed', failed: 'Failed', quota_limited: 'Daily limit reached', idle: 'Idle', not_configured: 'Not configured'};
 async function loadNvidia() {
  const status = $('nvidiaStatus');
  try {
   const data = await call(NVIDIA, 'GET');
   const key = data.configured ? 'Key configured (' + (data.keySource === 'env' ? 'environment' : 'saved in admin setup') + '). The key is never shown.' : 'No key configured. Nothing will be sent.';
   status.textContent = (STATE_TEXT[data.state] || data.state) + ' · ' + key + ' · Used today ' + data.usedToday + ' of ' + data.dailyLimit;
   $('nvidiaRun').disabled = !data.configured || data.remainingToday <= 0;
   // Second opinions are display only: they never change, add or approve a proposal.
   let op = null; try { op = await call(OPINION, 'GET'); } catch (e) { op = null; }
   const again = $('cloudflareResume'); if (again) again.hidden = !(op && op.stopped);
   const opinionOf = id => (op && op.results || []).find(x => x.receiptId === id);
   const box = $('nvidiaReceipts'); box.replaceChildren();
   for (const r of (data.receipts || []).slice(0, 5)) {
    const card = el('article', 'approval-card');
    card.append(el('h3', '', fmt(r.at) + ' · ' + (STATE_TEXT[r.outcome] || r.outcome)));
    const sources = Object.entries(r.inputs?.sources || {}).map(([k, v]) => k + ' ' + v).join(', ') || 'none';
    card.append(el('p', 'small', 'Sent: ' + (r.inputs?.count || 0) + ' helper results (' + sources + ')' + (r.model ? ' · model ' + r.model : '') + (r.tried && r.tried.length > 1 ? ' (tried ' + r.tried.join(', then ') + ')' : '')));
    if (r.outcome === 'completed') card.append(el('p', 'small', (r.conflicts || []).length + ' conflict(s) flagged · ' + (r.proposals || []).length + ' proposal(s) await your approval · ' + (r.rejected || []).length + ' citation(s) rejected'));
    for (const p of (r.proposals || []).slice(0, 5)) {
     card.append(el('p', 'small', 'Parcel ' + p.parcelId + (p.dataset ? ' (' + p.dataset + ')' : '') + ': ' + p.summary));
     // Source references come from the helper results NVIDIA received, not from the model's text.
     const refs = (p.sources || []).map(x => x.ref + ' ' + x.source + (x.checkedAt ? ' (' + String(x.checkedAt).slice(0, 10) + ')' : '')).join('; ');
     if (refs) card.append(el('p', 'small', 'Sources: ' + refs));
     const loc = p.facts && p.facts.location;
     card.append(el('p', 'small', loc ? 'Official location: ' + loc.lat + ', ' + loc.lon + ' (from ' + loc.ref + ')' : 'No official location in the sources: nothing is placed on the map.'));
    }
    if (r.outcome === 'completed' && (r.proposals || []).length && op && op.ok) {
     const found = opinionOf(r.id);
     if (found) {
      card.append(el('p', 'small', 'Second opinion (Cloudflare, ' + found.model + '). It is a warning only: no proposal was changed.'));
      for (const o of found.opinions) card.append(el('p', 'small' + (o.verdict === 'supported' ? '' : ' warn'), (o.verdict === 'supported' ? 'Supported' : o.verdict === 'partly' ? 'Only partly supported' : 'Not supported') + ' · parcel ' + o.parcelId + ': ' + o.reason));
     } else {
      const ask = el('button', '', 'Ask Cloudflare for a second opinion'); ask.type = 'button'; ask.disabled = !op.enabled || op.stopped || op.used >= op.daily;
      ask.addEventListener('click', async () => {
       if (!window.confirm('Send these proposals (parcel, summary and source labels only, no positions) to Cloudflare for one second opinion? It uses one of today\'s ' + op.daily + ' allowed requests. Nothing is changed or published.')) return;
       ask.disabled = true; const note = el('p', 'small', 'Asking Cloudflare…'); card.append(note);
       try { await call(OPINION, 'POST', {action: 'second-opinion', receiptId: r.id, confirmed: true}); } catch (error) { note.textContent = error.message; ask.disabled = false; return; }
       await loadNvidia();
      });
      card.append(ask, el('p', 'small', op.stopped ? 'Stopped after a provider error. Use the button below to turn it on again.' : !op.enabled ? 'Switched off in settings.' : 'Used today ' + op.used + ' of ' + op.daily + '. One request per receipt.'));
     }
    }
    if (r.incomplete) card.append(el('p', 'small', 'Incomplete answer: nothing was proposed from it.'));
    for (const c of (r.conflicts || []).slice(0, 5)) card.append(el('p', 'small', 'Conflict on parcel ' + c.parcelId + ': ' + c.detail));
    if (r.error) card.append(el('p', 'small', 'Error: ' + r.error));
    box.append(card);
   }
  } catch (error) { status.textContent = 'NVIDIA status unavailable: ' + error.message; }
 }

 async function runNvidia() {
  if (!window.confirm('Send the current stored helper results to NVIDIA? This uses one of today\'s allowed runs. Nothing is published.')) return;
  const result = $('nvidiaStatus');
  $('nvidiaRun').disabled = true;
  try {
   const data = await call(NVIDIA, 'POST', {action: 'consolidate', confirmed: true});
   result.textContent = data.notice || 'Consolidation finished.';
  } catch (error) { result.textContent = error.message; }
  await loadNvidia();
 }

 const approvalButton = $('publishApprovedBtn'); if (approvalButton) approvalButton.addEventListener('click', publishApproved);
 const resume = $('cloudflareResume'); if (resume) resume.addEventListener('click', async () => { try { await call(OPINION, 'POST', {action: 'cloudflare-resume'}); } catch (e) { /* shown on reload */ } await loadNvidia(); });
 const runButton = $('nvidiaRun'); if (runButton) runButton.addEventListener('click', runNvidia);
 if ($('approvalItems')) loadQueue();
 if ($('nvidiaReceipts')) loadNvidia();
})();
