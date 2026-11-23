// Real-browser behaviour checks for the Price Pocket map (run by validate-map-polish.yml).
// Covers: default basemap (satellite + black state borders, reference overlay opt-in),
// syncGISButton() and aiRefresh() after state changes, Pro-only AI gating, and Free map access.
// Requires the static server from tests/map_polish.static-server.cjs on 127.0.0.1:8765.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://127.0.0.1:8765';
const NO_CHANGE_CONTEXT=/^Looking at: the whole country/;

async function openMap(browser,{viewport,user,path='/map/',waitForMap=true}){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Account state is mocked: null user = anonymous, {paid:false} = Free member, {paid:true} = Pro member.
  await page.route('**/.netlify/functions/account',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user?{user}:{})}));
  await page.goto(BASE+path,{waitUntil:'domcontentloaded'});
  if(waitForMap)await page.waitForFunction(()=>window.__ppaMap&&window.__ppaMap.getLayer&&window.__ppaMap.getLayer('st-line'),null,{timeout:30000});
  return {context,page,errors};
}
const layout=(page,id)=>page.evaluate(i=>window.__ppaMap.getLayer(i)?window.__ppaMap.getLayoutProperty(i,'visibility'):'missing',id);
const gisText=page=>page.locator('#pmGisButton').textContent();
async function pickState(page,code){
  await page.getByRole('combobox',{name:'State'}).selectOption(code);
}
function assertNoScriptErrors(errors,label){
  const bad=errors.filter(e=>/ReferenceError|TypeError|SyntaxError/.test(e));
  assert.equal(bad.length,0,label+': '+bad.join('; '));
}

(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
  const checks=[];
  const pass=name=>{checks.push(name);console.log('PASS: '+name);};
  try{
    // 1. Default basemap: satellite, black state borders, no thick white reference overlay.
    for(const viewport of [{width:390,height:844},{width:1365,height:900}]){
      const {context,page,errors}=await openMap(browser,{viewport,user:null});
      assert.equal(await layout(page,'sat'),'visible','satellite imagery visible by default');
      assert.equal(await layout(page,'osm'),'none','OSM base hidden by default');
      assert.equal(await layout(page,'ref'),'none','white reference overlay off by default');
      assert.equal(await layout(page,'st-line'),'visible','black state borders visible');
      assert.equal(await page.evaluate(()=>window.__ppaMap.getPaintProperty('st-line','line-color')),'#000000','state borders are black');
      assert.equal(await layout(page,'st-sel'),'none','white selected-state outline never shown by default');
      // Hybrid remains an explicit opt-in through Layers.
      await page.locator('#pmToolTrigger').click();
      await page.locator('#pmToolMenu').getByRole('button',{name:'Layers'}).click();
      await page.getByRole('button',{name:'Hybrid',exact:true}).click();
      await page.waitForFunction(()=>window.__ppaMap.getLayoutProperty('ref','visibility')==='visible',null,{timeout:5000});
      assert.equal(await layout(page,'st-line'),'visible','black borders still visible in Hybrid');
      await page.locator('#pmToolTrigger').click();
      await page.locator('#pmToolMenu').getByRole('button',{name:'Layers'}).click();
      await page.getByRole('button',{name:'Satellite',exact:true}).click();
      await page.waitForFunction(()=>window.__ppaMap.getLayoutProperty('ref','visibility')==='none',null,{timeout:5000});
      assertNoScriptErrors(errors,'default basemap '+viewport.width);
      await context.close();
      pass('default basemap is satellite with black borders; Hybrid opt-in at '+viewport.width+'px');
    }

    // 2. syncGISButton() behaviour across state changes (real select change event).
    {
      const {context,page,errors}=await openMap(browser,{viewport:{width:1365,height:900},user:null});
      await pickState(page,'GA');
      await page.waitForFunction(()=>document.getElementById('pmGisButton')?.textContent==='GA GIS',null,{timeout:5000});
      assert.equal(await page.locator('#pmGisButton').getAttribute('aria-label'),'Official GA parcel GIS');
      assert.equal(await page.locator('#pmGisButton').getAttribute('aria-pressed'),'false','GIS not pressed outside Florida');
      await pickState(page,'TX');
      await page.waitForFunction(()=>document.getElementById('pmGisButton')?.textContent==='TX GIS',null,{timeout:5000});
      await pickState(page,'FL');
      await page.waitForFunction(()=>document.getElementById('pmGisButton')?.textContent==='FL GIS',null,{timeout:5000});
      assert.equal(await page.locator('#pmGisButton').getAttribute('title'),'Florida county GIS: Lee/Palm Beach overlays at street zoom');
      await page.getByRole('combobox',{name:'State'}).selectOption('');
      await page.waitForFunction(()=>document.getElementById('pmGisButton')?.textContent==='GIS',null,{timeout:5000});
      assert.equal(await page.locator('#pmGisButton').getAttribute('aria-label'),'Choose a state for parcel GIS');
      assert.equal(await page.locator('#pmGisButton').getAttribute('aria-pressed'),'false');
      assertNoScriptErrors(errors,'syncGISButton');
      await context.close();
      pass('syncGISButton() updates text, aria-label, title and aria-pressed on each state change and when cleared');
    }

    // 3. aiRefresh() behaviour: context line and suggestion cards follow the selected state.
    {
      const {context,page,errors}=await openMap(browser,{viewport:{width:1365,height:900},user:{paid:true}});
      await page.waitForFunction(()=>document.querySelector('#pmAiBox .ai-ctx'),null,{timeout:10000});
      assert.match(await page.locator('#pmAiBox .ai-ctx').textContent(),NO_CHANGE_CONTEXT,'national context before any state is chosen');
      const before=await page.locator('#pmAiBox .ai-card').count();
      assert.equal(before,4,'national suggestion cards');
      await pickState(page,'GA');
      await page.waitForFunction(()=>document.querySelector('#pmAiBox .ai-ctx')?.textContent==='Looking at: Georgia',null,{timeout:5000});
      const cards=await page.locator('#pmAiBox .ai-card').allTextContents();
      assert.equal(cards.length,4,'four suggestion cards for a state');
      assert.ok(cards.some(t=>t.includes('Georgia')),'suggestions name the selected state');
      await pickState(page,'');
      await page.waitForFunction(()=>/^Looking at: the whole country/.test(document.querySelector('#pmAiBox .ai-ctx')?.textContent||''),null,{timeout:5000});
      assert.match(await page.locator('#pmAiBox .ai-ctx').textContent(),NO_CHANGE_CONTEXT,'context returns to national after clearing the state');
      assertNoScriptErrors(errors,'aiRefresh');
      await context.close();
      pass('aiRefresh() updates "Looking at" context and suggestion cards on state change and on clear');
    }

    // 4. AI is Pro-only: anonymous and Free members see the locked AI button and are sent to plans.
    for(const [label,user] of [['anonymous',null],['Free member',{paid:false}]]){
      const {context,page,errors}=await openMap(browser,{viewport:{width:1365,height:900},user});
      await page.waitForFunction(()=>document.querySelector('#pmAsk')?.getAttribute('aria-label')==='AI, members only',null,{timeout:10000});
      assert.equal(await page.locator('#pmAsk').textContent(),'🔒 AI',label+' sees locked AI');
      await Promise.all([
        page.waitForURL(/\/plans\/\?src=Map%20Assistant/,{timeout:10000}),
        page.locator('#pmAsk').click(),
      ]);
      assertNoScriptErrors(errors,'AI gating '+label);
      await context.close();
      pass(label+': AI is locked and routes to the Pro plan page');
    }

    // 5. Pro member: AI opens, shows no membership warning, and the context is populated.
    {
      const {context,page,errors}=await openMap(browser,{viewport:{width:1365,height:900},user:{paid:true}});
      await page.waitForFunction(()=>document.querySelector('#pmAsk')?.getAttribute('aria-label')==='AI',null,{timeout:10000});
      assert.equal(await page.locator('#pmAsk').textContent(),'AI');
      await page.locator('#pmAsk').click();
      await page.waitForFunction(()=>document.getElementById('tabAi')?.getAttribute('aria-selected')==='true',null,{timeout:5000});
      assert.equal(await page.locator('#pmAiBox .pm-flag').count(),0,'no Pro-only warning for Pro members');
      assertNoScriptErrors(errors,'Pro AI');
      await context.close();
      pass('Pro member: AI opens without the membership warning');
    }

    // 6. Free member keeps map access: map loads, state selection and GIS work.
    {
      const {context,page,errors}=await openMap(browser,{viewport:{width:390,height:844},user:{paid:false}});
      assert.ok(await page.locator('#pmToolTrigger').isVisible(),'Tools menu available to Free members');
      await pickState(page,'GA');
      await page.waitForFunction(()=>document.getElementById('pmGisButton')?.textContent==='GA GIS',null,{timeout:5000});
      assert.equal(await layout(page,'st-line'),'visible','state borders still visible for Free members');
      assertNoScriptErrors(errors,'Free map access');
      await context.close();
      pass('Free member: map loads, state selection and GIS button work');
    }

    // 7. Homepage embed uses the same default basemap.
    {
      const {context,page,errors}=await openMap(browser,{viewport:{width:390,height:844},user:null,path:'/',waitForMap:false});
      const frameEl=page.locator('iframe[src*="/map/?embed=1&home=1"]');
      await frameEl.waitFor({timeout:20000});
      const frame=await (await frameEl.elementHandle()).contentFrame();
      await frame.waitForFunction(()=>window.__ppaMap&&window.__ppaMap.getLayer&&window.__ppaMap.getLayer('st-line'),null,{timeout:30000});
      const f=(id)=>frame.evaluate(i=>window.__ppaMap.getLayer(i)?window.__ppaMap.getLayoutProperty(i,'visibility'):'missing',id);
      assert.equal(await f('sat'),'visible','homepage satellite visible');
      assert.equal(await f('ref'),'none','homepage white overlay off by default');
      assert.equal(await f('st-line'),'visible','homepage black state borders visible');
      assertNoScriptErrors(errors,'homepage embed');
      await context.close();
      pass('homepage embed: satellite with black borders and no white overlay by default');
    }
    console.log('PASS: '+checks.length+' map behaviour checks.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
