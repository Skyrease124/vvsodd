import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../lib/reply-reveal.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createReplyReveal}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const realSet=globalThis.setTimeout,realClear=globalThis.clearTimeout;
let tasks=new Map(),id=0,time=0;
globalThis.setTimeout=(fn,ms)=>{tasks.set(++id,{fn,ms});return id;};
globalThis.clearTimeout=id=>tasks.delete(id);
function drain(){let ticks=0;while(tasks.size){assert.ok(++ticks<1000,'Reveal must terminate');const [key,task]=tasks.entries().next().value;tasks.delete(key);time+=task.ms;task.fn();}return ticks;}
try{
 let paints=[];const controller=new AbortController();const reveal=createReplyReveal(s=>paints.push(s),controller.signal);
 const text='C++ pointer example 😀\n'.repeat(500);
 reveal.push(text);const pending=reveal.finish(text);const ticks=drain();await pending;
 assert.equal(paints.at(-1),text);assert.ok(time<=400);assert.ok(ticks<=10);
 for(const s of paints)assert.ok(!/[\uD800-\uDBFF]$/.test(s),'No split surrogate');
 console.log(`PASS long response: ${text.length} characters, ${paints.length} paints, ${time}ms scheduled completion tail (fake clock).`);
 reveal.dispose();
 paints=[];const c=new AbortController();const cancelled=createReplyReveal(s=>paints.push(s),c.signal);cancelled.push(text);const done=cancelled.finish(text);c.abort();const count=paints.length;drain();await done;assert.equal(paints.length,count);assert.equal(tasks.size,0);console.log('PASS cancellation clears timers and settles completion.');
 paints=[];const instant=createReplyReveal(s=>paints.push(s),new AbortController().signal,true);await instant.finish(text);assert.deepEqual(paints,[text]);instant.dispose();console.log('PASS instant/reduced-motion output.');
 paints=[];const replacement=createReplyReveal(s=>paints.push(s),new AbortController().signal);replacement.push('Old response '.repeat(100));const replaced=replacement.finish('Corrected citation 😀');drain();await replaced;assert.equal(paints.at(-1),'Corrected citation 😀');replacement.dispose();console.log('PASS final content replacement and complete citation text.');
}finally{globalThis.setTimeout=realSet;globalThis.clearTimeout=realClear;}
