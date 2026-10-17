// AI images in the Editor (owner-only): the owner saves an OpenRouter key and the image model id, generates a picture and edits
// the open photo; the result opens in the editor. OpenRouter is a local stand-in. Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/image.e2e.mjs <project> <code-file>
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {startEmulator} from './emulator.mjs';
const require=createRequire(path.join(process.cwd(),'package.json'));
const {chromium}=require(process.env.PLAYWRIGHT??'playwright');
const [project,codeFile]=process.argv.slice(2);
const results=[];const check=(n,ok,d='')=>{results.push(Boolean(ok));console.log(`${ok?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`);};
const PASSWORD='Image test owner password 1',KEY='sk-or-v1-'+'a'.repeat(40);
// A real 64x64 PNG so the editor can open the result.
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeUlEQVR4nO3PQQkAMAzAwMqpfxWTNRF7HINABFzm7H7dcEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFj13vDoEA84tnsQAAAABJRU5ErkJggg==';
const calls=[];let mode='ok';
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(!url.startsWith('https://openrouter.ai/'))return realFetch(input,init);
 const headers=new Headers(init?.headers);const body=init?.body?JSON.parse(String(init.body)):null;calls.push({url,auth:headers.get('authorization'),body});
 if(url.endsWith('/api/v1/key'))return Response.json({data:{}});
 if(mode==='busy')return Response.json({error:{message:'rate limit'}},{status:429});
 if(mode==='text')return Response.json({choices:[{message:{role:'assistant',content:'I cannot draw.'}}]});
 if(mode==='modal'&&body.modalities.length===1)return Response.json({error:{message:'Invalid modalities for this model'}},{status:400});
 return Response.json({choices:[{message:{role:'assistant',content:'',images:[{type:'image_url',image_url:{url:PNG}}]}}]});
};
const emu=await startEmulator(project,{NVIDIA_API_KEY:'nvapi-stand-in'});const base=emu.url.replace('127.0.0.1','localhost');
const browser=await chromium.launch();
try{
 const page=await browser.newPage({baseURL:base});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/owner-setup');await page.fill('input[name=code]',readFileSync(codeFile,'utf8').trim());await page.fill('input[name=password]',PASSWORD);await page.fill('input[name=confirm]',PASSWORD);await page.click('button');
 await page.goto('/login');await page.fill('input[name=email]',process.env.OWNER_EMAIL??'skyariasa@gmail.com');await page.fill('input[name=password]',PASSWORD);await Promise.all([page.waitForURL('**/owner'),page.click('form[action="/login"] button')]);
 const post=async(p,data)=>{const r=await page.request.post(p,{data,headers:{origin:base}});const t=await r.text();return {status:r.status(),body:t?JSON.parse(t):null};};
 let r=await post('/api/image-generate',{prompt:'a red fox'});
 check('before connecting OpenRouter, it says how to connect',r.status===503&&/Connect OpenRouter/.test(r.body.error),JSON.stringify(r.body));
 await page.goto('/connect-openrouter');await page.fill('input[name=key]',KEY);await page.click('form button');
 r=await post('/api/image-generate',{prompt:'a red fox'});
 check('a prompt returns an image and uses the saved model id',r.status===200&&r.body.image.startsWith('data:image/png')&&calls.at(-1).body.model==='black-forest-labs/flux.2-klein-4b'&&calls.at(-1).auth==='Bearer '+KEY&&calls.at(-1).body.modalities[0]==='image',JSON.stringify(r.body).slice(0,120));
 check('a bad model id is refused',(await post('/api/image-model',{model:'not a model'})).status===400);
 check('the model id can be changed',(await post('/api/image-model',{model:'black-forest-labs/flux-test-1'})).body.model==='black-forest-labs/flux-test-1');
 await post('/api/image-generate',{prompt:'edit',image:PNG});
 const last=calls.at(-1).body;
 check('the new model id is used, and an edit sends the photo with the instruction',last.model==='black-forest-labs/flux-test-1'&&Array.isArray(last.messages[0].content)&&last.messages[0].content[1].image_url.url===PNG);
 mode='modal';r=await post('/api/image-generate',{prompt:'x'});check('a model that needs text+image output is retried that way',r.status===200);
 mode='busy';r=await post('/api/image-generate',{prompt:'x'});check('a busy free model gives a clear message',r.status===429&&/busy/.test(r.body.error),r.body.error);
 mode='text';r=await post('/api/image-generate',{prompt:'x'});check('a reply without an image is reported with the model id',r.status===502&&/returned no image/.test(r.body.error)&&/flux-test-1/.test(r.body.error),r.body.error);
 mode='ok';
 check('an oversized or wrong-type photo is refused',(await post('/api/image-generate',{prompt:'x',image:'data:text/html;base64,AAAA'})).status===400);
 // The Editor page.
 await page.goto('/editor');await page.waitForSelector('.editor-ai',{timeout:30000});
 check('the owner sees the AI image panel',true);
 await page.waitForFunction(()=>document.querySelector('.editor-status')&&!/Loading/.test(document.querySelector('.editor-status').textContent),null,{timeout:60000}).catch(()=>{});
 console.log('status:',await page.locator('.editor-status').innerText());
 await page.fill('.editor-ai textarea','a small red square');
 await page.click('text=Generate new image');
 await page.waitForFunction(()=>/AI image ready/.test(document.querySelector('.editor-log')?.textContent||''),null,{timeout:60000}).catch(()=>{});
 console.log('log:',(await page.locator('.editor-log').innerText()).slice(-300),'| ai:',await page.locator('.editor-ai-note').allInnerTexts());
 check('generating shows the picture in the editor',/AI image ready/.test(await page.locator('.editor-log').innerText()),(await page.locator('.editor-log').innerText()).slice(-160));
 const before=calls.length;await page.fill('.editor-ai textarea','make it blue');
 await page.click('text=AI edit this photo');
 await page.waitForFunction(()=>/AI edit ready/.test(document.querySelector('.editor-log')?.textContent||''),null,{timeout:60000}).catch(()=>{});
 const edit=calls.slice(before).find(c=>c.url.includes('chat/completions'));
 check('AI edit sends the open photo and the instruction',edit&&Array.isArray(edit.body.messages[0].content)&&/^data:image\/jpeg/.test(edit.body.messages[0].content[1].image_url.url)&&edit.body.messages[0].content[0].text==='make it blue');
 if(process.env.SHOT)await page.screenshot({path:process.env.SHOT,fullPage:true});
 // A signed-out visitor cannot use it.
 const anon=await browser.newPage({baseURL:base});const ar=await anon.request.post('/api/image-generate',{data:{prompt:'x'},headers:{origin:base}});
 check('signed-out visitors cannot use it',ar.status()>=400&&ar.status()<500,String(ar.status()));
 check('no page errors',errors.length===0,errors.join(' | '));
}finally{await browser.close();await emu.stop();globalThis.fetch=realFetch;}
const passed=results.filter(Boolean).length;console.log(`${passed}/${results.length} passed`);process.exit(passed===results.length?0:1);
