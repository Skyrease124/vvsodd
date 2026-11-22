const assert=require('node:assert/strict');
const {readFile}=require('node:fs/promises');
const {chromium}=require('playwright');

(async()=>{
 const html=await readFile('kinvest-liens/owner/brain/activity/index.html','utf8');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [320,375,390,430,1280]){
   const page=await browser.newPage({viewport:{width,height:850},isMobile:width<500,hasTouch:width<500});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   let requests=0;
   const origin='https://preview.test';
   const event={id:'fixture',at:'2026-11-22T18:23:49.242Z',county:'FL-putnam',parcelId:'04-10-24-6450-0060-0240',
    agent:'Official GIS',from:'FloridaGIO',to:'NVIDIA',type:'geometry_validated',status:'success',message:'Fixture boundary check'};
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    assert.equal(url.origin,origin);
    assert.equal(route.request().method(),'GET');
    if(url.pathname==='/activity')return route.fulfill({contentType:'text/html',body:html});
    if(url.pathname.endsWith('/owner-brain-activity')){
     requests++;
     return route.fulfill({json:{ok:true,summary:{},events:[event,event],capturedAt:event.at}});
    }
    return route.fulfill({status:404});
   });
   await page.goto(origin+'/activity');
   await page.locator('#activity .log-entry').waitFor();
   assert.equal(await page.locator('#activity .log-entry').count(),1);
   assert.equal(await page.locator('#fibers path').count(),256);
   await page.locator('#eventCounty').selectOption('FL-putnam');
   await page.locator('#eventParcel').fill('bad');
   assert.equal(await page.locator('#activity .log-entry').count(),0);
   await page.locator('#eventParcel').fill('0240');
   await page.locator('#activityMode').selectOption('replay');
   await page.locator('#replayToggle').click();
   await page.locator('#activity .log-entry').waitFor();
   await page.locator('#activityMode').selectOption('simulation');
   assert.match(await page.locator('#activity').innerText(),/Simulation/);
   assert.equal(requests,1);
   const path=page.locator('#fibers path').first();
   const before=await path.getAttribute('d');
   const node=page.locator('#nodes .node').first();
   await node.scrollIntoViewIfNeeded();
   const bounds=await node.boundingBox();
   await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
   await page.mouse.down();
   await page.mouse.move(bounds.x+bounds.width/2+20,bounds.y+bounds.height/2+15,{steps:6});
   await page.mouse.up();
   assert.notEqual(await path.getAttribute('d'),before);
   const offsets=(await node.getAttribute('transform')).match(/-?[\d.]+/g).map(Number);
   const after=(await path.getAttribute('d')).split(/\s+/);
   const old=before.split(/\s+/);
   assert.ok(Math.abs(Number(after[1])-Number(old[1])-offsets[0])<0.01);
   assert.ok(Math.abs(Number(after[2])-Number(old[2])-offsets[1])<0.01);
   assert.deepEqual(after.slice(-2),old.slice(-2).map(Number).map(String));
   const initialNode=await node.boundingBox(),otherNode=await page.locator('#nodes .node').nth(1).boundingBox();
   await page.mouse.move(initialNode.x+initialNode.width/2,initialNode.y+initialNode.height/2);
   await page.mouse.down();
   await page.mouse.move(otherNode.x+otherNode.width/2,otherNode.y+otherNode.height/2,{steps:35});
   await page.mouse.up();
   const stopped=await node.boundingBox();
   assert.ok(stopped.x+stopped.width<=otherNode.x+1);
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.locator('#fibers .moving').first().evaluate(el=>getComputedStyle(el).animationName),'none');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
   assert.deepEqual(errors,[]);
   await page.close();
   console.log(width+'px PASS: attached drag, collision, filters, replay, simulation, reduced motion');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
