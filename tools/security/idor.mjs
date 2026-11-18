import { ID, call, auth } from './harness.mjs';
let bad = 0; const t = (n, ok, info) => { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? ' :: ' + info : '')); };
const post = (cookie, body) => call('account', { method: 'POST', body, cookie });
const J = r => { try { return JSON.parse(r.text); } catch (e) { return {}; } };
// A (pro) stores portfolio, favorites, research; B (other) must not see or change them
const a = await post(ID.pro, { action: 'pfSave', holding: { state: 'FL', county: 'Palm Beach', parcel: 'A-1', paid: 1000, rate: 8, bought: '2026-06-02', status: 'open', notes: 'A private note' } });
const aId = J(a).portfolio[0].id;
await post(ID.pro, { action: 'save', lien: { county: 'Palm Beach', parcel: 'A-FAV', state: 'FL' } });
await post(ID.pro, { action: 'resSave', key: 'FL|Palm Beach|A-1|1', notes: 'A secret research', marks: {} });
const meB = J(await call('account', { cookie: ID.other }));
t('B session does not contain A portfolio', !JSON.stringify(meB).includes('A private note') && !JSON.stringify(meB).includes('A-FAV'));
const del = await post(ID.other, { action: 'pfDelete', id: aId });
const stillA = J(await call('account', { cookie: ID.pro })).user.portfolio || [];
t('B cannot delete A portfolio entry by guessing its id', stillA.some(x => x.id === aId), 'A still has ' + stillA.length);
const ov = await post(ID.other, { action: 'pfSave', holding: { id: aId, state: 'FL', paid: 1, rate: 1, bought: '2026-01-01', status: 'open', notes: 'hacked' } });
const stillA2 = J(await call('account', { cookie: ID.pro })).user.portfolio || [];
t('B cannot overwrite A entry by reusing its id (B gets a new entry instead)', stillA2.find(x => x.id === aId) && stillA2.find(x => x.id === aId).notes === 'A private note');
const rg = J(await post(ID.other, { action: 'resGet', key: 'FL|Palm Beach|A-1|1' }));
t('B cannot read A research notes with the same key', !JSON.stringify(rg).includes('A secret research'), JSON.stringify(rg).slice(0, 100));
// leaks in account responses
const me = (await call('account', { cookie: ID.pro })).text;
t('account response has no password hash, salt, reset token, Stripe ids or session data', !/"hash"|"salt"|"reset"|stripeCustomerId|"idv"|sk_(live|test)/.test(me), me.slice(0, 160));
// enumeration + reset flow
const f1 = await post('', { action: 'forgot', email: 'free@test.invalid' }), f2 = await post('', { action: 'forgot', email: 'nobody@test.invalid' });
t('forgot password gives the same answer for real and unknown emails', f1.status === f2.status && f1.text === f2.text, f1.text + ' / ' + f2.text);
// reset token handling
const tok = await auth.makeResetToken('free@test.invalid');
const bad1 = await post('', { action: 'reset', email: 'free@test.invalid', token: 'wrong', password: 'new password 1' });
t('reset with a wrong token fails', bad1.status === 400);
const oldCookie = ID.free; const good = await post('', { action: 'reset', email: 'free@test.invalid', token: tok, password: 'new password 1' });
t('reset with the right token works', good.status === 200);
const again = await post('', { action: 'reset', email: 'free@test.invalid', token: tok, password: 'another password' });
t('reset token cannot be used twice', again.status === 400);
const oldStill = J(await call('account', { cookie: oldCookie }));
t('old sessions stop working after a password reset', !oldStill.user, JSON.stringify(oldStill).slice(0, 60));
// revoked user
const rv = J(await call('account', { cookie: ID.revoked }));
t('a turned-off account is signed out', !rv.user);
// brute-force limit on login
let codes = []; for (let i = 0; i < 12; i++) codes.push((await post('', { action: 'login', email: 'pro@test.invalid', password: 'wrong' + i })).status);
t('login is rate limited after repeated wrong passwords', codes.includes(429), codes.join(','));
console.log(bad ? bad + ' FAILED' : 'all passed');
