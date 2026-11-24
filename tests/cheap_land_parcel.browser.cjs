// Cheap Land: tapping a parcel shows the dark callout; View parcel turns it into a floating card inside the map (map locked);
// closing brings the callout back. Same flow as the homepage map. Imagery is mocked.
const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});const p=await b.newPage({viewport:{width:390,height:844}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/server.arcgisonline.com/**',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')}));
await p.goto('http://127.0.0.1:8765/land/discover/',{waitUntil:'load'});
await p.selectOption('select >> nth=0','MS');await p.waitForTimeout(6000);
// open the first parcel's callout the way a tap does
const ok=await p.evaluate(()=>{let hit=null;__landMap.eachLayer(l=>{if(!hit&&l.getPopup&&l.getPopup()&&l.getLatLngs)hit=l;});if(!hit)return false;hit.openPopup();return true;});
assert.ok(ok,'a parcel is on the map');
await p.locator('.land-callout .lc').waitFor({state:'visible',timeout:5000});
assert.match(await p.locator('.land-callout').textContent(),/View parcel/);
await p.locator('.lc-view').click();
await p.locator('.land-floating').waitFor({state:'visible',timeout:5000});
await p.waitForTimeout(600);await p.screenshot({path:'/tmp/claude-0/-home-user-vvsodd/bf604de6-2661-56bf-bbdc-299b08c4a426/scratchpad/land-card.png'});
await p.locator('.land-callout').waitFor({state:'detached',timeout:2000});
assert.equal(await p.evaluate(()=>document.getElementById('landmap').contains(document.querySelector('.land-floating'))),true,'the card is inside the map');
assert.equal(await p.evaluate(()=>__landMap.dragging.enabled()),false,'the map is locked while the card is open');
assert.equal(await p.locator('.land-tabs button').count(),4,'Overview, Records, Map Tools, Layers');
await p.locator('.land-explore .tool').first().waitFor({state:'attached',timeout:15000});
assert.ok(await p.locator('.land-explore .tool').count()>=6,'the Explore tools are in the card');
await p.screenshot({path:'/tmp/claude-0/-home-user-vvsodd/bf604de6-2661-56bf-bbdc-299b08c4a426/scratchpad/land-card.png'});
await p.locator('.land-property-heading button').click();
await p.locator('.land-callout .lc').waitFor({state:'visible',timeout:5000});
assert.equal(await p.evaluate(()=>__landMap.dragging.enabled()),true,'the map moves again after closing');
assert.deepEqual(errs,[],'no page errors');
console.log('PASS: Cheap Land parcel callout, floating details card, map lock, close returns the callout');await b.close();})().catch(e=>{console.error(e);process.exit(1);});
