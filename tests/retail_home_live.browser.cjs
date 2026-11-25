// Retail home: signed-in members see the real Retail Alerts products with their store links; visitors keep the demo cards.
const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
for(const signedIn of [true,false]){
 const p=await b.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/.netlify/functions/account',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(signedIn?{user:{email:'a@b.c'}}:{})}));
 await p.route('**/.netlify/functions/retail**',r=>signedIn?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,inStock:[{id:'p1',name:'Pokemon TCG Booster Bundle',retailerName:'Amazon',retailer:'amazon',category:'cards',status:'in_stock',price:31.99,buyUrl:'https://www.amazon.com/dp/B000TEST?tag=x'}],upcoming:[{id:'p2',name:'Elite Trainer Box',retailerName:'Amazon',category:'cards',status:'upcoming',buyUrl:'https://www.amazon.com/dp/B000TEST2'}],other:[]})}):r.fulfill({status:401,contentType:'application/json',body:'{"ok":false,"signin":true}'}));
 await p.goto('http://127.0.0.1:8765/price-pocket-retail/',{waitUntil:'load'});await p.waitForTimeout(1200);
 const names=await p.locator('.pprt-item h3').allTextContents();const links=await p.locator('.pprt-link').evaluateAll(a=>a.map(x=>x.href));
 if(signedIn){assert.deepEqual(names,['Pokemon TCG Booster Bundle'],'In Stock Now shows the in-stock product');assert.equal(links.length,1,'each has its store link');assert.ok(links[0].includes('amazon.com'));assert.match(await p.locator('.pprt-notice').textContent(),/Live products/);
  // tabs: upcoming shows only the upcoming drop
  await p.click('#pprtTabs [data-tab=upcoming]');assert.deepEqual(await p.locator('.pprt-item h3').allTextContents(),['Elite Trainer Box']);
  await p.click('#pprtTabs [data-tab=stock]');
  // account menu opens on the page and never navigates away
  const url=p.url();await p.click('#pprtAccount');assert.equal(await p.locator('#pprtMenu').isVisible(),true,'menu opens');assert.equal(p.url(),url,'stays on Retail');
  assert.deepEqual(await p.locator('#pprtMenu button').allTextContents(),['My watchlist','Alerts','Alert settings','Sign out']);
  await p.click('#pprtMenu button:has-text("My watchlist")');assert.equal(await p.locator('#pprtTabs [data-tab=watch]').getAttribute('aria-selected'),'true');assert.ok(p.url().includes('price-pocket-retail'));
  // alerts sheet opens in place
  await p.click('#pprtBell');assert.equal(await p.locator('.pprt-sheet h3').first().textContent(),'Alerts');
  }
 else{assert.ok(names.some(n=>/Sample/.test(n)),'visitors keep the demo cards');assert.equal(links.length,0);}
 assert.deepEqual(errs,[]);await p.close();}
console.log('PASS: Retail home shows live products with links for members, demo for visitors');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
