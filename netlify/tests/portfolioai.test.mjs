import { wantsPortfolio, answer } from '../lib/portfolioai.mjs'; import assert from 'node:assert/strict';
const P = [
 { id: 'a1', state: 'FL', county: 'Leon', parcel: '1', paid: 1000, rate: 18, bought: '2026-06-01', months: 24, status: 'open', countyDeadline: '2026-12-20', extra: 50 },
 { id: 'a2', state: 'FL', county: 'Palm Beach', paid: 500, rate: 5, bought: '2026-01-01', months: 12, status: 'open' },
 { id: 'a3', state: 'AZ', county: 'Pinal', paid: 2000, rate: 16, bought: '2025-01-01', months: 36, status: 'redeemed' },
 { id: 'a4', state: 'CO', paid: 300, status: 'open' } ];
assert(wantsPortfolio('Which of my certificates have upcoming deadlines?')); assert(!wantsPortfolio('cheapest liens in Colorado'));
let r = answer('Which of my certificates have upcoming deadlines?', P, '2026-11-18');
assert.equal(r.rows.length, 2); assert.equal(r.rows[0].days, 32); assert(/deadline you entered/.test(r.text)); assert(/no deadline or redemption/.test(r.text));
r = answer('How much have I invested across Florida?', P, '2026-11-18'); assert(/\$1,550/.test(r.text));
r = answer('Compare my estimated returns by county', P, '2026-11-18'); assert.equal(r.rows.length, 2); assert(/estimate, not a prediction/.test(r.text)); assert.equal(Math.round(r.rows[0].estInterest), 360);
r = answer('Which of my properties need more research?', P, '2026-11-18'); assert(r.rows.find(x => x.id === 'a4').missing.includes('parcel number'));
assert(/empty/.test(answer('my portfolio', [], '2026-11-18').text));
assert(!JSON.stringify(answer('invested', [], '2026-11-18')).includes('a1'));
console.log('portfolioai ok');
