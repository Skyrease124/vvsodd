import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('kinvest-liens/owner/intelligence/index.html','utf8');
test('owner-only dashboard remains hidden until authenticated',()=>{
 assert.match(html,/<main id="ownerMain" hidden>/);
 assert.match(html,/el\('ownerMain'\)\.hidden=false/);
});
test('dark cards use high-contrast white titles and legible mobile controls',()=>{
 assert.match(html,/#ownerMain :is\(h1,h2,h3,strong,label/);
 assert.match(html,/color:#f1f8fc!important/);
 assert.match(html,/#ownerMain \.stats strong\{color:#ffffff!important\}/);
 assert.match(html,/@media\(max-width:540px\)/);
 assert.match(html,/<details class="card">/);
 assert.match(html,/Upcoming tools/);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new vm.Script(script));
});
