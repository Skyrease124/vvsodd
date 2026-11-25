const assert=require('node:assert/strict');
const {readFile}=require('node:fs/promises');
const {chromium}=require('playwright');

(async()=>{
 const html=await readFile('kinvest-liens/owner/brain/activity/index.html','utf8');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
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
   // The fibres are drawn on a canvas (since the canvas renderer replaced the SVG paths): 256 fibres, 64 per node.
   assert.deepEqual(await page.evaluate(()=>[reactorFibers.length,fibersByNode.map(list=>list.length)]),[256,[64,64,64,64]]);
   assert.ok(await page.evaluate(()=>{const c=document.getElementById('reactorCanvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i])return true;return false;}),'the reactor canvas is drawn');
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
   const fibre=()=>page.evaluate(()=>{const f=fibersByNode[0][0];return {p0:[f.p0x,f.p0y],p3:[f.p3x,f.p3y]};});
   const before=await fibre();
   const node=page.locator('#nodes .node').first();
   await node.scrollIntoViewIfNeeded();
   const bounds=await node.boundingBox();
   await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
   await page.mouse.down();
   await page.mouse.move(bounds.x+bounds.width/2+20,bounds.y+bounds.height/2+15,{steps:6});
   await page.mouse.up();
   const offsets=(await node.getAttribute('transform')).match(/-?[\d.]+/g).map(Number);
   assert.ok(Math.hypot(offsets[0],offsets[1])>1,'the node moved');
   // While the loop runs, fibres are recomputed on the next animation frame.
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const after=await fibre();
   // The node end of each fibre follows the node exactly; the core end does not move.
   assert.ok(Math.abs(after.p3[0]-before.p3[0]-offsets[0])<0.01);
   assert.ok(Math.abs(after.p3[1]-before.p3[1]-offsets[1])<0.01);
   assert.deepEqual(after.p0,before.p0);
   assert.equal(requests,1,'dragging a node redraws the reactor and sends no network request');
   const initialNode=await node.boundingBox(),otherNode=await page.locator('#nodes .node').nth(1).boundingBox();
   await page.mouse.move(initialNode.x+initialNode.width/2,initialNode.y+initialNode.height/2);
   await page.mouse.down();
   await page.mouse.move(otherNode.x+otherNode.width/2,otherNode.y+otherNode.height/2,{steps:35});
   await page.mouse.up();
   const stopped=await node.boundingBox();
   assert.ok(stopped.x+stopped.width<=otherNode.x+1);
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.locator('#eventLayer .event-wave').first().evaluate(el=>getComputedStyle(el).animationName),'none');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
   assert.deepEqual(errors,[]);
   await page.close();
   // Reduced motion from the first paint: no animation loop, but the reactor is still drawn once.
   const still=await browser.newPage({viewport:{width,height:850},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'});
   await still.route('**/*',route=>{const url=new URL(route.request().url());
    if(url.pathname==='/activity')return route.fulfill({contentType:'text/html',body:html});
    if(url.pathname.endsWith('/owner-brain-activity'))return route.fulfill({json:{ok:true,summary:{},events:[event],capturedAt:event.at}});
    return route.fulfill({status:404});});
   await still.goto(origin+'/activity');
   await still.locator('#activity .log-entry').waitFor();
   assert.equal(await still.evaluate(()=>running),false,'no animation loop under reduced motion');
   assert.ok(await still.evaluate(()=>{const c=document.getElementById('reactorCanvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i])return true;return false;}),'the reactor is drawn once under reduced motion');
   await still.close();
   console.log(width+'px PASS: attached drag, collision, filters, replay, simulation, reduced motion');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
