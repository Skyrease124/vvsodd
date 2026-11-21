const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const viewport of [{width:390,height:844},{width:1365,height:900}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:8765/map/',{waitUntil:'domcontentloaded'});
   await page.locator('#pmToolTrigger').waitFor({timeout:20000});
   const button=page.locator('#pmToolTrigger');
   assert.equal(await button.getAttribute('aria-expanded'),'false');
   await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');
   const menu=page.locator('#pmToolMenu');
   await menu.waitFor({state:'visible',timeout:3000});
   for(const label of ['Layers','Filters','Cameras','Hazards']){
     assert.equal(await menu.getByRole('button',{name:new RegExp(label,'i')}).count(),1);
   }
   await menu.getByRole('button',{name:'Layers'}).click();
   await menu.getByRole('button',{name:'Satellite'}).click();
   assert.equal(await button.getAttribute('aria-expanded'),'false');
   await button.click();
   const state=page.getByRole('combobox',{name:'State'});
   await state.selectOption('GA');
   await button.click(); // close if still open
   await button.click();
   assert.equal(await menu.locator('#pmGisButton').textContent(),'GA GIS');
   await state.selectOption('TX');
   assert.equal(await menu.locator('#pmGisButton').textContent(),'TX GIS');
   await state.selectOption('FL');
   assert.equal(await menu.locator('#pmGisButton').textContent(),'FL GIS');
   assert.equal(errors.filter(e=>/ReferenceError|TypeError|SyntaxError/.test(e)).length,0,errors.join('; '));
   await page.close();
  }
  const home=await browser.newPage({viewport:{width:390,height:844}});
  await home.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
  const frame=home.frameLocator('iframe[src*="/map/?embed=1&home=1"]');
  await frame.locator('#pmToolTrigger').waitFor({timeout:20000});
  await frame.locator('#pmToolTrigger').click();
  await frame.locator('#pmToolMenu').waitFor({state:'visible',timeout:3000});
  await frame.locator('#pmToolTrigger').click();
  assert.equal(await frame.locator('#pmToolTrigger').getAttribute('aria-expanded'),'false');
  await home.close();
  console.log('PASS: mobile 390px, desktop 1365px, home embedded map.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
