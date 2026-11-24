// Real-browser check: every state gets the swipeable parcel strip on the homepage map, not only Florida.
// New York is given FICTIONAL parcel outlines here (the real approved positions are not in the published files).
// Requires the static server from tests/map_polish.static-server.cjs on 127.0.0.1:8765.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const BASE='http://127.0.0.1:8765';
function withOutlines(file,n){
  const d=JSON.parse(fs.readFileSync('kinvest-liens/map/data/'+file,'utf8'));
  d.recs.slice(0,n).forEach((r,i)=>{
    const x=-77.60+i*0.002,y=43.15+i*0.001,w=0.0004,h=0.0003;
    r.g=[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]];r.bb=[x,y,x+w,y+h];r.cx=[x+w/2,y+h/2];
  });
  return d;
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const imageRequests=[];
    await page.route('**/.netlify/functions/account',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await page.route('**/server.arcgisonline.com/**',r=>{imageRequests.push(r.request().url());r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')});});
    await page.route('**/map/data/NY-city-of-rochester.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(withOutlines('NY-city-of-rochester.json',3))}));
    await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});
    const frameEl=page.locator('iframe[src*="/map/?embed=1&home=1"]');await frameEl.waitFor({timeout:20000});
    const frame=await (await frameEl.elementHandle()).contentFrame();
    await frame.waitForFunction(()=>window.__ppaMap&&window.__ppaMap.getLayer&&window.__ppaMap.getLayer('st-line'),null,{timeout:30000});
    const state=code=>frame.getByRole('combobox',{name:'State'}).selectOption(code);
    // 1. New York: one choice and the parcels with outlines appear as satellite cards.
    await state('NY');
    await frame.locator('#pmStrip .pm-sc').first().waitFor({state:'visible',timeout:20000});
    assert.equal(await frame.locator('#pmStrip .pm-sc').count(),3,'one card per parcel with an outline');
    assert.match(await frame.locator('#pmStrip .pm-strip-h').textContent(),/New York parcels/);
    await frame.locator('#pmStrip .pm-sc img').first().waitFor({state:'attached'});
    await page.waitForTimeout(500);
    assert.ok(imageRequests.length>=1&&imageRequests.every(u=>/World_Imagery/.test(u)),'each card asks for its satellite image');
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
    console.log('PASS: parcel strip for New York (3 outlined parcels), none for Iowa, Florida unchanged');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
