// Land for sale by owner. Members who passed an ID check post their own land; anyone can browse;
// paid members contact a seller through a form (the seller's email is never shown). We are not a broker:
// no sale, offer or payment happens on this site.
import * as auth from '../lib/auth.mjs';
import * as S from '../lib/stripe.mjs';
import crypto from 'node:crypto';

const json = (code, body, extra) => new Response(JSON.stringify(body), { status: code, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extra || {}) });
const MAX_PHOTOS = 6, MAX_PHOTO_B64 = 700000, MAX_LISTINGS = 10;
const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const hits = new Map();
function limited(key, n, ms) { const now = Date.now(), r = (hits.get(key) || []).filter(t => now - t < ms); if (r.length >= n) return true; r.push(now); hits.set(key, r); return false; }
const newId = () => crypto.randomBytes(6).toString('hex');
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

async function getIndex() { return ((await auth.kvGet('listings-index')) || { list: [] }).list; }
async function putIndex(list) { await auth.kvPut('listings-index', { list }); }
const summary = l => ({ id: l.id, title: l.title, state: l.state, county: l.county, city: l.city, price: l.price, acres: l.acres, lat: l.lat, lng: l.lng, photo: (l.photos || [])[0] || '', created: l.created, status: l.status, owner: l.owner });
const pub = (l, me) => {
  const o = { id: l.id, title: l.title, state: l.state, county: l.county, city: l.city, parcel: l.parcel, price: l.price, acres: l.acres, desc: l.desc, links: l.links || [], photos: l.photos || [], lat: l.lat, lng: l.lng, created: l.created, updated: l.updated, status: l.status, sellerVerified: true };
  if (me && (me.email === l.owner || me.owner)) { o.mine = me.email === l.owner; o.reports = (l.reports || []).length; }
  return o;
};

function validate(b) {
  const title = clean(b.title, 90), state = clean(b.state, 2).toUpperCase(), county = clean(b.county, 40).replace(/\s+county$/i, ''), city = clean(b.city, 50);
  const parcel = clean(b.parcel, 40), desc = String(b.desc == null ? '' : b.desc).replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
  const price = Math.round(Number(b.price)), acres = b.acres === '' || b.acres == null ? null : Number(b.acres);
  const lat = Number(b.lat), lng = Number(b.lng);
  if (title.length < 4) return 'Give your listing a short title.';
  if (!STATES.includes(state)) return 'Pick a state.';
  if (county.length < 2) return 'Enter the county.';
  if (!isFinite(price) || price < 1 || price > 100000000) return 'Enter an asking price in dollars.';
  if (acres !== null && (!isFinite(acres) || acres <= 0 || acres > 1000000)) return 'Acres must be a number (or leave it empty).';
  if (!isFinite(lat) || !isFinite(lng) || lat < 17 || lat > 72 || lng < -180 || lng > -60) return 'Tap the map to drop a pin on your land.';
  const links = (Array.isArray(b.links) ? b.links : []).map(x => clean(x, 300)).filter(Boolean).slice(0, 3);
  for (const x of links) { try { const u = new URL(x); if (!/^https?:$/.test(u.protocol)) return 'Links must start with https://'; } catch (e) { return 'One of the links is not a web address.'; } }
  return { title, state, county, city, parcel, desc, price, acres, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, links };
}

async function handle(req, context) {
  const u = new URL(req.url), q = u.searchParams;
  const me = await auth.userFromCookie(req.headers.get('cookie') || '');
  const ip = req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x';

  if (req.method === 'GET') {
    if (q.get('photo')) {
      const id = q.get('photo'); if (!/^[a-f0-9]{12,24}$/.test(id)) return new Response('Not found', { status: 404 });
      const p = await auth.kvGet('lphoto_' + id); if (!p || !p.data) return new Response('Not found', { status: 404 });
      return new Response(Buffer.from(p.data, 'base64'), { status: 200, headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
    }
    if (q.get('id')) {
      const l = await auth.kvGet('listing_' + clean(q.get('id'), 20));
      if (!l || (l.status !== 'active' && !(me && (me.email === l.owner || me.owner)))) return json(404, { error: 'This listing is not available.' });
      return json(200, { listing: pub(l, me) });
    }
    if (q.get('mine')) {
      if (!me) return json(401, { error: 'Sign in first.' });
      const list = (await getIndex()).filter(x => x.owner === me.email && x.status !== 'removed');
      return json(200, { listings: list.map(x => ({ ...x, owner: undefined })), idVerified: !!me.idVerified, idStatus: me.idv ? me.idv.status : '', paid: auth.isPaid(me), owner: !!me.owner });
    }
    const all = (await getIndex()).filter(x => x.status === 'active');
    const st = clean(q.get('state'), 2).toUpperCase();
    return json(200, { listings: all.filter(x => !st || x.state === st).map(x => ({ ...x, owner: undefined })), signedIn: !!me, paid: auth.isPaid(me), owner: !!(me && me.owner) });
  }
  if (req.method !== 'POST') return json(405, { error: 'Use GET or POST.' });
  let b; try { b = JSON.parse(await req.text() || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  const act = String(b.action || '');
  if (!me) return json(401, { error: 'Sign in first.' });

  // ID check with Stripe Identity (a photo ID plus a selfie). We keep only the result, never the ID images.
  if (act === 'idStart' || act === 'idCheck') {
    if (!auth.isPaid(me)) return json(403, { error: 'Selling land is for members. Become a member first.' });
    const cfg = await S.getConfig(); if (!cfg) return json(503, { error: 'Payments are not set up yet.' });
    const stripe = S.client(cfg);
    try {
      if (act === 'idCheck') {
        if (!me.idv || !me.idv.id) return json(200, { idVerified: !!me.idVerified, status: '' });
        const vs = await stripe.identity.verificationSessions.retrieve(me.idv.id);
        me.idv.status = vs.status; if (vs.status === 'verified') { me.idVerified = true; me.idVerifiedAt = new Date().toISOString(); }
        await auth.saveUser(me);
        return json(200, { idVerified: !!me.idVerified, status: vs.status, error: vs.last_error ? vs.last_error.reason || '' : '' });
      }
      if (me.idVerified) return json(200, { idVerified: true });
      if (limited('id' + me.email, 5, 86400000)) return json(429, { error: 'Too many ID checks today. Try again tomorrow.' });
      const vs = await stripe.identity.verificationSessions.create({ type: 'document', options: { document: { require_matching_selfie: true } }, metadata: { email: me.email }, return_url: S.siteUrl() + '/land/sell/?id_return=1' });
      me.idv = { id: vs.id, status: vs.status, at: new Date().toISOString() }; await auth.saveUser(me);
      return json(200, { url: vs.url });
    } catch (e) {
      return json(502, { error: 'Stripe could not start the ID check: ' + String((e && e.message) || e).slice(0, 200) + (/identity/i.test(String(e && e.message)) ? ' (Stripe Identity may need to be turned on in your Stripe dashboard.)' : '') });
    }
  }

  if (act === 'photo') {
    if (!me.idVerified && !me.owner) return json(403, { error: 'Verify your ID first.' });
    if (limited('ph' + me.email, 60, 3600000)) return json(429, { error: 'Too many photos. Please wait a bit.' });
    const data = String(b.data || '').replace(/^data:image\/jpeg;base64,/, '');
    if (!/^[A-Za-z0-9+/=]+$/.test(data) || data.length < 1000 || data.length > MAX_PHOTO_B64) return json(400, { error: 'That photo could not be used. Try another one.' });
    const buf = Buffer.from(data, 'base64'); if (buf[0] !== 0xff || buf[1] !== 0xd8) return json(400, { error: 'Photos must be JPEG.' });
    const id = crypto.randomBytes(8).toString('hex');
    await auth.kvPut('lphoto_' + id, { data, owner: me.email, at: new Date().toISOString() });
    return json(200, { id });
  }

  if (act === 'save') {
    if (!me.idVerified && !me.owner) return json(403, { error: 'Verify your ID before you list land.' });
    if (!auth.isPaid(me)) return json(403, { error: 'Selling land is for members.' });
    const v = validate(b); if (typeof v === 'string') return json(400, { error: v });
    const photos = (Array.isArray(b.photos) ? b.photos : []).filter(x => /^[a-f0-9]{16}$/.test(x)).slice(0, MAX_PHOTOS);
    for (const p of photos) { const ph = await auth.kvGet('lphoto_' + p); if (!ph || ph.owner !== me.email) return json(400, { error: 'A photo is missing. Add it again.' }); }
    const index = await getIndex();
    let l;
    if (b.id) {
      l = await auth.kvGet('listing_' + clean(b.id, 20));
      if (!l || l.owner !== me.email || l.status === 'removed') return json(404, { error: 'Listing not found.' });
    } else {
      if (index.filter(x => x.owner === me.email && x.status !== 'removed').length >= MAX_LISTINGS) return json(400, { error: 'You can have up to ' + MAX_LISTINGS + ' listings.' });
      l = { id: newId(), owner: me.email, created: new Date().toISOString(), status: 'active', reports: [] };
    }
    Object.assign(l, v, { photos, updated: new Date().toISOString() });
    await auth.kvPut('listing_' + l.id, l);
    const i = index.findIndex(x => x.id === l.id); if (i >= 0) index[i] = summary(l); else index.push(summary(l));
    await putIndex(index);
    return json(200, { ok: true, id: l.id });
  }

  if (act === 'status') { // seller: hide/show/delete own listing; site owner: hide or remove any
    const l = await auth.kvGet('listing_' + clean(b.id, 20)); if (!l) return json(404, { error: 'Listing not found.' });
    if (l.owner !== me.email && !me.owner) return json(403, { error: 'Not your listing.' });
    const st = String(b.status); if (!['active', 'hidden', 'removed'].includes(st)) return json(400, { error: 'Bad status.' });
    if (st === 'active' && l.owner !== me.email) return json(403, { error: 'Only the seller can show it again.' });
    l.status = st; l.updated = new Date().toISOString(); await auth.kvPut('listing_' + l.id, l);
    const index = await getIndex(); const i = index.findIndex(x => x.id === l.id); if (i >= 0) index[i] = summary(l); await putIndex(index);
    return json(200, { ok: true });
  }

  if (act === 'report') {
    if (limited('rp' + me.email, 10, 86400000)) return json(429, { error: 'Too many reports today.' });
    const l = await auth.kvGet('listing_' + clean(b.id, 20)); if (!l || l.status !== 'active') return json(404, { error: 'Listing not found.' });
    l.reports = (l.reports || []).filter(r => r.by !== me.email).concat({ by: me.email, why: clean(b.why, 300), at: new Date().toISOString() });
    await auth.kvPut('listing_' + l.id, l);
    return json(200, { ok: true });
  }

  if (act === 'contact') {
    if (!auth.isPaid(me)) return json(403, { error: 'Contacting sellers is for members.' });
    if (limited('ct' + me.email, 15, 86400000)) return json(429, { error: 'You have sent a lot of messages today. Try again tomorrow.' });
    const l = await auth.kvGet('listing_' + clean(b.id, 20)); if (!l || l.status !== 'active') return json(404, { error: 'This listing is not available.' });
    if (l.owner === me.email) return json(400, { error: 'This is your own listing.' });
    const msg = String(b.message == null ? '' : b.message).replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, 1500); if (msg.length < 10) return json(400, { error: 'Write a short message (at least 10 characters).' });
    const r = await auth.sendMail(l.owner, 'Someone is interested in your land: ' + l.title,
      'A PricePocketAsset member sent you a message about your listing "' + l.title + '" (' + l.county + ' County, ' + l.state + ').\n\n' +
      'Their message:\n' + msg + '\n\nTheir email: ' + me.email + '\nReply to this email to answer them directly.\n\n' +
      'PricePocketAsset is not a broker and is not part of any deal. Never send money before you have checked who you are dealing with.\n' +
      'Your listing: ' + S.siteUrl() + '/land/?id=' + l.id, me.email);
    if (!r.ok) return json(502, { error: 'The message could not be sent right now. Try again later.' });
    return json(200, { ok: true });
  }
  return json(400, { error: 'Bad request.' });
}
export default async (req, context) => handle(req, context);
