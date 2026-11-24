// Owner Dashboard: Academy management. Examination settings, state and county coverage, results, certificates,
// and proposed curriculum updates (nothing is published from here without the owner's click; no AI is called here).
import * as auth from '../lib/auth.mjs';
import * as A from '../lib/academy/academy.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });

export default async (req) => {
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  if (!me || !me.owner) return json(me ? 403 : 401, { ok: false, error: 'Owner access required' });
  if (req.method === 'GET') {
    const [saved, cov, log, certs, props] = await Promise.all([A.SETTINGS_KEY, A.COVERAGE_KEY, A.LOG_KEY, A.CERT_INDEX_KEY, A.PROPOSALS_KEY].map(k => auth.kvGet(k)));
    const states = A.stateCoverage(cov).map(r => ({ ...r, bank: A.bankFor(r.state).length }));
    return json(200, { ok: true, settings: A.mergeSettings(saved), statuses: A.STATUSES, states, stateTopics: A.STATE_TOPICS, countyTopics: A.COUNTY_TOPICS,
      counties: A.countyCoverage(cov), attempts: (log || []).slice(-200).reverse(), certificates: (certs || []).slice(-200).reverse(), proposals: props || [] });
  }
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Use GET or POST.' });
  if ((req.headers.get('origin') || '') && !String(req.headers.get('origin')).includes(new URL(req.url).host)) return json(403, { ok: false, error: 'Same origin only.' });
  let b; try { b = JSON.parse(await req.text() || '{}'); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }
  if (b.action === 'settings') { await auth.kvPut(A.SETTINGS_KEY, A.cleanSettingsInput(b)); return json(200, { ok: true, settings: A.mergeSettings(await auth.kvGet(A.SETTINGS_KEY)) }); }
  if (b.action === 'state-status' || b.action === 'county-status') {
    if (!A.STATUSES.includes(b.status)) return json(400, { ok: false, error: 'Unknown status.' });
    const cov = (await auth.kvGet(A.COVERAGE_KEY)) || {}; cov.states = cov.states || {}; cov.counties = cov.counties || {};
    if (b.action === 'state-status') {
      const st = String(b.state || '').toUpperCase(); if (!A.STATES.some(x => x[0] === st)) return json(400, { ok: false, error: 'Unknown state.' });
      const row = cov.states[st] = cov.states[st] || {};
      if (b.topic) { if (!A.STATE_TOPICS.some(t => t.id === b.topic)) return json(400, { ok: false, error: 'Unknown topic.' }); row.topics = row.topics || {}; row.topics[b.topic] = b.status; }
      else row.status = b.status;
      if (typeof b.note === 'string') row.note = b.note.slice(0, 500);
    } else {
      const st = String(b.state || '').toUpperCase(), county = String(b.county || '').trim().slice(0, 80);
      if (!A.STATES.some(x => x[0] === st) || !county) return json(400, { ok: false, error: 'State and county are required.' });
      if (b.status === 'Published') return json(400, { ok: false, error: 'A county course can be published only when its verified lessons exist.' });
      cov.counties[st + '|' + county] = { status: b.status, note: String(b.note || '').slice(0, 500) };
    }
    await auth.kvPut(A.COVERAGE_KEY, cov);
    return json(200, { ok: true, states: A.stateCoverage(cov), counties: A.countyCoverage(cov) });
  }
  if (b.action === 'certificate-revoke') {
    const c = await auth.kvGet(A.certKey(String(b.id || ''))); if (!c) return json(404, { ok: false, error: 'Not found.' });
    c.revoked = !!b.revoked; await auth.kvPut(A.certKey(c.id), c); return json(200, { ok: true });
  }
  if (b.action === 'proposal') {
    const list = (await auth.kvGet(A.PROPOSALS_KEY)) || []; const p = list.find(x => x.id === b.id); if (!p) return json(404, { ok: false, error: 'Not found.' });
    if (!['approved', 'rejected'].includes(b.decision)) return json(400, { ok: false, error: 'Approve or reject.' });
    p.decision = b.decision; p.decided = new Date().toISOString(); await auth.kvPut(A.PROPOSALS_KEY, list); return json(200, { ok: true, proposals: list });
  }
  return json(400, { ok: false, error: 'Bad action.' });
};
