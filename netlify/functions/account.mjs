// Member accounts: sign up, sign in, sign out, saved liens.
import crypto from 'node:crypto';
import * as auth from '../lib/auth.mjs';
import * as usage from '../lib/usage.mjs';
import * as S from '../lib/stripe.mjs';

const tries = new Map();
const json = (code, body, cookie) => ({ statusCode: code, cookie, body: JSON.stringify(body) });
const pub = u => ({ email: u.email, owner: !!u.owner, paidThrough: u.paidThrough || '', sub: u.sub ? { status: u.sub.status, periodEnd: u.sub.periodEnd, cancelAtPeriodEnd: !!u.sub.cancelAtPeriodEnd } : null, hasCustomer: !!u.stripeCustomerId, saved: u.saved || [], portfolio: u.portfolio || [] });

const STATUS = ['open', 'redeemed', 'foreclosure', 'other'];
const numOrNull = (v, lo, hi) => { if (v === '' || v == null) return null; const n = Number(v); return isFinite(n) && n >= lo && n <= hi ? n : undefined; };
const dateOrNull = v => { if (!v) return null; return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : undefined; };
// Validates a portfolio entry; returns the clean entry or an error string.
function cleanHolding(h) {
  if (!h || typeof h !== 'object') return 'Bad entry.';
  const state = String(h.state || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return 'Pick a state.';
  const paid = numOrNull(h.paid, 0, 1e9), rate = numOrNull(h.rate, 0, 100), months = numOrNull(h.months, 0, 240), bought = dateOrNull(h.bought), closed = dateOrNull(h.closed);
  if (paid === undefined || paid === null) return 'Enter what you paid (a number).';
  if (rate === undefined) return 'Rate must be between 0 and 100.';
  if (months === undefined) return 'Redemption months must be between 0 and 240.';
  if (bought === undefined || bought === null) return 'Enter the date you bought it.';
  if (closed === undefined) return 'Bad closing date.';
  const status = STATUS.includes(h.status) ? h.status : 'open';
  const id = /^[a-z0-9]{6,24}$/.test(String(h.id || '')) ? String(h.id) : Math.random().toString(36).slice(2, 12);
  return { id, state, county: String(h.county || '').slice(0, 60), parcel: String(h.parcel || '').slice(0, 40), paid, rate, bought, months, status, closed, notes: String(h.notes || '').slice(0, 300) };
}

async function handle(event) {
  const me = await auth.userFromCookie(event.headers.cookie);
  if (event.httpMethod === 'GET') {
    if (event.query && event.query.stripe) {
      if (!me || !me.owner) return json(403, { error: 'Owner only.' });
      const c = await S.getConfig();
      return json(200, { configured: !!c, mode: c ? c.mode : null, source: c ? c.source : null, hint: c ? '\u2026' + c.secretKey.slice(-4) : '', webhook: !!(c && c.webhookSecret), webhookUrl: S.siteUrl() + '/.netlify/functions/stripe-webhook',
        events: ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'charge.refunded', 'charge.dispute.created', 'radar.early_fraud_warning.created'] });
    }
    if (event.query && event.query.members) {
      if (!me || !me.owner) return json(403, { error: 'Owner only.' });
      const keys = await auth.kvList('u_');
      const list = [];
      for (const k of keys.slice(0, 2000)) {
        const u = await auth.kvGet(k); if (!u || !u.email) continue;
        list.push({ email: u.email, created: u.created || '', lastLogin: u.lastLogin || '', owner: !!(auth.markOwner(u).owner), revoked: !!u.revoked, paidThrough: u.paidThrough || '', note: u.note || '', sub: u.sub ? u.sub.status + (u.sub.cancelAtPeriodEnd ? ' (cancels at period end)' : '') : '', alert: u.billingAlert ? u.billingAlert.type : '', saved: (u.saved || []).length, portfolio: (u.portfolio || []).length });
      }
      list.sort((a, b) => (b.created > a.created ? 1 : -1));
      return json(200, { members: list });
    }
    if (event.query && event.query.resets) {
      if (!me || !me.owner) return json(403, { error: 'Owner only.' });
      return json(200, { requests: await auth.getResetRequests() });
    }
    if (event.query && event.query.usage) {
      if (!me || !me.owner) return json(403, { error: 'Owner only.' });
      return json(200, { limit: await usage.getLimit(), today: await usage.today(), days: await usage.history(14) });
    }
    return json(200, { user: me ? pub(me) : null });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const act = String(b.action || '');

  if (act === 'setLimit') {
    if (!me || !me.owner) return json(403, { error: 'Owner only.' });
    const n = Math.round(Number(b.daily));
    if (!isFinite(n) || n < 0 || n > 5000) return json(400, { error: 'Pick a number from 0 to 5000.' });
    await usage.setLimit(n);
    return json(200, { limit: n });
  }
  if (act === 'ownerMember') {
    if (!me || !me.owner) return json(403, { error: 'Owner only.' });
    const em = auth.normEmail(b.email);
    const u = await auth.getUser(em);
    if (!u) return json(404, { error: 'No account with that email.' });
    if (typeof b.revoked === 'boolean') {
      if (b.revoked && (u.owner || em === me.email)) return json(400, { error: 'You cannot turn off the owner account.' });
      u.revoked = b.revoked; u.revokedAt = b.revoked ? new Date().toISOString() : undefined;
      if (b.revoked) u.pwChanged = Date.now(); // ends any sign-in that is already open
    }
    if (b.paidThrough !== undefined) {
      const pt = String(b.paidThrough || '');
      if (pt && !/^\d{4}-\d{2}-\d{2}$/.test(pt)) return json(400, { error: 'Date must look like 2026-12-31.' });
      u.paidThrough = pt;
    }
    if (b.note !== undefined) u.note = String(b.note || '').slice(0, 200);
    await auth.saveUser(u);
    return json(200, { ok: true });
  }
  if (act === 'saveStripe' || act === 'removeStripe' || act === 'ensurePlan') {
    if (!me || !me.owner) return json(403, { error: 'Owner only.' });
    if (act === 'removeStripe') { await S.eraseConfig(); return json(200, { ok: true, message: 'Stripe keys removed. Online payment is off.' }); }
    if (act === 'ensurePlan') {
      const c = await S.getConfig(); if (!c) return json(400, { error: 'Save your Stripe key first.' });
      try { const r = await S.ensurePlan(S.client(c)); return json(200, { ok: true, message: 'The $5.50/week plan is ready (' + c.mode + ' mode). Customer portal: ' + r.portal + '.' }); }
      catch (e) { return json(502, { error: 'Stripe refused: ' + String((e && e.message) || e).slice(0, 200) }); }
    }
    const secretKey = String(b.secretKey || '').trim(), webhookSecret = String(b.webhookSecret || '').trim();
    const old = (await S.getConfig()) || {};
    if (secretKey && !/^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/.test(secretKey)) return json(400, { error: 'That does not look like a Stripe key. It starts with rk_test_, rk_live_, sk_test_ or sk_live_.' });
    if (webhookSecret && !/^whsec_[A-Za-z0-9]{16,}$/.test(webhookSecret)) return json(400, { error: 'The webhook signing secret starts with whsec_.' });
    const next = { secretKey: secretKey || old.secretKey || '', webhookSecret: webhookSecret || old.webhookSecret || '' };
    if (!next.secretKey) return json(400, { error: 'Paste your Stripe key.' });
    if (secretKey) {
      try { await S.client({ secretKey }).prices.list({ limit: 1 }); }
      catch (e) { return json(400, { error: 'Stripe did not accept that key (' + String((e && e.message) || e).slice(0, 120) + '). A restricted key needs read access to Prices.' }); }
    }
    await S.saveConfig(next);
    return json(200, { ok: true, message: 'Saved.' });
  }
  if (act === 'claimOwner') {
    if (!me) return json(401, { error: 'Please sign in first.' });
    const ipc = ((event.headers || {})['x-nf-client-connection-ip'] || (event.headers || {})['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const nowc = Date.now(), recc = (tries.get('c' + ipc) || []).filter(t => nowc - t < 600000);
    if (recc.length >= 6) return json(429, { error: 'Too many tries. Please wait 10 minutes.' });
    recc.push(nowc); tries.set('c' + ipc, recc);
    if (!auth.codeOk(b.code)) return json(400, { error: 'That setup code is not right.' });
    me.owner = true; await auth.saveUser(me);
    return json(200, { ok: true });
  }
  if (act === 'ownerSetPassword') {
    if (!me || !me.owner) return json(403, { error: 'Owner only.' });
    const em = auth.normEmail(b.email);
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const temp = Array.from(crypto.randomBytes(12), x => chars[x % chars.length]).join('');
    const u = await auth.setPassword(em, temp);
    if (!u) return json(404, { error: 'No account with that email.' });
    await auth.clearResetRequest(em);
    return json(200, { email: em, temp });
  }
  if (act === 'logout') return json(200, { ok: true }, auth.clearCookie());

  if (act === 'pfSave' || act === 'pfDelete') {
    if (!me) return json(401, { error: 'Please sign in first.' });
    me.portfolio = me.portfolio || [];
    if (act === 'pfDelete') me.portfolio = me.portfolio.filter(x => x.id !== String(b.id || ''));
    else {
      const h = cleanHolding(b.holding);
      if (typeof h === 'string') return json(400, { error: h });
      const i = me.portfolio.findIndex(x => x.id === h.id);
      if (i >= 0) me.portfolio[i] = h; else { if (me.portfolio.length >= 200) return json(400, { error: 'You can track up to 200 liens.' }); me.portfolio.push(h); }
    }
    await auth.saveUser(me);
    return json(200, { portfolio: me.portfolio });
  }

  if (act === 'save' || act === 'unsave') {
    if (!me) return json(401, { error: 'Please sign in first.' });
    const parcel = String(b.parcel || '').slice(0, 40);
    if (!/^[0-9A-Za-z-]{6,40}$/.test(parcel)) return json(400, { error: 'Bad parcel.' });
    me.saved = (me.saved || []).filter(x => x.parcel !== parcel);
    if (act === 'save') {
      if (me.saved.length >= 100) return json(400, { error: 'You can save up to 100 liens.' });
      const n = (v, max) => (typeof v === 'number' && isFinite(v) ? v : null);
      me.saved.unshift({ parcel, county: String(b.county || '').slice(0, 40), use: String(b.use || '').slice(0, 60), face: n(b.face), market: n(b.market), acres: n(b.acres), savedAt: new Date().toISOString() });
    }
    await auth.saveUser(me);
    return json(200, { saved: me.saved });
  }

  if (act === 'forgot' || act === 'reset') {
    const ip0 = ((event.headers || {})['x-nf-client-connection-ip'] || (event.headers || {})['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const now0 = Date.now(), rec0 = (tries.get('r' + ip0) || []).filter(t => now0 - t < 600000);
    if (rec0.length >= 6) return json(429, { error: 'Too many tries. Please wait 10 minutes.' });
    rec0.push(now0); tries.set('r' + ip0, rec0);
    const em = auth.normEmail(b.email);
    if (!auth.validEmail(em)) return json(400, { error: 'Enter a valid email.' });
    if (act === 'forgot') {
      const exists = await auth.getUser(em);
      if (exists) {
        const tok = await auth.makeResetToken(em);
        const base = process.env.SITE_URL || 'https://pricepocketasset.com';
        const sent = await auth.sendMail(em, 'Reset your PricePocketAsset password', 'Someone asked to reset the password for this email on PricePocketAsset.\n\nOpen this link within 1 hour to choose a new password:\n' + base + '/reset/?email=' + encodeURIComponent(em) + '&token=' + tok + '\n\nIf you did not ask for this, you can ignore this email. Your password has not changed.');
        if (!sent) await auth.addResetRequest(em);
        return json(200, { ok: true, mail: !!process.env.RESEND_API_KEY });
      }
      return json(200, { ok: true, mail: !!process.env.RESEND_API_KEY });
    }
    const pw2 = String(b.password || '');
    if (pw2.length < 8 || pw2.length > 200) return json(400, { error: 'Password must be 8 to 200 characters.' });
    if (!(await auth.useResetToken(em, b.token, pw2))) return json(400, { error: 'This reset link is wrong or has expired. Ask for a new one.' });
    return json(200, { user: pub(await auth.getUser(em)) }, await auth.sessionCookie(em));
  }
  if (act !== 'login' && act !== 'signup') return json(400, { error: 'Bad request.' });
  const ip = ((event.headers || {})['x-nf-client-connection-ip'] || (event.headers || {})['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now(), recent = (tries.get(ip) || []).filter(t => now - t < 600000);
  if (recent.length >= 8) return json(429, { error: 'Too many tries. Please wait 10 minutes.' });
  recent.push(now); tries.set(ip, recent);

  const email = auth.normEmail(b.email), pw = String(b.password || '');
  if (!auth.validEmail(email)) return json(400, { error: 'Enter a valid email.' });
  if (act === 'signup') {
    if (pw.length < 8) return json(400, { error: 'Password must be at least 8 characters.' });
    if (pw.length > 200) return json(400, { error: 'Password is too long.' });
    const owner = !!String(b.ownerCode || '').trim() && auth.codeOk(b.ownerCode);
    if (String(b.ownerCode || '').trim() && !owner) return json(400, { error: 'That owner code is not right. Leave it empty if you are not the owner.' });
    const u = await auth.createUser(email, pw, owner);
    if (!u) return json(409, { error: 'That email already has an account. Please sign in.' });
    return json(200, { user: pub(u) }, await auth.sessionCookie(email));
  }
  const u = await auth.checkLogin(email, pw);
  if (u === 'revoked') return json(403, { error: 'This account has been turned off. Contact the site owner.' });
  if (!u) return json(401, { error: 'Wrong email or password.' });
  u.lastLogin = new Date().toISOString(); await auth.saveUser(u);
  return json(200, { user: pub(u) }, await auth.sessionCookie(email));
}

async function toEvent(req, context) {
  return { httpMethod: req.method, query: Object.fromEntries(new URL(req.url).searchParams), body: req.method === 'POST' ? await req.text() : null,
    headers: { cookie: req.headers.get('cookie') || '', 'x-nf-client-connection-ip': req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || '', 'x-forwarded-for': req.headers.get('x-forwarded-for') || '' } };
}
export default async (req, context) => {
  const r = await handle(await toEvent(req, context));
  const h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (r.cookie) h.append('Set-Cookie', r.cookie);
  return new Response(r.body, { status: r.statusCode, headers: h });
};
export { handle as _handle };
