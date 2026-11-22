// Optional real-browser regression: requires Playwright and Chromium.
// Run from the repository root: node kinvest-liens/tests/county-connectors-mobile.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');

const root = 'kinvest-liens/owner/brain/connectors/';
const origin = 'https://deploy-preview-454--pricepocketasset.netlify.app';
const api = '/.netlify/functions/';
const at = '2026-11-22T02:00:00Z';
const long = 'Recorded descriptions need to wrap: ' + 'x'.repeat(450);
const county = {id:'CO-larimer',state:'CO',county:'Larimer',status:'Testing',source:'https://records.example/'+long};
const wayne={id:'MI-wayne',state:'MI',county:'Wayne',status:'Verified',source:'https://gis.example/wayne',
 operation:{mode:'existing-worker'}};
const miami={id:'FL-miami-dade',state:'FL',county:'Miami-Dade',status:'Researching',source:'https://gis.example/miami',
 operation:{mode:'pilot-prepared'}};
const broward={id:'FL-broward',state:'FL',county:'Broward',status:'Researching',source:'https://gis.example/broward',
 operation:{mode:'pilot-prepared',attribution:'Broward County Property Appraiser'}};
const palm={id:'FL-palm-beach',state:'FL',county:'Palm Beach',status:'Researching',source:'https://gis.example/palm',
 operation:{mode:'pilot-prepared',attribution:'Palm Beach County Property Appraiser'}};
const santa={...palm,id:'FL-santa-rosa',county:'Santa Rosa'};
county.operation={mode:'research-only'};
const coverage = {available:1831,mapped:1790,verified:0,remaining:41,completion:0};
const research = {
 paused:false,status:'Document Found',recordedDocument:null,relationship:null,evidenceComplete:false,
 planningTestStatus:'completed',researchBusy:false,sourceProgress:{reviewed:0,total:3},
 missing:['Recorded plat and Assessor history'],
 sources:[{url:county.source,authority:'Larimer County Assessor',limit:2,data:'Parcel and account search'}],
 evidence:[
  {authority:'Fort Collins Planning',url:county.source,at,outcome:'document',document:{reference:'BDR240012',decision:'approved',decisionDate:'11/13/2024',legalDescription:long}},
  {authority:'Prior preview result',url:county.source,at,outcome:'metadata',metadata:{title:'Access instructions'},document:null}
 ],
 events:[{at,sourceId:'fort_collins_planning',outcome:'document',httpStatus:200}],
 audit:[{authority:'Fort Collins Planning',reserved:1,completed:1,upstreamResponses:1,remaining:0,endpoint:county.source,
  nextAction:'Recorded plat needed',receipts:[{endpoint:county.source,at,outcome:'document',httpStatus:200,
   dataType:'planning_record',document:{reference:'BDR240012'},usefulness:'Planning evidence only'}]}],
 documentPlans:[{authority:'Larimer County Recorder',url:county.source,field:'subdivision',term:'Glover Estate',
  evidence:'Recorded plat index',restriction:'Authorized access required for images'}],
 nextSource:{id:'assessor',authority:'Larimer County Assessor',used:0,limit:2}
};
const original={parcelId:'9701400014',schedule:'0155675'};
const candidate={parcelId:'9701484001',schedule:'1688587'};
const trial={used:3,limit:3,cursor:0,parcelIds:['9701400014'],evidence:[],retry:{
 recordId:original.parcelId,reason:'No exact match',exhausted:true,source:county.source,checkedAt:at,
 diagnostics:{stage:'match count',resultCount:0}
},reconciliationCases:[{dataset:'CO-larimer',status:'unresolved_owner_review',original,candidate,
 sources:[{authority:'Official record',url:county.source,finding:long}],missingEvidence:['Recorded plat']}]};

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',
  headless:true,timeout:15000,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking']});
 try{
  for(const width of [320,375,390,430,1280]){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,deviceScaleFactor:2,hasTouch:true});
   const page=await context.newPage();
   const posts=[],unexpected=[],errors=[];
   let paused=false,used=0,approve=false;
   page.on('pageerror',error=>errors.push(error.message));
   page.on('dialog',dialog=>approve?dialog.accept():dialog.dismiss());
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname;
    if(url.origin!==origin){unexpected.push(request.url());return route.abort();}
    const base='/owner/brain/connectors/';
    if(path===base)return route.fulfill({contentType:'text/html',body:await fs.readFile(root+'index.html','utf8')});
    if(path===base+'dashboard.js')return route.fulfill({contentType:'text/javascript',body:await fs.readFile(root+'dashboard.js','utf8')});
    if(path===base+'dashboard.css')return route.fulfill({contentType:'text/css',body:await fs.readFile(root+'dashboard.css','utf8')});
    if(path===api+'owner-brain-connectors'){
     if(!url.search)return route.fulfill({json:{counties:[county,wayne,miami,broward,palm,santa]}});
     const selected=url.searchParams.get('dataset')==='MI-wayne'?wayne:url.searchParams.get('dataset')==='FL-miami-dade'?miami:url.searchParams.get('dataset')==='FL-broward'?broward:url.searchParams.get('dataset')==='FL-palm-beach'?palm:url.searchParams.get('dataset')==='FL-santa-rosa'?santa:county;
     return route.fulfill({json:{county:selected,coverage,operation:{...selected.operation,pendingReview:3,
      progress:{total:100,pending:10,verified:75,verifiedPercent:75,processingPercent:90},quota:{used:21,limit:30}}}});
    }
    if(path===api+'owner-brain-county-pilot'&&['FL-palm-beach','FL-santa-rosa'].includes(url.searchParams.get('dataset')))
     return route.fulfill({json:{county:url.searchParams.get('dataset')==='FL-santa-rosa'?'Santa Rosa':'Palm Beach',eligible:0,processed:0,verifiedEvidence:0,published:0,
      active:false,runAllowed:false,sharedRemaining:30,countyRemaining:3,pilotLimit:3,nativeWkid:6439,
      blockers:['No eligible unmapped county parcel with a usable situs address'],review:{}}});
    if(path===api+'owner-brain-county-pilot'&&url.searchParams.get('dataset')==='FL-broward')
     return route.fulfill({json:{county:'Broward',eligible:0,processed:0,verifiedEvidence:0,published:0,active:false,
      runAllowed:false,sharedRemaining:30,countyRemaining:3,pilotLimit:3,nativeWkid:6439,
      blockers:['No approved county parcel dataset is loaded'],review:{}}});
    if(path===api+'owner-brain-county-pilot')return route.fulfill({json:{eligible:10,processed:3,verifiedEvidence:1,published:0,
     active:false,sharedRemaining:28,countyRemaining:1,pilotLimit:3,
     blockers:['Owner approval for a live pilot is pending'],review:{0:{parcelId:'0007',reason:'No official match',checkedAt:at}}}});
    if(path===api+'owner-brain-larimer-trial'&&request.method()==='GET')return route.fulfill({json:trial});
    if(path===api+'owner-brain-reconciliation-research'){
     if(request.method()==='POST'){
      const body=request.postDataJSON();posts.push(body);
      if(body.action==='pause')paused=true;
      else if(body.action==='resume')paused=false;
      else if(body.action==='run-next-source')used++;
      else unexpected.push(body.action);
      return route.fulfill({json:{status:'metadata'}});
     }
     return route.fulfill({json:{...research,paused,nextSource:{...research.nextSource,used},
      events:used?[...research.events,{at,sourceId:'assessor',outcome:'metadata',httpStatus:200}]:research.events}});
    }
    if(path!=='/favicon.ico')unexpected.push(path);
    return route.fulfill({status:404});
   });
   await page.goto(origin+'/owner/brain/connectors/');
   const state=page.locator('#county-state'),mode=page.locator('#county-mode');
   await state.selectOption('FL');
   await page.locator('#county').selectOption('FL-santa-rosa');
   await page.getByRole('button',{name:'Run Live Santa Rosa Pilot'}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Run Live Santa Rosa Pilot'}).isDisabled(),true);
   await page.getByRole('button',{name:'Check Readiness'}).click();
   await page.getByText('No eligible unmapped county parcel with a usable situs address').waitFor();
   assert.deepEqual(posts,[]);
   await page.locator('#county').selectOption('FL-palm-beach');
   await page.getByText('No eligible unmapped county parcel with a usable situs address').waitFor();
   assert.equal(await page.getByRole('button',{name:'Run Live Palm Beach Pilot'}).isDisabled(),true);
   await page.getByRole('button',{name:'Check Readiness'}).click();
   await page.getByText(/Native EPSG:6439/).waitFor();
   assert.deepEqual(posts,[]);
   await page.locator('#county').selectOption('FL-broward');
   await page.getByText('No approved county parcel dataset is loaded',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Run Live Broward Pilot'}).isDisabled(),true);
   await page.getByRole('button',{name:'Check Readiness'}).click();
   await page.getByText(/Native EPSG:6439/).waitFor();
   assert.deepEqual(posts,[]);
   await page.locator('#county').selectOption('FL-miami-dade');
   await page.getByRole('heading',{name:'County pilot controls'}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Run Live Miami-Dade Pilot'}).isDisabled(),true);
   assert.match(await page.getByText(/Verified map polygons 0/).textContent(),/Eligible 10 · Processed 3/);
   await page.getByRole('button',{name:'Check Readiness'}).click();
   await page.getByText(/WGS84 Not validated live/).waitFor();
   assert.deepEqual(posts,[]);
   await page.getByText('Skipped parcels awaiting review').click();
   assert.equal(await page.getByRole('button',{name:'Retry parcel',exact:true}).isDisabled(),true);
   await state.selectOption('MI');
   await page.getByRole('heading',{name:'MI · Wayne'}).waitFor();
   await mode.selectOption('research-only');
   await page.getByText('No counties match these filters.').waitFor();
   await state.selectOption('CO');
   const countyName=page.locator('#county-name');
   await countyName.fill('larimer');
   await countyName.press('Tab');
   await page.getByRole('heading',{name:'CO · Larimer'}).waitFor();
   const run=page.getByRole('button',{name:'Run Next Research Source'});
   await run.waitFor();
   assert.equal(await run.isEnabled(),true);
   assert.equal(await page.getByRole('button',{name:'Run One Research Test'}).count(),0);
   assert.equal(posts.length,0,'page load may only read existing status');
   assert.equal(await page.locator('#status').textContent(),'');
   for(const label of ['Research audit · saved receipts','Parcel Document Search · disabled','Official research sources','Saved research evidence','Research activity','9701400014 · Owner review','GIS evidence and diagnostics']){
    const disclosure=page.locator('summary').filter({hasText:label});
    await disclosure.click();
   }
   assert.equal(await page.getByText(/Larimer County Assessor.*Budget: 2/).count(),1);
   assert.equal(await page.getByText(/Reference BDR240012/).count(),1);
   assert.equal(await page.getByText(/1 reserved · 1 completed · 1 upstream responses/).count(),1);
   assert.equal(await page.getByText(/Search subdivision Glover Estate/).count(),1);
   assert.equal(await page.locator('.timeline').getByText(/fort_collins_planning/).count(),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'horizontal overflow');
   await run.click();
   assert.equal(posts.length,0,'cancelled confirmation must not dispatch');
   approve=true;
   await run.click();
   await page.getByText(/1\/2 requests reserved/).waitFor();
   assert.deepEqual(posts,[{action:'run-next-source',confirmed:true,sourceId:'assessor',used:0}]);
   await page.getByRole('button',{name:'Pause research queue'}).click();
   await page.getByRole('button',{name:'Resume research queue'}).waitFor();
   assert.equal(await run.isDisabled(),true);
   await page.getByRole('button',{name:'Resume research queue'}).click();
   await page.getByRole('button',{name:'Pause research queue'}).waitFor();
   assert.equal(await run.isEnabled(),true);
   assert.deepEqual(posts.map(p=>p.action),['run-next-source','pause','resume']);
   assert.deepEqual(errors,[]);
   assert.deepEqual(unexpected,[]);
   console.log(width+'px PASS: saved evidence, source budget, timeline, zero load writes, confirm/cancel, pause/resume, no overflow');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
