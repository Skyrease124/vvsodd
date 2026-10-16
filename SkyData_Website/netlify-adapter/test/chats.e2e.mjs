// Saved chats: the home screen lists previous chats, any can be reopened or deleted, the logo and New chat return home,
// and a reload no longer jumps back into the last conversation. Usage (from SkyData_Website, after build.mjs):
//   node netlify-adapter/test/chats.e2e.mjs <project> <code-file>
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {startEmulator} from './emulator.mjs';
const require=createRequire(path.join(process.cwd(),'package.json'));
const {chromium}=require(process.env.PLAYWRIGHT??'playwright');
const [project,codeFile]=process.argv.slice(2);
const results=[];const check=(n,ok,d='')=>{results.push(Boolean(ok));console.log(`${ok?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`);};
const PASSWORD='Chats test owner password 1';
const emu=await startEmulator(project,{NVIDIA_API_KEY:'nvapi-stand-in'});const base=emu.url.replace('127.0.0.1','localhost');
const browser=await chromium.launch();
try{
 const page=await browser.newPage({baseURL:base,viewport:{width:414,height:860}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/owner-setup');await page.fill('input[name=code]',readFileSync(codeFile,'utf8').trim());await page.fill('input[name=password]',PASSWORD);await page.fill('input[name=confirm]',PASSWORD);await page.click('button');
 await page.goto('/login');await page.fill('input[name=email]',process.env.OWNER_EMAIL??'skyariasa@gmail.com');await page.fill('input[name=password]',PASSWORD);await Promise.all([page.waitForURL('**/owner'),page.click('form[action="/login"] button')]);
 const api=async(p,method='GET',body)=>{const r=await page.request.fetch(p,{method,...(body?{data:body}:{}),headers:{origin:base}});const t=await r.text();return {status:r.status(),body:t?JSON.parse(t):null};};
 const state=(q,a)=>({messages:[{role:'user',content:q},{role:'assistant',content:a}],draft:'',model:'nvidia/nemotron-3-ultra-550b-a55b',replyLanguage:'en'});
 const id1='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222';
 check('an empty chat is not saved',(await api('/api/chats/'+id1,'POST',{...state('x','y'),messages:[]})).body.saved===false);
 const sv=await api('/api/chats/'+id1,'POST',state('How do I bake sourdough?','Start with a **starter**.'));check('a chat is saved',sv.body?.saved===true,JSON.stringify(sv));
 await new Promise(r=>setTimeout(r,20));await api('/api/chats/'+id2,'POST',state('Explain the REA runner','It analyses files in Docker.'));
 const list=(await api('/api/chats')).body.chats;
 check('chats are listed newest first with title and preview',list.length===2&&list[0].id===id2&&list[1].title==='How do I bake sourdough?'&&list[1].preview.includes('Start with a starter'),JSON.stringify(list.map(c=>c.title)));
 check('a saved chat can be opened',(await api('/api/chats/'+id1)).body.state.messages.length===2);
 check('a bad id is refused',(await api('/api/chats/not-an-id')).status===404);
 // The home screen.
 await page.goto('/');await page.waitForSelector('.recent-chats');
 check('the home screen shows previous chats',await page.locator('.recent-open').count()===2);
 if(process.env.SHOT)await page.screenshot({path:process.env.SHOT});
 await page.locator('.recent-open',{hasText:'sourdough'}).click();await page.waitForSelector('.messages');
 check('opening a card shows that conversation',(await page.locator('.messages').innerText()).includes('Start with a'));
 await page.click('.brand');await page.waitForSelector('.recent-chats');
 check('the logo goes to the home screen, not back into the chat',await page.locator('.messages').count()===0&&await page.locator('.recent-open').count()===2);
 await page.locator('.recent-open',{hasText:'REA runner'}).click();await page.waitForSelector('.messages');await page.reload();await page.waitForSelector('.recent-chats');
 check('reloading shows the home screen, not the last chat',await page.locator('.messages').count()===0);
 await page.click('.new').catch(()=>{});
 await page.locator('.recent-delete').first().click();await page.waitForTimeout(500);
 check('a chat can be deleted',(await api('/api/chats')).body.chats.length===1);
 check('no page errors',errors.length===0,errors.join(' | '));
}finally{await browser.close();await emu.stop();}
const passed=results.filter(Boolean).length;console.log(`${passed}/${results.length} passed`);process.exit(passed===results.length?0:1);
