import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import * as sources from '../../netlify/lib/owner-intelligence-sources.mjs';
import {sourceCooldown} from '../../netlify/lib/owner-firecrawl-quota.mjs';
import {parcelReferences,linkParcels,saveSourceLead} from '../../netlify/lib/brain-source-leads.mjs';
const source={id:'palm-beach-tax',county:'Palm Beach',url:'https://www.pbctax.gov/'};
const dataset={id:'FL-palm-beach',state:'FL',county:'Palm Beach County',recs:[{i:'r1',p:'001-234'}]};
test('only explicitly labeled parcel IDs join unique records in the matching state and county',()=>{
 assert.deepEqual(parcelReferences('Notice 2026-11-21. Amount 1234. Parcel ID: 001-234;'),['001-234']);
 assert.equal(linkParcels(source,['001234'],dataset).length,1);
 for(const d of [{...dataset,state:'GA'},{...dataset,county:'Other'},{...dataset,recs:[...dataset.recs,...dataset.recs]}])assert.equal(linkParcels(source,['001234'],d).length,0);
 assert.equal(linkParcels(source,['00123'],dataset).length,0);
});
test('saved source leads fill provenance and parcel cases while preserving pause and existing review',async()=>{
 const saved=new Map();const api={kvGet:async k=>structuredClone(saved.get(k)),kvPut:async(k,v)=>saved.set(k,structuredClone(v))};
 const record={checkedAt:new Date().toISOString(),excerpt:'Parcel number: 001-234',hash:'one',changed:true};
 await saveSourceLead(source,record,api,async()=>dataset);
 const queue=saved.get('owner-brain-scanner-v1');assert.equal(queue.queue.length,1);assert.equal(queue.queue[0].sourceLead.url,source.url);assert.equal(queue.queue[0].review,undefined);
 queue.queue[0].review={decision:'rejected'};saved.set('owner-brain-scanner-v1',queue);
 await saveSourceLead(source,record,api,async()=>dataset);assert.equal(saved.get('owner-brain-scanner-v1').queue.length,1);assert.equal(saved.get('owner-brain-scanner-v1').queue[0].review.decision,'rejected');
 saved.set('owner-brain-scanner-v1',{status:'paused',queue:[]});await saveSourceLead(source,record,api,async()=>dataset);assert.equal(saved.get('owner-brain-scanner-v1').queue.length,0);
});
test('scheduled monitor needs no owner session, scans only an allowlisted free source, and honors cooldown',async()=>{
 const saved=new Map(),requests=[];const context=vm.createContext({URL,AbortSignal,console,fetch:async url=>{
  requests.push(url);assert.ok(sources.SOURCE_REGISTRY.some(s=>s.url===url));
  return {ok:true,status:200,headers:new Headers({'content-type':'text/html'}),text:async()=>'<p>'+('County tax notices and current office information. '.repeat(5))+'</p>'};
 }});
 const modules={};
 function stub(name,values){modules[name]=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});}
 stub('node:crypto',{default:crypto});stub('../lib/brain-auth.mjs',{kvGet:async k=>structuredClone(saved.get(k)),kvPut:async(k,v)=>saved.set(k,structuredClone(v)),withBrainStore:h=>h});
 stub('../lib/owner-intelligence-sources.mjs',sources);stub('../lib/owner-firecrawl-quota.mjs',{sourceCooldown});stub('../lib/brain-source-leads.mjs',{saveSourceLead});
 const mod=new vm.SourceTextModule(fs.readFileSync('netlify/functions/owner-intelligence-auto.mjs','utf8'),{context});await mod.link(s=>modules[s]);await mod.evaluate();
 await mod.namespace.default();assert.equal(requests.length,1);assert.equal(saved.get('brain-source-monitor-status-v1').checked,1);
 const src=sources.SOURCE_REGISTRY[0];assert.equal(saved.get(sources.researchKey(src.id)).actor,'scheduled-source-monitor');assert.equal(saved.get('brain-source-events-v1').entries[0].status,'source_lead_only');
 saved.set('brain-source-monitor-status-v1',{cursor:0,runs:1});await mod.namespace.default();assert.equal(requests.length,1);
 saved.set('owner-brain-scanner-v1',{status:'paused'});await mod.namespace.default();assert.equal(requests.length,1);assert.equal(saved.get('brain-source-monitor-status-v1').state,'paused');
});
test('map bounds include a newly verified polygon when the original county index had no bounds',()=>{
 const js=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');const body=js.match(/function fitBB\(ds\) \{([\s\S]*?)\n  \}/)[0];
 const fit=vm.runInNewContext('('+body+')');const result=fit({meta:{bb:null},recs:[{cx:[-83.1,42.3],bb:[-83.11,42.29,-83.09,42.31]}]});
 assert.equal(JSON.stringify(result),'[-83.11,42.29,-83.09,42.31]');
});
test('map library uses the fallback CDN after a failed download',async()=>{
 const js=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
 const body=js.match(/async function loadLib\(\) \{([\s\S]*?)\n  \}\n  function afterAccount/)[0].replace(/\n  function afterAccount$/,'');
 const window={},requested=[];
 const context={window,console:{warn:()=>{}},setTimeout:()=>1,clearTimeout:()=>{},document:{createElement:()=>({remove:()=>{}}),head:{appendChild:script=>{
  requested.push(script.src);if(requested.length===1)script.onerror();else{window.maplibregl={Map:function(){}};script.onload();}
 }}}};
 const load=vm.runInNewContext('('+body+')',context);await load();
 assert.equal(requested.length,2);assert.match(requested[1],/cdn\.jsdelivr\.net/);
});
