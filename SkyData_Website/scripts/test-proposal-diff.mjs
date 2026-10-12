import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const dir=fs.readdirSync('node_modules/.pnpm').find(x=>x.startsWith('esbuild@'));const esbuild=await import('../node_modules/.pnpm/'+dir+'/node_modules/esbuild/lib/main.js');
await esbuild.build({stdin:{contents:"export * from './lib/line-diff';export * from './lib/proposal-blocks';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:'node_modules/.cache/proposal-diff.cjs',logLevel:'error'});
const {diffLines,hunks,applyDiff,splitLines,proposedBlocks,reviewBlocks}=require('../node_modules/.cache/proposal-diff.cjs');
// Property: for random edits, the diff reproduces both sides exactly.
let seed=7;const rnd=n=>{seed=(seed*1103515245+12345)%2147483648;return seed%n;};
for(let t=0;t<400;t++){const a=Array.from({length:rnd(60)},()=>'l'+rnd(8)),b=a.slice();for(let e=rnd(12);e>0;e--){const op=rnd(3),at=rnd(b.length+1);if(op===0)b.splice(at,0,'n'+rnd(8));else if(op===1&&b.length)b.splice(at%b.length,1);else if(b.length)b[at%b.length]='c'+rnd(8);}
 const enc=x=>x.map(l=>l+'\n').join(''),d=diffLines(enc(a),enc(b));assert.deepEqual(applyDiff(d.lines),b);assert.deepEqual(d.lines.filter(l=>l.type!=='add').map(l=>l.text),a);assert.ok(d.exact);
 for(const l of d.lines){if(l.type!=='add')assert.equal(a[l.a-1],l.text);if(l.type!=='del')assert.equal(b[l.b-1],l.text);}}
const small=diffLines('a\nb\nc\n','a\nB\nc\nd\n');assert.equal(small.added,2);assert.equal(small.removed,1);
assert.equal(diffLines('a\n','a').newlineAtEndChanged,true);assert.equal(diffLines('','x\n').added,1);assert.deepEqual(splitLines(''),[]);
const long=Array.from({length:500},(_,i)=>'x'+i).join('\n'),h=hunks(diffLines(long,long.replace('x250','y250')).lines);assert.equal(h.filter(x=>x.kind==='skip').length,2);
const huge=diffLines(Array.from({length:8000},(_,i)=>'a'+i).join('\n'),Array.from({length:8000},(_,i)=>'b'+i).join('\n'));assert.equal(huge.exact,false);assert.equal(huge.added,8000);
const text="intro\n```js file=src/a.js\nconst a=1;\n```\n```js\nnot a file\n```\n````md file=\"docs/x y.md\"\n```inner```\n````\n```js file=src/a.js\ndup\n```\n```js file=new.test.mjs\ntest\n```\n";
const blocks=proposedBlocks(text);assert.deepEqual(blocks.map(b=>b.path),['src/a.js','docs/x y.md','src/a.js','new.test.mjs']);assert.equal(blocks[0].text,'const a=1;\n');assert.equal(blocks[1].text,'```inner```\n');
const r=reviewBlocks(proposedBlocks("```js file=full.js\n1\n```\n```js file=part.js\n2\n```\n```js file=unseen.js\n3\n```\n```js file=t.test.mjs\n4\n```\n"),[{path:'full.js',status:'full',sha256:'a'.repeat(64)},{path:'part.js',status:'truncated',sha256:'b'.repeat(64)}],new Set(['full.js','part.js','unseen.js']));
assert.deepEqual(r.map(x=>[x.path,x.eligible,x.isNew]),[['full.js',true,false],['part.js',false,false],['unseen.js',false,false],['t.test.mjs',true,true]]);assert.equal(r[0].originalSha256,'a'.repeat(64));
assert.ok(reviewBlocks(blocks,null,new Set()).filter(b=>b.path==='src/a.js').every(b=>!b.eligible),'duplicate paths are never eligible');
console.log('PASS line diff (400 randomized edit scripts reproduce both files exactly, hunks, final-newline flag, large-edit fallback labelled inexact) and AI block parsing (only file= fences, nested fences, duplicates refused, eligibility only for files sent FULL or new).');
