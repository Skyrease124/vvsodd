import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('lib/avatar-render.ts','utf8');
const {assemblyProgress,AVATAR_DURATION,drawPortrait,lipDisplacement}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
for(let i=0;i<900;i++){let previous=0;for(let t=0;t<=AVATAR_DURATION+.1;t+=.05){const p=assemblyProgress(t,i);assert.ok(p>=previous&&p<=1);previous=p;}assert.equal(assemblyProgress(AVATAR_DURATION,i),1);assert.equal(assemblyProgress(0,i,true),1);}
let draws=0;const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get(target,key){return target[key]??((...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));if(key==='drawImage'){draws++;assert.ok(args.at(-1)>0);}});},set(target,key,value){target[key]=value;return true;}});
const image={naturalWidth:1254,naturalHeight:1254};
for(const level of [0,.1,.5,1])for(const time of [0,5500,5590,5700])drawPortrait(ctx,image,600,time,level,false);
assert.ok(draws>100);draws=0;drawPortrait(ctx,image,600,0,0,true);assert.equal(draws,1,'Reduced motion at rest uses only the original portrait');
console.log('PASS: 900 tile paths converge monotonically; raster draw geometry stays finite across audio levels and blinks; reduced-motion baseline. Drawing context mocked; no browser/audio visual test.');

for(const level of [0,.2,1]){for(const x of [0,.2,.39,.61,.8,1])assert.equal(lipDisplacement(x,.579,level),0,'Cheeks and face silhouette remain fixed');assert.equal(lipDisplacement(.5,.8,level),0,'Neck stays fixed');assert.equal(lipDisplacement(.5,.55,0),0,'Silence closes lips');assert.ok(Math.abs(lipDisplacement(.5,.56,level))<.026);assert.ok(lipDisplacement(.5,.56,level)<=0);assert.ok(lipDisplacement(.5,.6,level)>=0);}
console.log('PASS: lip deformation confined to mouth; cheeks, silhouette and neck unchanged; no lower-face strip displacement.');

assert.ok(Math.abs(lipDisplacement(.5,.568,1))>.015, "Speaking opens the lips visibly while preserving the surrounding face");
