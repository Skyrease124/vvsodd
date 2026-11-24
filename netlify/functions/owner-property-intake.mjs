// Owner-only property intake. Every new property fact (manual import, county dataset, tax lien or deed
// update, AI discovery) enters here and must be verified and approved before it can be released.
//   GET                                -> { ok, items, releases }
//   POST {action:'submit', items:[..]}      up to 50 items, all accepted or none
//   POST {action:'verify', id, evidenceUrl, notes, checklist}
//   POST {action:'approve', id, releaseMode, criticalReason, criticalConfirmed}
//   POST {action:'reject', id, notes}
//   POST {action:'withdraw', id, reason}    removes a released item for every viewer
//   GET  ?scope=datasets                    the registered county datasets (state, county, counts, imported)
//   GET  ?scope=matches&dataset=ID          parcel-match summary and pending records of one county (no geometry)
//   GET  ?scope=window&dataset=ID           the free-access end of that county's released records
//   POST {action:'import-matches', dataset:ID}  matched records enter the approval queue; the rest stay pending
//   POST {action:'batch-approve', ids:[..]} approve up to 50 items at once, Pro first; one audit entry each
// All POSTs need an owner session, a same-origin request and confirmed:true.
import * as auth from '../lib/brain-auth.mjs';
import crypto from 'node:crypto';
import {
  validateBatch, newItem, verifyItem, approveItem, rejectItem, withdrawReleaseInList, findDuplicate,
  readIntake, mutateIntake, mutateReleases, cleanReleases, describeStatus, releaseIdFor, KINDS, STATUS,
} from '../lib/property-intake.mjs';
import {buildImportPlan} from '../lib/parcel-import.mjs';
import {datasetById, datasetList} from '../lib/parcel-matches-registry.mjs';
import {releaseWindowFor} from '../lib/research-releases.mjs';

const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Robots-Tag': 'noindex, nofollow'}});
// The county dataset a request names. Every request names one: nothing defaults to a county.
function pickDataset(value) {
  if (!value) return {error: 'Choose a county dataset.', status: 400};
  const doc = datasetById(value);
  return doc ? {id: value, doc} : {error: 'No parcel matches for that dataset', status: 404};
}
// Items in the intake that came from this dataset: the same state, county and parcel numbers.
function importedCount(items, id) {
  const doc = datasetById(id);
  if (!doc) return 0;
  const parcels = new Set(doc.records.map(r => r.parcel));
  return items.filter(x => x.origin === 'gis-import' && x.state === doc.state && x.county === doc.county && parcels.has(x.parcelId)).length;
}
const summarize = (item, releases) => ({
  id: item.id, kind: item.kind, kindLabel: KINDS[item.kind]?.label || item.kind, origin: item.origin, state: item.state, county: item.county,
  parcelId: item.parcelId, title: item.title, description: item.description, certificateNumber: item.certificateNumber, taxYear: item.taxYear,
  sourceUrl: item.sourceUrl, status: describeStatus(item, releases), createdAt: item.createdAt, createdBy: item.createdBy,
  verification: item.verification ? {evidenceUrl: item.verification.evidenceUrl, notes: item.verification.notes, verifiedAt: item.verification.verifiedAt} : null,
  approval: item.approval || null, releaseId: item.releaseId, audit: (item.audit || []).slice(-20),
  property: item.property ? {category: item.property.category, address: item.property.address, ownerName: item.property.ownerName,
    amount: item.property.amount, acreage: item.property.acreage, hasCoordinates: !!item.property.candidatePoint, hasBoundary: !!item.property.candidateRing} : null,
  locationVerified: item.verification?.checklist?.locationVerified === true,
});

async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(405, {ok: false, error: 'GET or POST only'});
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me?.owner) return json(me ? 403 : 401, {ok: false, error: 'Owner access required'});
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    if (q.get('scope') === 'datasets') {
      // The counties the dashboard can choose from. A county appears here once it is registered; nothing else names one.
      const items = (await readIntake(auth)).items || [];
      return json(200, {ok: true, datasets: datasetList().map(d => ({...d, imported: importedCount(items, d.id)}))});
    }
    if (q.get('scope') === 'window') {
      // The free-access end for the released records of one county: after it, the approved records (and so any corrected
      // public spelling) are visible to everyone. Read-only; the owner check above applies.
      const picked = pickDataset(q.get('dataset'));
      if (picked.error) return json(picked.status, {ok: false, error: picked.error});
      const releases = cleanReleases(await auth.kvGet('approved-research-releases-v1'));
      const {doc} = picked;
      return json(200, {ok: true, dataset: picked.id, state: doc.state, county: doc.county, ...releaseWindowFor(releases, {state: doc.state, county: doc.county})});
    }
    if (q.get('scope') === 'matches') {
      const picked = pickDataset(q.get('dataset'));
      if (picked.error) return json(picked.status, {ok: false, error: picked.error});
      const {id: dataset, doc} = picked;
      const intake = await readIntake(auth);
      return json(200, {ok: true, dataset, generatedAt: doc.generatedAt, state: doc.state, county: doc.county, summary: doc.summary,
        sources: doc.sources.map(x => ({id: x.id, label: x.label, dataDate: x.dataDate, itemModified: x.itemModified, retrievedAt: x.retrievedAt,
          coverage: x.coverage, terms: x.terms, itemUrl: x.itemUrl})),
        crossCheckSources: (doc.crossCheckSources || []).map(x => ({id: x.id, label: x.label, layerUrl: x.layerUrl, retrievedAt: x.retrievedAt})),
        // Pending records: why each one is pending, the official check that was possible, and the candidate's kind and grade.
        // No coordinates: a candidate position reaches the owner only through the intake, after import.
        pending: doc.records.filter(r => r.status !== 'matched').map(r => ({parcel: r.parcel, address: r.address, reason: r.reason,
          candidates: r.candidates || [], identifierNote: r.identifierNote || null,
          candidate: r.candidate ? {precision: r.candidate.precision, strength: r.candidate.strength || null, acres: r.candidate.acres ?? null} : null,
          crossChecks: r.crossChecks || [], landContext: r.landContext || []})),
        imported: importedCount(intake.items || [], dataset)});
    }
    const intake = await readIntake(auth);
    const releases = cleanReleases(await auth.kvGet('approved-research-releases-v1'));
    const items = (intake.items || []).slice(-500).reverse().map(item => summarize(item, releases));
    // storage tells the owner, before any write, whether this site writes to the isolated preview store.
    return json(200, {ok: true, items, count: (intake.items || []).length, storage: auth.isBrainPreview() ? 'preview-isolated' : 'production'});
  }
  if (req.headers.get('origin') !== new URL(req.url).origin) return json(403, {ok: false, error: 'Invalid origin'});
  let b;
  try { const raw = await req.text(); if (raw.length > 90000) throw Error('too large'); b = JSON.parse(raw); }
  catch { return json(400, {ok: false, error: 'Invalid request'}); }
  if (b?.confirmed !== true) return json(400, {ok: false, error: 'Explicit confirmation required'});
  const actor = 'owner';
  const now = new Date();
  const fail = (r) => json(r.error, {ok: false, error: r.message});

  if (b.action === 'import-matches') {
    const picked = pickDataset(typeof b.dataset === 'string' ? b.dataset : null);
    if (picked.error) return json(picked.status, {ok: false, error: picked.error});
    const doc = picked.doc;
    const releases = cleanReleases(await auth.kvGet('approved-research-releases-v1'));
    let plan = {created: [], skipped: [], refused: []};
    await mutateIntake(auth, intake => {
      plan = buildImportPlan({matches: doc, existingItems: intake.items, releases, now, actor});
      return plan.created.length ? {...intake, items: [...intake.items, ...plan.created]} : undefined;
    });
    return json(200, {ok: true, dataset: picked.id, created: plan.created.length,
      awaitingApproval: plan.created.filter(x => x.status === STATUS.awaiting_approval).length,
      pendingInvestigation: plan.created.filter(x => x.status === STATUS.awaiting_verification).length,
      skipped: plan.skipped.length, refused: plan.refused.slice(0, 20),
      notice: 'Imported for review. Nothing appears on the map until you approve each record (Pro first, Free after 48 hours).'});
  }

  if (b.action === 'batch-approve') {
    const ids = [...new Set(Array.isArray(b.ids) ? b.ids : [])];
    if (!ids.length || ids.length > 50 || !ids.every(x => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x)))
      return json(400, {ok: false, error: 'Choose 1 to 50 items to approve.'});
    if (b.releaseMode !== undefined && b.releaseMode !== 'pro_first_48h')
      return json(400, {ok: false, error: 'Batch approval uses Pro first, Free after 48 hours. Approve a critical release one item at a time.'});
    const batchId = typeof b.batchId === 'string' && /^[A-Za-z0-9-]{8,40}$/.test(b.batchId) ? b.batchId : 'batch-' + crypto.randomUUID().slice(0, 8);
    // Pass 1 (read only): every release is written before any item is marked released, so a failure between the
    // two passes leaves releases that a retry reuses (release ids come from the item ids) and never a released item
    // without its release.
    const snapshot = await readIntake(auth);
    const pass1 = [];
    for (const id of ids) {
      const item = (snapshot.items || []).find(x => x.id === id);
      if (!item || item.status !== STATUS.awaiting_approval) continue;
      const a = approveItem(item, {releaseMode: 'pro_first_48h', now, actor, batchId});
      if (!a.error) pass1.push(a.release);
    }
    if (pass1.length) await mutateReleases(auth, list => {
      const have = new Set(list.map(r => r.id));
      const add = pass1.filter(r => !have.has(r.id));
      return add.length ? [...add, ...list] : undefined;
    });
    // Pass 2: mark each item released, re-checking its state at write time. The same timestamp gives the same release.
    const rows = new Map();
    await mutateIntake(auth, cur => {
      rows.clear();
      let changed = false;
      const items = cur.items.map(x => {
        if (!ids.includes(x.id)) return x;
        if (x.status !== STATUS.awaiting_approval) { rows.set(x.id, {ok: false, error: 'Not awaiting approval (' + String(x.status).replace(/_/g, ' ') + ')'}); return x; }
        const a = approveItem(x, {releaseMode: 'pro_first_48h', now, actor, batchId});
        if (a.error) { rows.set(x.id, {ok: false, error: a.message}); return x; }
        changed = true;
        rows.set(x.id, {ok: true, releaseId: a.release.id});
        return a.item;
      });
      return changed ? {...cur, items} : undefined;
    });
    const results = ids.map(id => ({id, ...(rows.get(id) || {ok: false, error: 'Item not found'})}));
    const approved = results.filter(r => r.ok).length;
    return json(200, {ok: true, batchId, approved, refused: results.length - approved, results,
      notice: approved + ' approved: Pro now, Free and anonymous after 48 hours. Each record keeps its own audit entry under ' + batchId + '.'});
  }

  if (b.action === 'submit') {
    const batch = validateBatch(b.items);
    if (!batch.ok) return json(400, {ok: false, error: batch.error});
    const releases = cleanReleases(await auth.kvGet('approved-research-releases-v1'));
    let created = [], duplicates = [];
    const result = await mutateIntake(auth, intake => {
      created = []; duplicates = [];
      const pool = [...intake.items];
      for (const candidate of batch.items) {
        const dup = findDuplicate(pool, releases, candidate);
        if (dup) { duplicates.push({parcelId: candidate.parcelId, why: dup.why}); continue; }
        const item = newItem(candidate, {now, actor});
        pool.push(item); created.push(item);
      }
      if (!created.length) return undefined;
      return {...intake, items: pool};
    });
    return json(200, {ok: true, created: created.length, duplicates, changed: result.changed,
      items: created.map(item => summarize(item, releases)),
      notice: created.length ? 'Saved for verification. Nothing is public until it is verified, approved and released.' : 'Nothing new was saved.'});
  }

  if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/.test(b.id)) return json(400, {ok: false, error: 'Invalid item id'});
  const intake = await readIntake(auth);
  const current = (intake.items || []).find(x => x.id === b.id);
  if (!current) return json(404, {ok: false, error: 'Item not found'});

  if (b.action === 'verify') {
    const v = verifyItem(current, {evidenceUrl: b.evidenceUrl, notes: b.notes, checklist: b.checklist, now, actor});
    if (v.error) return fail(v);
    let saved = null;
    await mutateIntake(auth, cur => {
      const idx = cur.items.findIndex(x => x.id === b.id);
      if (idx < 0 || cur.items[idx].status !== current.status) return undefined;
      saved = v.item;
      return {...cur, items: cur.items.map((x, i) => i === idx ? v.item : x)};
    });
    if (!saved) return json(409, {ok: false, error: 'The item changed; refresh and try again'});
    return json(200, {ok: true, item: summarize(saved, [])});
  }

  if (b.action === 'approve') {
    const a = approveItem(current, {releaseMode: b.releaseMode, criticalReason: b.criticalReason, criticalConfirmed: b.criticalConfirmed, now, actor});
    if (a.error) return fail(a);
    // The release is written first; the item is marked released second. Release ids are derived from the item id,
    // so a retry after a partial write cannot publish the same item twice.
    await mutateReleases(auth, list => list.some(r => r.id === a.release.id) ? undefined : [a.release, ...list]);
    let saved = null;
    await mutateIntake(auth, cur => {
      const idx = cur.items.findIndex(x => x.id === b.id);
      if (idx < 0 || cur.items[idx].status !== 'awaiting_approval') return undefined;
      saved = a.item;
      return {...cur, items: cur.items.map((x, i) => i === idx ? a.item : x)};
    });
    if (!saved) return json(409, {ok: false, error: 'The item changed; refresh and try again'});
    const releases = cleanReleases(await auth.kvGet('approved-research-releases-v1'));
    return json(200, {ok: true, item: summarize(saved, releases), releaseId: a.release.id,
      notice: a.release.releaseMode === 'immediate_critical' ? 'Released to everyone now.' : 'Released to Pro now. Free and anonymous viewers see it after 48 hours.'});
  }

  if (b.action === 'reject') {
    const r = rejectItem(current, {notes: b.notes, now, actor});
    if (r.error) return fail(r);
    let saved = null;
    await mutateIntake(auth, cur => {
      const idx = cur.items.findIndex(x => x.id === b.id);
      if (idx < 0 || !['awaiting_verification', 'awaiting_approval'].includes(cur.items[idx].status)) return undefined;
      saved = r.item;
      return {...cur, items: cur.items.map((x, i) => i === idx ? r.item : x)};
    });
    if (!saved) return json(409, {ok: false, error: 'The item changed; refresh and try again'});
    return json(200, {ok: true, item: summarize(saved, [])});
  }

  if (b.action === 'withdraw') {
    if (current.status !== 'released' || !current.releaseId) return json(409, {ok: false, error: 'Only a released item can be withdrawn'});
    const releaseId = releaseIdFor(current.id);
    let withdrawn = null, failure = null;
    await mutateReleases(auth, list => {
      const result = withdrawReleaseInList(list, releaseId, {reason: b.reason, now, actor});
      if (result.error) { failure = result; return undefined; }
      withdrawn = result.release;
      return result.list;
    });
    if (failure) return fail(failure);
    let saved = null;
    await mutateIntake(auth, cur => {
      const idx = cur.items.findIndex(x => x.id === b.id);
      if (idx < 0) return undefined;
      const item = cur.items[idx];
      saved = {...item, status: 'withdrawn', audit: [...(item.audit || []), {at: withdrawn.withdrawnAt, action: 'withdrawn', by: actor, note: withdrawn.withdrawal.reason.slice(0, 200)}]};
      return {...cur, items: cur.items.map((x, i) => i === idx ? saved : x)};
    });
    return json(200, {ok: true, item: saved ? summarize(saved, []) : null, withdrawnAt: withdrawn?.withdrawnAt || null,
      notice: 'Withdrawn. The item no longer appears for any viewer.'});
  }

  return json(400, {ok: false, error: 'Unknown action'});
}
export default auth.withBrainStore(handler);
