// Owner-only property intake. Every new property fact (manual import, county dataset, tax lien or deed
// update, AI discovery) enters here and must be verified and approved before it can be released.
//   GET                                -> { ok, items, releases }
//   POST {action:'submit', items:[..]}      up to 50 items, all accepted or none
//   POST {action:'verify', id, evidenceUrl, notes, checklist}
//   POST {action:'approve', id, releaseMode, criticalReason, criticalConfirmed}
//   POST {action:'reject', id, notes}
//   POST {action:'withdraw', id, reason}    removes a released item for every viewer
// All POSTs need an owner session, a same-origin request and confirmed:true.
import * as auth from '../lib/brain-auth.mjs';
import {
  validateBatch, newItem, verifyItem, approveItem, rejectItem, withdrawReleaseInList, findDuplicate,
  readIntake, mutateIntake, mutateReleases, cleanReleases, describeStatus, releaseIdFor, KINDS,
} from '../lib/property-intake.mjs';

const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Robots-Tag': 'noindex, nofollow'}});
const summarize = (item, releases) => ({
  id: item.id, kind: item.kind, kindLabel: KINDS[item.kind]?.label || item.kind, origin: item.origin, state: item.state, county: item.county,
  parcelId: item.parcelId, title: item.title, description: item.description, certificateNumber: item.certificateNumber, taxYear: item.taxYear,
  sourceUrl: item.sourceUrl, status: describeStatus(item, releases), createdAt: item.createdAt, createdBy: item.createdBy,
  verification: item.verification ? {evidenceUrl: item.verification.evidenceUrl, notes: item.verification.notes, verifiedAt: item.verification.verifiedAt} : null,
  approval: item.approval || null, releaseId: item.releaseId, audit: (item.audit || []).slice(-20),
});

async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(405, {ok: false, error: 'GET or POST only'});
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me?.owner) return json(me ? 403 : 401, {ok: false, error: 'Owner access required'});
  if (req.method === 'GET') {
    const intake = await readIntake(auth);
    const releases = cleanReleases(await auth.kvGet('approved-research-releases-v1'));
    const items = (intake.items || []).slice(-200).reverse().map(item => summarize(item, releases));
    return json(200, {ok: true, items, count: (intake.items || []).length});
  }
  if (req.headers.get('origin') !== new URL(req.url).origin) return json(403, {ok: false, error: 'Invalid origin'});
  let b;
  try { const raw = await req.text(); if (raw.length > 90000) throw Error('too large'); b = JSON.parse(raw); }
  catch { return json(400, {ok: false, error: 'Invalid request'}); }
  if (b?.confirmed !== true) return json(400, {ok: false, error: 'Explicit confirmation required'});
  const actor = 'owner';
  const now = new Date();
  const fail = (r) => json(r.error, {ok: false, error: r.message});

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
