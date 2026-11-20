import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('netlify/functions/owner-intelligence.mjs','utf8');
test('Firecrawl standard retention uses v2 scrape with Markdown without requesting zero-data-retention',()=>{
  assert.match(source,/api\.firecrawl\.dev\/v2\/scrape/);
  assert.match(source,/formats:\['markdown'\]/);
  assert.doesNotMatch(source,/zeroDataRetention\s*:/);
});
test('Firecrawl remains server-side owner-only and cannot publish records',()=>{
  assert.match(source,/if\(!user\.owner\)return respond\(403/);
  assert.match(source,/process\.env\.FIRECRAWL_API_KEY/);
  assert.match(source,/request\.headers\.get\('origin'\)!==u\.origin/);
  assert.match(source,/quotaDecision\(successRecord,attemptRecord,now\)/);
  assert.doesNotMatch(source,/syncReviewedCertificate|makeRelease|approved-research-releases-v1/);
});
