// Owner dashboard: the confirmation is shown inside the page (the browser pop-up is blocked on some phones), and Confirm sends the request.
const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:390,height:844}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
let posted=null;
await p.route('**/.netlify/functions/**',async r=>{const u=new URL(r.request().url()).pathname.split('/').pop();
 if(u==='owner-brain-scheduler-control'&&r.request().method()==='POST'){posted=JSON.parse(r.request().postData());return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,enabled:true})});}
 if(u==='owner-brain-autonomy-status')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,preview:false,unattendedProductionEnabled:false,worker:{cursor:0,published:0,verifiedOverlayCount:0,quotaActive:true,dailyLimit:300,dailyUsed:0,state:'idle',mapVersion:0},steps:[],blockers:[],scheduledFrequencyMinutes:30})});
 r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,entries:[],receipts:[],results:[]})});});
await p.addInitScript(()=>{window.confirm=()=>false;}); // simulate a browser that blocks the native pop-up
await p.goto('http://127.0.0.1:8765/owner/brain/',{waitUntil:'load'});await p.waitForTimeout(2000);
await p.locator('a.bn-row',{hasText:'24/7 Agent Readiness'}).click();await p.waitForTimeout(600);
await p.locator('#unattendedToggle').click();
await p.getByRole('dialog').waitFor({timeout:3000});
assert.equal(await p.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).count(),1,'the question is shown inside the page');
await p.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(posted,null,'Cancel sends nothing');
await p.locator('#unattendedToggle').click();await p.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();
console.log('ERRS',JSON.stringify(errs),'DIALOGS',await p.getByRole('dialog').count(),'TOGGLE disabled',await p.locator('#unattendedToggle').isDisabled());console.log('OUT:',await p.locator('#unattendedToggleResult').textContent(),'|',await p.locator('#unattendedSummary').textContent());await p.waitForTimeout(800);assert.ok(posted&&posted.action==='enable'&&posted.confirmed===true,'Confirm sends the enable request');
assert.deepEqual(errs.filter(e=>!/reading 'used'/.test(e)),[]);console.log('PASS: in-page confirmation, Cancel sends nothing, Confirm enables');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
