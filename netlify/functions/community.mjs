// Community API (members only). All permission checks live here and in lib/community.mjs; the pages only display what this returns.
//   GET  ?me=1 | ?u=name | ?u=name&list=followers|following | ?u=name&mutual=1 | ?u=name&collections=1 | ?search=q | ?suggest=1 | ?options=1 | ?reports=1 (owner)
//   POST {action: saveProfile|follow|unfollow|block|unblock|report|saveCollection|deleteCollection|ownerAward|ownerBackfill|ownerCloseReport}
import * as auth from '../lib/auth.mjs';
import * as C from '../lib/community.mjs';
import * as RL from '../lib/ratelimit.mjs';

const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const fail = r => json(r.status || 400, { ok: false, error: r.error });

export default async function handler(req, context) {
  const user = await auth.userFromCookie(req.headers.get('cookie'));
  if (!user) return json(401, { ok: false, error: 'Sign in to use the community.', signin: true });
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';
  if (!(await RL.hit('comm:' + user.email, req.method === 'POST' ? +(process.env.COMMUNITY_WRITE_LIMIT || 60) : +(process.env.COMMUNITY_READ_LIMIT || 240), 60e3)).ok) return json(429, { ok: false, error: 'Too many requests. Please slow down.' });
  const me = await C.ensureProfile(user);   // creates the profile and the Founder connection on first visit (also heals members created before this feature)
  const founder = await C.isFounderProfile(me);
  const u = new URL(req.url), q = u.searchParams;

  if (req.method === 'GET') {
    if (q.get('options')) return json(200, { ok: true, roles: C.ROLES, experience: C.EXPERIENCE, interests: C.INTERESTS, reportCategories: C.REPORT_CATEGORIES, awards: Object.fromEntries(Object.entries(C.AWARDABLE).map(([k, v]) => [k, v[0]])) });
    if (q.get('me')) return json(200, { ok: true, me: Object.assign(await C.publicView(me, me.uid), { privacy: me.privacy, notif: me.notif, city: me.city, state: me.state, founderView: founder, owner: !!user.owner, verify: await C.verifyStatus(me) }) });
    if (q.get('search') !== null && q.get('search') !== undefined) return json(200, Object.assign({ ok: true }, await C.search(q.get('search'), me)));
    if (q.get('suggest')) return json(200, Object.assign({ ok: true }, await C.suggestions(me)));
    if (q.get('verifyRequests')) { if (!user.owner) return json(403, { ok: false, error: 'Owner only.' }); return json(200, { ok: true, requests: await C.listVerifyRequests() }); }
    if (q.get('reports')) { if (!user.owner) return json(403, { ok: false, error: 'Owner only.' }); return json(200, { ok: true, reports: await C.listReports() }); }
    const name = q.get('u');
    if (name) {
      const t = await C.getByUsername(name);
      if (!t || !(await C.isVisible(t))) return json(404, { ok: false, error: 'This profile is not available.' });
      const rel = await C.relation(me, t);
      if (rel.blockedBy) return json(404, { ok: false, error: 'This profile is not available.' });
      if (rel.blocked) return json(200, { ok: true, blockedByMe: true, profile: { uid: t.uid, username: t.username, name: t.name }, rel });
      if (q.get('list')) { const k = q.get('list'); if (!['followers', 'following'].includes(k)) return json(400, { ok: false, error: 'Bad list.' }); return json(200, Object.assign({ ok: true }, await C.listFollows(t, k, me, { limit: 50, offset: Math.max(0, +q.get('offset') || 0) }))); }
      if (q.get('mutual')) return json(200, Object.assign({ ok: true }, await C.mutual(t, me)));
      if (q.get('collections')) return json(200, { ok: true, collections: await C.listCollections(t, me.uid) });
      return json(200, { ok: true, profile: await C.publicView(t, me.uid), rel, viewerIsFounder: founder, owner: !!user.owner });
    }
    return json(400, { ok: false, error: 'Nothing asked.' });
  }
  if (req.method !== 'POST') return json(405, { ok: false });

  let b; try { b = await req.json(); } catch (e) { return json(400, { ok: false, error: 'Bad request.' }); }
  const act = String(b.action || '');
  const done = r => (r.ok === false ? fail(r) : json(200, r));
  if (act === 'saveProfile') return done(await C.saveProfile(me, b, { founder }));
  if (act === 'follow') return done(await C.follow(me, b.uid));
  if (act === 'unfollow') return done(await C.unfollow(me, b.uid));
  if (act === 'block') return done(await C.block(me, b.uid));
  if (act === 'unblock') return done(await C.unblock(me, b.uid));
  if (act === 'report') { if (!(await RL.hit('report:' + user.email, 10, 3600e3)).ok) return json(429, { ok: false, error: 'You have sent several reports. Please wait before sending more.' }); return done(await C.report(me, b.uid, b.category, b.details)); }
  if (act === 'requestVerify') return done(await C.requestVerify(me, b.note));
  if (act === 'saveCollection') return done(await C.saveCollection(me, b));
  if (act === 'deleteCollection') return done(await C.deleteCollection(me, b.id));
  if (act === 'ownerAward' || act === 'ownerBackfill' || act === 'ownerCloseReport' || act === 'ownerVerifyDecision') {
    if (!user.owner) return json(403, { ok: false, error: 'Owner only.' });
    if (act === 'ownerVerifyDecision') { const t = await C.getByUsername(b.username); if (!t) return json(404, { ok: false, error: 'Member not found.' }); if (b.approve) await C.ownerAward(t, { verified: true }); return done(await C.closeVerifyRequest(t.uid, !!b.approve)); }
    if (act === 'ownerBackfill') return json(200, Object.assign({ ok: true }, await C.backfill()));
    if (act === 'ownerCloseReport') { const k = 'crp_' + String(b.id || '').replace(/[^a-f0-9]/g, ''); const r = await auth.kvGet(k); if (!r) return json(404, { ok: false, error: 'Report not found.' }); r.status = 'closed'; await auth.kvPut(k, r); return json(200, { ok: true }); }
    const t = await C.getByUsername(b.username); if (!t) return json(404, { ok: false, error: 'Member not found.' });
    return done(await C.ownerAward(t, { verified: b.verified, awards: b.awards }));
  }
  return json(400, { ok: false, error: 'Unknown action.' });
}
