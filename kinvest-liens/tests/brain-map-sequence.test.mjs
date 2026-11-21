import test from 'node:test';
import assert from 'node:assert/strict';
import {activeCounty,rankedCounties} from '../../netlify/lib/brain-county-sequence.mjs';
const dataset=(id,records,mapped=0)=>({id,file:id+'.json',records,mapped});
const index={datasets:[dataset('FL-santa-rosa',1950,217),dataset('GA-bibb',1762),dataset('MS-hinds',2072),dataset('MI-wayne',4161),dataset('AZ-cochise',11132,10710)]};
function store(){const m=new Map();return {m,kvGet:async k=>structuredClone(m.get(k)),kvPut:async(k,v)=>m.set(k,structuredClone(v))};}
test('queue begins with largest missing county then keeps exact same order across runs',async()=>{
 const h=store();
 const first=await activeCounty(index,h);assert.equal(first.dataset.id,'MI-wayne');
 assert.equal(first.orderPosition,1);assert.equal(first.remaining,4161);
 const reverse={datasets:[...index.datasets].reverse()};
 assert.equal((await activeCounty(reverse,h)).dataset.id,'MI-wayne');
 const order=h.m.get('owner-brain-county-order-v1').order;
 assert.deepEqual(order.slice(0,4),['MI-wayne','MS-hinds','GA-bibb','FL-santa-rosa']);
});
test('address research and unverified point candidates do not complete a county',async()=>{
 const h=store();
 h.m.set('brain-map-county-v1-MI-wayne',{records:{a:{i:'a',verifiedGeometry:false,cx:[-83,42]}}});
 const current=await activeCounty(index,h);
 assert.equal(current.dataset.id,'MI-wayne');assert.equal(current.remaining,4161);
 assert.equal(current.blocked,false);
});
test('verified patches cannot advance without complete original-record reconciliation',async()=>{
 const h=store(),i={datasets:[dataset('MI-wayne',2,1),dataset('MS-hinds',5)]};
 h.m.set('brain-map-county-v1-MI-wayne',{records:{b:{i:'b',verifiedGeometry:true,g:[[[1,2]]]}}});
 assert.equal((await activeCounty(i,h)).dataset.id,'MI-wayne');
 assert.equal((await activeCounty(i,h,async()=>({recs:[{i:'a',g:[[[1,2]]]},{i:'b'}]}))).dataset.id,'MS-hinds');
 assert.equal((await activeCounty(i,h,async()=>({recs:[{i:'a',g:[[[1,2]]]},{i:'unknown'}]}))).dataset.id,'MI-wayne');
});
test('future unsupported county remains blocked instead of being silently skipped',async()=>{
 const h=store(),i={datasets:[dataset('MS-hinds',5),dataset('GA-bibb',3)]};
 const x=await activeCounty(i,h);
 assert.equal(x.dataset.id,'MS-hinds');assert.equal(x.blocked,true);
 assert.match(x.blocker,/connector not yet configured/i);
});
test('invalid dataset paths never enter county research order',()=>{
 assert.equal(rankedCounties({datasets:[dataset('MI-wayne',3),{id:'../../foo',file:'foo.json',records:3,mapped:0}]}).length,1);
});
