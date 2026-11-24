// Real-browser check: every state gets the swipeable parcel strip on the homepage map, not only Florida.
// New York is given FICTIONAL parcel outlines here (the real approved positions are not in the published files).
// Requires the static server from tests/map_polish.static-server.cjs on 127.0.0.1:8765.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const BASE='http://127.0.0.1:8765';
// The approved records feed, as the owner's approval produces it: existing parcels get a verified outline. FICTIONAL outlines.
function approvedFeed(file,n){
  const d=JSON.parse(fs.readFileSync('kinvest-liens/map/data/'+file,'utf8'));
  const cat=d.dict&&d.dict.c?d.dict.c:null;
  return {ok:true,records:d.recs.slice(0,n).map((r,i)=>{
    const x=-77.60+i*0.002,y=43.15+i*0.001,w=0.0004,h=0.0003;
    return {p:r.p,c:cat?cat[r.c]:r.c,a:r.a||null,cx:[x+w/2,y+h/2],g:[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]],bb:[x,y,x+w,y+h],approved:{}};
  })};
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const imageRequests=[];
    await page.route('**/.netlify/functions/account',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await page.route('**/server.arcgisonline.com/**',r=>{imageRequests.push(r.request().url());r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')});});
    // Approved outlines arrive through the approved records feed. Only New York has any here; Iowa has none yet.
    await page.route('**/.netlify/functions/brain-map-records**',r=>{
      const u=new URL(r.request().url());
      const body=u.searchParams.get('state')==='NY'?approvedFeed('NY-city-of-rochester.json',3):{ok:true,records:[]};
      r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});
    const frameEl=page.locator('iframe[src*="/map/?embed=1&home=1"]');await frameEl.waitFor({timeout:20000});
    const frame=await (await frameEl.elementHandle()).contentFrame();
    await frame.waitForFunction(()=>window.__ppaMap&&window.__ppaMap.getLayer&&window.__ppaMap.getLayer('st-line'),null,{timeout:30000});
    const state=code=>frame.getByRole('combobox',{name:'State'}).selectOption(code);
    // 1. New York: one choice and every approved parcel appears as a satellite card, with no county chosen.
    await state('NY');
    await frame.locator('#pmStrip .pm-sc').first().waitFor({state:'visible',timeout:20000});
    assert.equal(await frame.locator('#pmStrip .pm-sc').count(),3,'one card per parcel with an outline');
    assert.match(await frame.locator('#pmStrip .pm-strip-h').textContent(),/New York parcels/);
    await frame.locator('#pmStrip .pm-sc img').first().waitFor({state:'attached'});
    await page.waitForTimeout(500);
    assert.ok(imageRequests.length>=1&&imageRequests.every(u=>/World_Imagery/.test(u)),'each card asks for its satellite image');
    // The county list still works: choosing the county keeps its parcels and the strip.
    await frame.getByRole('combobox',{name:'County'}).selectOption({index:1});
    await page.waitForTimeout(800);
    assert.equal(await frame.locator('#pmStrip .pm-sc').count(),3,'choosing the county keeps its parcels');
    await frame.getByRole('combobox',{name:'County'}).selectOption({index:0});
    await page.waitForTimeout(500);
    // 2. Iowa has records but no public outlines yet: no empty strip, and an honest message instead.
    await state('IA');
    await frame.locator('#pmStrip').waitFor({state:'hidden',timeout:20000});
    await frame.waitForFunction(()=>/tax sale records are listed\. Parcel outlines for this state are still being verified/.test(document.body.textContent),null,{timeout:20000});
    // 3. Florida still works exactly as before.
    await state('FL');
    await frame.locator('#pmStrip .pm-sc').first().waitFor({state:'visible',timeout:30000});
    assert.match(await frame.locator('#pmStrip .pm-strip-h').textContent(),/Florida parcels/);
    const bad=errors.filter(e=>/ReferenceError|TypeError|SyntaxError/.test(e));assert.equal(bad.length,0,bad.join('; '));
    await context.close();
    // 4. Once Iowa's matches are approved, Iowa behaves the same way: pick the state, every approved parcel appears.
    const c2=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
    const p2=await c2.newPage();
    await p2.route('**/.netlify/functions/account',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await p2.route('**/server.arcgisonline.com/**',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')}));
    await p2.route('**/.netlify/functions/brain-map-records**',r=>{
      const st=new URL(r.request().url()).searchParams.get('state');
      r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(st==='IA'?approvedFeed('IA-scott.json',2):{ok:true,records:[]})});
    });
    await p2.goto(BASE+'/',{waitUntil:'domcontentloaded'});
    const el2=p2.locator('iframe[src*="/map/?embed=1&home=1"]');await el2.waitFor({timeout:20000});
    const f2=await (await el2.elementHandle()).contentFrame();
    await f2.waitForFunction(()=>window.__ppaMap&&window.__ppaMap.getLayer&&window.__ppaMap.getLayer('st-line'),null,{timeout:30000});
    await f2.getByRole('combobox',{name:'State'}).selectOption('IA');
    await f2.locator('#pmStrip .pm-sc').first().waitFor({state:'visible',timeout:20000});
    assert.equal(await f2.locator('#pmStrip .pm-sc').count(),2,'Iowa: one card per approved parcel');
    assert.match(await f2.locator('#pmStrip .pm-strip-h').textContent(),/Iowa parcels/);
    await c2.close();
    console.log('PASS: parcel strip for New York (3 approved parcels, county list still works), Iowa none until approved then 2, Florida unchanged');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
