// Owner-only: Disputes & Chargeback Evidence. Lists cases, shows a case timeline, generates the evidence packet (for review, never auto-submitted),
// records private admin notes, restores paid access, and changes the dispute settings. Every admin change is written to the audit trail.
import * as auth from '../lib/auth.mjs';
import * as EV from '../lib/evidence.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const html = (code, body) => new Response(body, { status: code, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

async function owner(req) {
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  return me && auth.markOwner(me).owner ? me : null;
}

const SETTINGS_RULES = {
  suspendDuringDispute: v => typeof v === 'boolean' ? v : null,
  restoreOnWin: v => (v === 'manual' || v === 'auto') ? v : null,
  burstFiles: v => Number.isInteger(v) && v >= 1 && v <= 1000 ? v : null,
  burstHours: v => Number.isInteger(v) && v >= 1 && v <= 720 ? v : null,
  rapidFiles: v => Number.isInteger(v) && v >= 2 && v <= 100 ? v : null,
  rapidSeconds: v => Number.isInteger(v) && v >= 5 && v <= 3600 ? v : null,
  retentionYears: v => Number.isInteger(v) && v >= 1 && v <= 30 ? v : null
};

export default async req => {
  const me = await owner(req);
  if (!me) return req.method === 'GET' ? html(403, 'Owner only.') : json(403, { error: 'Owner only.' });
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const q = url.searchParams;
    if (q.get('settings')) return json(200, { settings: await EV.getSettings(), defaults: EV.DEFAULTS, retentionNote: 'Retention periods are stored, not yet enforced automatically.' });
    if (q.get('audit')) return json(200, { audit: (await EV.auditTrail()).slice(-300).reverse() });
    if (q.get('unmatched')) return json(200, { unmatched: (await EV.unmatchedList()).slice(-200).reverse() });
    if (q.get('customer')) { const t = await EV.trustSummary(clip(q.get('customer'), 120).trim().toLowerCase()); return t ? json(200, { customer: t }) : json(404, { error: 'No member account with that email.' }); }
    if (q.get('id')) {
      const id = clip(q.get('id'), 80);
      const settings = await EV.getSettings();
      const c = await EV.buildCase(id, { settings });
      if (!c) return q.get('packet') ? html(404, 'No such dispute.') : json(404, { error: 'No such dispute.' });
      if (q.get('packet')) return html(200, EV.packetHtml(c));
      const notes = await EV.notes(id);
      return json(200, { case: c, notes, audit: (await EV.auditTrail()).filter(a => a.target && c.customerEmail && a.target === c.customerEmail).slice(-50) });
    }
    // the case list with filters
    const status = clip(url.searchParams.get('status'), 30), risk = clip(url.searchParams.get('risk'), 30), term = clip(url.searchParams.get('q'), 120).toLowerCase();
    const settings = await EV.getSettings();
    const cases = [];
    for (const id of await EV.disputeIds()) { const c = await EV.buildCase(id, { settings }); if (c) cases.push(c); }
    const now = Date.now(), open = c => c.paymentStatus === 'DISPUTED';
    const summary = {
      open: cases.filter(open).length,
      evidenceDueSoon: cases.filter(c => open(c) && c.dueBy && Date.parse(c.dueBy) - now < 7 * 864e5).length,
      won: cases.filter(c => c.paymentStatus === 'CHARGEBACK WON').length,
      lost: cases.filter(c => c.paymentStatus === 'CHARGEBACK LOST').length,
      needsReview: cases.filter(c => c.riskStatus === 'MANUAL REVIEW' || (c.events.some(e => e.type === 'review_required') && c.paymentStatus !== 'CHARGEBACK WON')).length,
      suspicious: cases.filter(c => ['HIGH', 'MANUAL REVIEW'].includes(c.riskStatus)).length,
      unmatchedEvents: (await EV.unmatchedList()).length, total: cases.length
    };
    let list = cases;
    if (status === 'open') list = list.filter(open);
    else if (status === 'closed') list = list.filter(c => !open(c));
    else if (status) list = list.filter(c => c.paymentStatus === status || c.status === status);
    if (risk) list = list.filter(c => c.riskStatus === risk);
    if (term) list = list.filter(c => (c.customerEmail || '').includes(term) || c.id.toLowerCase().includes(term));
    list.sort((a, b) => (a.disputedAt < b.disputedAt ? 1 : -1));
    return json(200, { settings, summary, cases: list.map(c => ({ id: c.id, paymentStatus: c.paymentStatus, status: c.status, reason: c.reason, amount: c.amount, currency: c.currency, customerEmail: c.customerEmail, matched: c.matched, riskStatus: c.riskStatus, disputedAt: c.disputedAt, dueBy: c.dueBy, purchasedAt: c.purchasedAt, userStatus: c.userStatus })) });
  }

  if (req.method !== 'POST') return json(405, { error: 'Use GET or POST.' });
  let b; try { b = await req.json(); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const act = String(b.action || '');

  if (act === 'note') {
    const id = clip(b.id, 80), text = clip(b.text, 2000).trim();
    if (!text) return json(400, { error: 'Write a note first.' });
    if (!(await EV.disputeEvents(id)).length) return json(404, { error: 'No such dispute.' });
    await EV.addNote(id, text, me.email);
    return json(200, { ok: true, notes: await EV.notes(id) });
  }

  if (act === 'restore') {
    const email = auth.normEmail(b.email), reason = clip(b.reason, 500).trim();
    if (!reason || reason.length < 5) return json(400, { error: 'Write the reason for restoring access (at least 5 characters).' });
    const u = await auth.getUser(email); if (!u) return json(404, { error: 'No member account with that email.' });
    if (!u.disputeHold) return json(400, { error: 'This account has no suspended access.' });
    const holdId = u.disputeHold.disputeId;
    await EV.restoreAccess(u, { by: me.email, reason });
    await EV.disputeLog(holdId, 'access_restored', { email: u.email, uid: EV.uidOf(u.email), reason, by: me.email });
    return json(200, { ok: true });
  }

  if (act === 'settings') {
    const patch = b.patch && typeof b.patch === 'object' ? b.patch : {};
    const clean = {};
    for (const [k, rule] of Object.entries(SETTINGS_RULES)) {
      if (patch[k] === undefined) continue;
      const v = rule(patch[k]);
      if (v === null) return json(400, { error: 'That value is not allowed for ' + k + '.' });
      clean[k] = v;
    }
    const before = await EV.getSettings();
    const after = await EV.setSettings(clean);
    await EV.audit('settings_changed', me.email, { target: 'dispute settings', original: Object.fromEntries(Object.keys(clean).map(k => [k, before[k]])), next: Object.fromEntries(Object.keys(clean).map(k => [k, after[k]])), reason: clip(b.reason, 300) || null });
    return json(200, { ok: true, settings: after });
  }

  return json(400, { error: 'Unknown action.' });
};
