// "Ask the County" (paid members): drafts a short request email to the right county office with our NVIDIA model, then either
// sends it from the member's own Gmail (send-only OAuth, sender must equal their signup email) or, when there is no verified
// county email / the county uses a request portal, gives the official link to paste it into.
//   GET  ?act=status                 -> { paid, gmail: {connected, email}, history:[...] }
//   GET  ?act=oauth                  -> 302 to Google consent (scope: gmail.send + email)
//   GET  ?act=callback&code&state    -> stores the refresh token server-side, 302 back to /account/ask-county/
//   POST {act:'draft', state, county, parcel, kind, question}        -> { to, subject, body, mode, link, officeName }
//   POST {act:'send', requestId, state, county, parcel, kind, subject, body}  -> { ok, sentAt } (idempotent per requestId)
//   POST {act:'disconnect'}
// Tokens and client secrets never leave the backend. Replies go straight to the member: the email is From (and Reply-To) their address.
import crypto from 'node:crypto';
import * as auth from '../lib/auth.mjs';
import * as keystore from '../lib/keystore.mjs';
import { complete } from '../lib/llm.mjs';
import { lookup, KINDS } from '../lib/county-contacts.mjs';

const SITE = () => process.env.SITE_URL || 'https://pricepocketasset.com';
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const GMAIL_SEND = process.env.GMAIL_SEND_URL || 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const SCOPE = 'openid email https://www.googleapis.com/auth/gmail.send';
const json = (code, body, extra) => new Response(JSON.stringify(body), { status: code, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extra || {}) });
const redirect = (url, cookie) => { const h = new Headers({ Location: url, 'Cache-Control': 'no-store' }); if (cookie) h.append('Set-Cookie', cookie); return new Response(null, { status: 302, headers: h }); };
const hits = new Map(), inflight = new Set();   // inflight: same-instance double taps; the stored lock covers retries
const limited = (k, n, ms) => { const now = Date.now(), r = (hits.get(k) || []).filter(t => now - t < ms); if (r.length >= n) return true; r.push(now); hits.set(k, r); return false; };
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const oneLine = (s, n) => clean(s, n).replace(/[\r\n]+/g, ' ');

export async function googleConfig() {
  const saved = (await auth.kvGet('google-oauth')) || {};
  const id = process.env.GOOGLE_CLIENT_ID || saved.clientId || '', secret = process.env.GOOGLE_CLIENT_SECRET || saved.clientSecret || '';
  return id && secret ? { id, secret, redirect: SITE() + '/.netlify/functions/askcounty?act=callback' } : null;
}
const tokKey = email => 'gmail_' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
const histKey = email => 'askc_' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
async function history(email) { return ((await auth.kvGet(histKey(email))) || { list: [] }).list; }

const SYS = `You write short, polite, professional public-records request emails from a member of the public to a US county office.
Rules: 4 to 8 sentences. Plain text only, no markdown, no placeholders in brackets, no legal threats, no invented facts, statutes or deadlines.
Do not sign with a name; end with "Thank you," on its own line. Return JSON only: {"subject": "...", "body": "..."}.`;
function brief(kind, c, parcel, question) {
  const where = c.county + ' County, ' + c.state;
  const asks = {
    liens: 'Ask for the latest public list of county-held tax certificates / tax liens available for purchase in ' + where + ', in CSV or Excel if available, and the date the list was last updated.',
    taxdeed: 'Ask for the latest public list of upcoming tax deed sales in ' + where + ' (sale dates, parcel IDs, certificate numbers and opening bids), in CSV or Excel if available, and the date the list was last updated.',
    laft: 'Ask for the latest public "Lands Available for Taxes" / lands available for purchase list in ' + where + ', in CSV or Excel if available, the date it was last updated, and how to buy from it.',
    status: 'Ask for the current tax status of parcel ' + (parcel || '(parcel not given)') + ' in ' + where + ': whether taxes are delinquent, whether a certificate or tax deed application exists, and whether it is scheduled for a sale.',
    custom: 'The member\'s question for ' + where + ' (rewrite it politely, keep its meaning, do not add new requests): ' + question,
  };
  return asks[kind] + (parcel && kind !== 'status' ? ' Mention parcel ' + parcel + ' as the property it relates to.' : '') + ' Addressed to: ' + c.officeName + '.';
}
function fallbackDraft(kind, c, parcel, question) {
  const subj = { liens: 'Request: latest county-held tax lien list', taxdeed: 'Request: upcoming tax deed sale list', laft: 'Request: lands available for taxes list', status: 'Parcel status request' + (parcel ? ': ' + parcel : ''), custom: 'Question about ' + c.county + ' County property taxes' }[kind];
  const list = 'Could you please send the most recent public list, in CSV or Excel format if available, along with the date it was last updated?';
  const body = { liens: 'Hello,\n\nI am researching county-held tax certificates in ' + c.county + ' County. ' + list,
    taxdeed: 'Hello,\n\nI am interested in upcoming tax deed sales in ' + c.county + ' County. ' + list,
    laft: 'Hello,\n\nI am interested in properties on the Lands Available for Taxes list in ' + c.county + ' County. ' + list + ' I would also appreciate any instructions on how to purchase from the list.',
    status: 'Hello,\n\nCould you please tell me the current tax status of parcel ' + parcel + ' in ' + c.county + ' County, including whether taxes are delinquent and whether it is scheduled for a tax sale?',
    custom: 'Hello,\n\n' + question }[kind];
  return { subject: subj, body: body + '\n\nThank you,' };
}

async function draft(me, b) {
  const kind = KINDS[b.kind] ? b.kind : null; if (!kind) return json(400, { error: 'Pick what you want to ask for.' });
  const st = oneLine(b.state || 'FL', 2).toUpperCase(), county = oneLine(b.county, 60), parcel = oneLine(b.parcel, 60), question = clean(b.question, 800);
  if (!county) return json(400, { error: 'Pick a county.' });
  if ((kind === 'status') && !parcel) return json(400, { error: 'Add the parcel ID.' });
  if (kind === 'custom' && question.length < 8) return json(400, { error: 'Type your question.' });
  const c = lookup(st, county, kind);
  let out = null;
  const cfg = await keystore.getConfig();
  if (cfg) {
    try {
      const r = await complete(cfg, SYS, brief(kind, c, parcel, question), { maxTokens: 450 });
      const m = String(r.text || '').match(/\{[\s\S]*\}/); const j = m ? JSON.parse(m[0]) : null;
      if (j && j.subject && j.body) out = { subject: oneLine(j.subject, 150), body: clean(j.body, 3000) };
    } catch (e) { /* fall back to the template below */ }
  }
  const usedAi = !!out; if (!out) out = fallbackDraft(kind, c, parcel, question);
  if (!/thank you/i.test(out.body.slice(-40))) out.body += '\n\nThank you,';
  out.body += '\n' + me.email;
  return json(200, { ...out, to: c.email, mode: c.mode, link: c.link, linkTitle: c.linkTitle, officeName: c.officeName, verifiedSource: c.verifiedSource, checked: c.checked, ai: usedAi, kindLabel: KINDS[kind] });
}

function rfc2822(from, to, subject, body) {
  const enc = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s).toString('base64') + '?=';
  return ['From: ' + from, 'To: ' + to, 'Reply-To: ' + from, 'Subject: ' + enc(subject), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(body).toString('base64').replace(/.{76}/g, '$&\r\n')].join('\r\n');
}
async function accessToken(g, tok) {
  const r = await fetch(GOOGLE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: g.id, client_secret: g.secret, refresh_token: tok.refresh, grant_type: 'refresh_token' }).toString() });
  if (!r.ok) return null; const d = await r.json(); return d.access_token || null;
}

async function send(me, b) {
  const requestId = oneLine(b.requestId, 64); if (!/^[A-Za-z0-9-]{8,64}$/.test(requestId)) return json(400, { error: 'Bad request.' });
  const lockKey = 'askc_lock_' + crypto.createHash('sha256').update(me.email + '|' + requestId).digest('hex').slice(0, 40);
  if (inflight.has(lockKey)) return json(200, { error: 'This request is already being sent.', duplicate: true });
  inflight.add(lockKey);
  try { return await sendLocked(me, b, requestId, lockKey); } finally { inflight.delete(lockKey); }
}
async function sendLocked(me, b, requestId, lockKey) {
  const prior = await auth.kvGet(lockKey);
  if (prior && prior.state === 'sending' && Date.now() - Date.parse(prior.at) > 120e3) { /* a crashed attempt: allow a retry */ } else if (prior) return json(200, prior.state === 'sent' ? { ok: true, duplicate: true, sentAt: prior.at } : { error: 'This request is already being sent.', duplicate: true });
  await auth.kvPut(lockKey, { state: 'sending', at: new Date().toISOString() });
  const release = async () => auth.kvPut(lockKey, null);
  const kind = KINDS[b.kind] ? b.kind : 'custom';
  const st = oneLine(b.state || 'FL', 2).toUpperCase(), county = oneLine(b.county, 60), parcel = oneLine(b.parcel, 60);
  const c = lookup(st, county, kind);
  if (c.mode !== 'email' || !c.email) { await release(); return json(400, { error: 'This county has no verified email. Use the official link and Copy Message.' }); }
  const subject = oneLine(b.subject, 150), body = clean(b.body, 4000);
  if (subject.length < 3 || body.length < 20) { await release(); return json(400, { error: 'Subject and message are required.' }); }
  const g = await googleConfig(); const tok = await auth.kvGet(tokKey(me.email));
  if (!g || !tok || !tok.refresh) { await release(); return json(400, { error: 'Connect your Gmail first.', needGmail: true }); }
  if (auth.normEmail(tok.email) !== auth.normEmail(me.email)) { await release(); return json(403, { error: 'Your connected Gmail must match your signup email.' }); }
  const at = await accessToken(g, tok); if (!at) { await release(); return json(502, { error: 'Gmail did not accept the connection. Please reconnect Gmail.', needGmail: true }); }
  const raw = Buffer.from(rfc2822(me.email, c.email, subject, body)).toString('base64url');
  const r = await fetch(GMAIL_SEND, { method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) });
  if (!r.ok) { await release(); return json(502, { error: 'Gmail could not send it (' + r.status + '). Nothing was sent.' }); }
  const sentAt = new Date().toISOString();
  await auth.kvPut(lockKey, { state: 'sent', at: sentAt });
  const h = (await auth.kvGet(histKey(me.email))) || { list: [] };
  h.list.unshift({ id: requestId, at: sentAt, state: st, county, parcel, kind: KINDS[kind], to: c.email, office: c.officeName, subject, via: 'gmail' }); h.list = h.list.slice(0, 100);
  await auth.kvPut(histKey(me.email), h);
  return json(200, { ok: true, sentAt });
}

async function logCopy(me, b) {    // member used the official link + Copy Message: keep it in their history too
  const requestId = oneLine(b.requestId, 64); if (!/^[A-Za-z0-9-]{8,64}$/.test(requestId)) return json(400, { error: 'Bad request.' });
  const h = (await auth.kvGet(histKey(me.email))) || { list: [] };
  if (!h.list.some(x => x.id === requestId)) {
    h.list.unshift({ id: requestId, at: new Date().toISOString(), state: oneLine(b.state, 2), county: oneLine(b.county, 60), parcel: oneLine(b.parcel, 60), kind: KINDS[b.kind] || 'Custom Question', to: '', office: oneLine(b.office, 120), subject: oneLine(b.subject, 150), via: 'copied', link: oneLine(b.link, 300) });
    h.list = h.list.slice(0, 100); await auth.kvPut(histKey(me.email), h);
  }
  return json(200, { ok: true });
}

export async function handle(req) {
  const url = new URL(req.url), act = url.searchParams.get('act') || '';
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  const ip = req.headers.get('x-nf-client-connection-ip') || 'x';
  if (req.method === 'GET' && act === 'callback') {
    const back = SITE() + '/account/ask-county/';
    const st = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
    const cookieState = ((req.headers.get('cookie') || '').match(/(?:^|;\s*)ppa_g=([^;]+)/) || [])[1] || '';
    if (!me || !st || st !== cookieState || !code) return redirect(back + '?gmail=failed', 'ppa_g=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    const g = await googleConfig(); if (!g) return redirect(back + '?gmail=off');
    const r = await fetch(GOOGLE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: g.id, client_secret: g.secret, redirect_uri: g.redirect, grant_type: 'authorization_code' }).toString() });
    const d = r.ok ? await r.json() : {};
    let email = ''; try { email = auth.normEmail(JSON.parse(Buffer.from(String(d.id_token || '').split('.')[1] || '', 'base64url').toString()).email); } catch (e) {}
    const clear = 'ppa_g=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
    if (!d.refresh_token || !email) return redirect(back + '?gmail=failed', clear);
    if (!String(d.scope || '').includes('gmail.send')) return redirect(back + '?gmail=noscope', clear);
    if (email !== auth.normEmail(me.email)) {      // never keep a token for a different address
      try { await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(d.refresh_token), { method: 'POST' }); } catch (e) {}
      return redirect(back + '?gmail=mismatch', clear);
    }
    await auth.kvPut(tokKey(me.email), { refresh: d.refresh_token, email, at: new Date().toISOString() });
    return redirect(back + '?gmail=connected', clear);
  }
  if (!me) return json(401, { error: 'Please sign in.' });
  const paid = auth.isPaid(me);
  if (req.method === 'GET' && act === 'status') {
    const tok = await auth.kvGet(tokKey(me.email)), g = await googleConfig();
    return json(200, { paid, email: me.email, gmail: { available: !!g, connected: !!(tok && tok.refresh), email: tok ? tok.email : '' }, kinds: KINDS, history: paid ? await history(me.email) : [] });
  }
  if (!paid) return json(402, { error: 'Ask the County is for Pro members.', needPaid: true });
  if (req.method === 'GET' && act === 'oauth') {
    const g = await googleConfig(); if (!g) return json(503, { error: 'Gmail sending is not set up yet.' });
    const st = crypto.randomBytes(16).toString('hex');
    const u = GOOGLE_AUTH + '?' + new URLSearchParams({ client_id: g.id, redirect_uri: g.redirect, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false', login_hint: me.email, state: st });
    return redirect(u, 'ppa_g=' + st + '; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax');
  }
  if (req.method !== 'POST') return json(405, { error: 'Bad request.' });
  let b; try { b = await req.json(); } catch (e) { return json(400, { error: 'Bad request.' }); }
  if (b.act === 'draft') { if (limited('d' + me.email, 20, 3600e3) || limited('di' + ip, 40, 3600e3)) return json(429, { error: 'Too many drafts. Try again later.' }); return draft(me, b); }
  if (b.act === 'send') { if (limited('s' + me.email, 10, 3600e3)) return json(429, { error: 'Too many sends. Try again later.' }); return send(me, b); }
  if (b.act === 'copied') return logCopy(me, b);
  if (b.act === 'disconnect') {
    const tok = await auth.kvGet(tokKey(me.email));
    if (tok && tok.refresh) { try { await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(tok.refresh), { method: 'POST' }); } catch (e) {} }
    await auth.kvPut(tokKey(me.email), null); return json(200, { ok: true });
  }
  return json(400, { error: 'Bad request.' });
}
export default async req => { try { return await handle(req); } catch (e) { return json(500, { error: 'Something went wrong. Nothing was sent.' }); } };
