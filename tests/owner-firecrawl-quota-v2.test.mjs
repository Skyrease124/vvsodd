import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {periodKeys,successKey,attemptKey,quotaDecision,recordAttempt,recordSuccess,sourceCooldown} from '../netlify/lib/owner-firecrawl-quota.mjs';

const now=new Date('2026-11-20T23:25:00.000Z');
const day='2026-11-20';
test('old v1 failed-request counters cannot poison successful-scan quota',()=>{
 assert.equal(successKey('2026-11'),'owner-intel-firecrawl-success-v2-2026-11');
 assert.equal(attemptKey(day),'owner-intel-firecrawl-attempt-v2-'+day);
 assert.equal(periodKeys(now).day,day);
 assert.deepEqual(quotaDecision(null,null,now),{allowed:true});
});
test('failed Firecrawl request increments retry tracker without taking successful quota',()=>{
 const attempted=recordAttempt(null,now);
 assert.equal(attempted.count,1);
 const later=new Date(now.getTime()+61_000);
 assert.deepEqual(quotaDecision(null,attempted,later),{allowed:true});
 const successful=recordSuccess(null,later);
 assert.equal(successful.total,1);
 assert.equal(successful.days[day],1);
});
test('successful scan quota still prevents overspend, retries throttle abuse',()=>{
 const tooManySuccesses={total:25,days:{[day]:1}};
 assert.match(quotaDecision(tooManySuccesses,null,now).reason,/quota reached/);
 assert.match(quotaDecision({total:3,days:{[day]:3}},null,now).reason,/quota reached/);
 assert.match(quotaDecision(null,{count:8},now).reason,/retry safety/);
 assert.match(quotaDecision(null,{count:1,lastAttemptAt:now.toISOString()},new Date(now.getTime()+1000)).reason,/one minute/);
});
test('successful scan source cooldown only applies to same provider',()=>{
 const prev={provider:'official',checkedAt:now.toISOString()};
 assert.equal(sourceCooldown(prev,'official',new Date(now.getTime()+1000)),true);
 assert.equal(sourceCooldown(prev,'firecrawl',new Date(now.getTime()+1000)),false);
 assert.equal(sourceCooldown(prev,'official',new Date(now.getTime()+6*3600000)),false);
});
test('server only updates success count after Firecrawl extraction; no secret in UI',()=>{
 const server=fs.readFileSync('netlify/functions/owner-intelligence.mjs','utf8');
 const ui=fs.readFileSync('kinvest-liens/owner/intelligence/index.html','utf8');
 assert.ok(server.indexOf("const excerpt=provider==='firecrawl'?await firecrawlSource")<
   server.indexOf('recordSuccess(successes,now)'));
 assert.match(server,/if\(!user\.owner\)return respond\(403/);
 assert.doesNotMatch(server,/syncReviewedCertificate|makeRelease/);
 assert.match(ui,/el\('fcSetup'\)\.hidden=!!d\.firecrawlConfigured/);
 assert.match(ui,/Failed attempts do not use that quota/);
});
