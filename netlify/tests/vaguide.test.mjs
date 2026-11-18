// Run: node netlify/tests/vaguide.test.mjs  (static checks on the Virginia guide page)
import fs from 'node:fs'; import assert from 'node:assert/strict';
const h = fs.readFileSync(new URL('../../kinvest-liens/liens/virginia/index.html', import.meta.url), 'utf8'); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok -', m); };
const secs = [...h.matchAll(/law\.lis\.virginia\.gov\/vacode\/(58\.1-[\d.]+)\//g)].map(m => m[1]);
for (const s of ['58.1-3965', '58.1-3967', '58.1-3969', '58.1-3970', '58.1-3970.1', '58.1-3971']) ok(secs.includes(s), 'cites section ' + s + ' with an official link');
ok(/not<\/b> covered|did not read/i.test(h) && /Virginia Beach/.test(h), 'says what was not read (local rules, rates)');
ok(/Educational only/.test(h) && /not legal advice/i.test(h), 'carries the not-legal-advice notice');
const text = h.replace(/<[^>]+>/g, ' ');
ok(!/guarantee|risk-free|can't lose|great deal|will earn|\bprofit\b/i.test(text), 'no promises or deal language');
ok(/December 31 following the second anniversary/.test(text) && /72 months/.test(text) && /before the sale date/.test(text) && /two years/.test(text), 'key statute points present (2-year clock, 72-month plan, redeem before sale, 2-year surplus claim)');
ok(/<a class="btn" href="\/liens\/delinquent\/"/.test(h), 'links to the records page');
ok(/virginia\//.test(fs.readFileSync(new URL('../../kinvest-liens/liens/delinquent/index.html', import.meta.url), 'utf8')), 'the records page links to the guide');
console.log(n + ' checks passed');
