(()=>{'use strict';const $=id=>document.getElementById(id),state=$('state'),county=$('county'),results=$('results'),status=$('status');let records=[];const text=(tag,value,cls)=>{const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;};const label=c=>c.county+', '+c.state;const format=n=>Number(n||0).toLocaleString('en-US');function fillCounties(){const selected=state.value;const previous=county.value;county.replaceChildren(new Option('All counties',''));const names=[...new Set(records.filter(c=>!selected||c.state===selected).map(c=>c.county))].sort();for(const name of names)county.add(new Option(name,name));county.value=names.includes(previous)?previous:'';}
// Reuse the same Mississippi parcel datasets as Map Plus AI. These are research records,
// not verified active offers. County valuation is never displayed as a purchase price.
let msIndex=null,msCache=new Map(),msRequest=0;
async function showMississippiParcels(){
 const target=document.getElementById('ms-parcel-results');if(!target)return;
 const request=++msRequest;target.replaceChildren(text('p','Loading Mississippi parcel records from the shared map…','muted'));
 try{
  if(!msIndex){const r=await fetch('/map/index.json');if(!r.ok)throw Error('Map index unavailable');msIndex=(await r.json()).datasets.filter(d=>d.state==='MS'&&d.cats?.land_bank);}
  const selected=msIndex.filter(d=>!county.value||String(d.county).toLowerCase().replace(/county/g,'').replace(/[^a-z]/g,'')===String(county.value).toLowerCase().replace(/county/g,'').replace(/[^a-z]/g,''));
  const found=[];let total=0;
  for(const d of selected){
   let data=msCache.get(d.file);
   if(!data){const r=await fetch('/map/data/'+encodeURIComponent(d.file));if(!r.ok)continue;data=await r.json();msCache.set(d.file,data);}
   const items=(data.recs||[]).filter(p=>p.c==='land_bank'||data.kind==='state-held-land');
   total+=items.length;
   for(const p of items){if(found.length<100)found.push({p,d,data});}
  }
  if(request!==msRequest||state.value!=='MS')return;
  target.replaceChildren();
  target.append(text('h2','Mississippi tax-forfeited parcel records'),text('p',format(total)+' individual parcel records in the shared map datasets'+(county.value?' for '+county.value:'')+'. Research leads only; current purchase eligibility and asking price are unconfirmed.','muted'));
  if(!found.length){target.append(text('p','No individual parcel rows were found for this selection.','empty'));return;}
  for(const {p,d,data} of found){
   const card=text('article','','landcard');
   const parcel=String(p.p||p.i?.split('|')[2]||'');
   card.append(text('h2','Parcel '+parcel),text('p',d.county+', Mississippi'));
   if(p.ac!=null)card.append(text('p','Acreage: '+p.ac));
   const value=p.mv??p.av;
   if(value!=null)card.append(text('p','County value (not purchase price): $'+format(value)));
   card.append(text('p','Tax-forfeited / state-held · Purchase status unconfirmed','muted'));
   const source=(data.sources||[])[0];
   if(/^https:\/\//.test(source||'')){const a=text('a','Check official Mississippi land source');a.href=source;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
   const link=text('button','View parcel');link.type='button';link.onclick=()=>openLandProperty(p,d);card.append(link);
   target.append(card);
  }
  if(total>found.length)target.append(text('p','Showing the first '+found.length+' of '+format(total)+' parcels. Select a county to narrow the list.','muted'));
 }catch(e){if(request===msRequest)target.replaceChildren(text('p','Parcel data could not be loaded. County source records remain below.','muted'));}
}
function refreshMississippiParcels(){
 let target=document.getElementById('ms-parcel-results');
 if(state.value!=='MS'){++msRequest;if(target)target.remove();return;}
 if(!target){target=document.createElement('section');target.id='ms-parcel-results';results.parentNode.insertBefore(target,results);}
 void showMississippiParcels();
}

let landDetailMap=null;
function openLandProperty(parcel,dataset){
 const existing=document.getElementById('land-property-dialog');if(existing)existing.remove();
 const shade=document.createElement('div');shade.id='land-property-dialog';shade.className='land-property-shade';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-label','Land parcel details');
 const panel=document.createElement('section');panel.className='land-property-panel';shade.append(panel);
 const heading=document.createElement('div');heading.className='land-property-heading';
 const title=text('h2','Parcel '+String(parcel.p||'Unknown'));const close=text('button','×');close.type='button';close.setAttribute('aria-label','Close parcel details');close.onclick=()=>shade.remove();heading.append(title,close);panel.append(heading);
 const subtitle=text('p',dataset.county+', '+dataset.state+' · '+(parcel.ac!=null?parcel.ac+' acres':'Acreage unavailable'));panel.append(subtitle);
 const photo=document.createElement('div');photo.className='land-property-map';panel.append(photo);
 const facts=document.createElement('div');facts.className='land-property-facts';
 const addFact=(name,value)=>{const item=document.createElement('div');item.append(text('small',name),text('strong',String(value??'Not on file')));facts.append(item);};
 addFact('Parcel ID',parcel.p);addFact('Acreage',parcel.ac!=null?parcel.ac+' acres':'Not on file');addFact('County value (not sale price)',parcel.mv!=null?'const visible=records.filter(c=>(!state.value||c.state===state.value)&&(!county.value||c.county===county.value)).sort((a,b)=>(Number(b.open)||0)-(Number(a.open)||0));results.replaceChildren();refreshMississippiParcels();const maxPrice=Number(document.getElementById('maxprice').value),minAcres=Number(document.getElementById('minacres').value);if(maxPrice||minAcres){status.textContent='Price and acreage filters require verified parcel-level records; no qualifying individual parcel data is available in this source index.';results.append(text('p','Individual parcels with verified price and acreage have not been imported. Clear those filters to browse county inventory sources.','empty'));return;}status.textContent=visible.length+' government land inventory sources found'+(state.value?' for '+state.options[state.selectedIndex].text:'')+'. Availability not confirmed.';if(!visible.length){results.append(text('p','No state-held land records are currently tracked for this selection. This does not mean no land is for sale.','empty'));return;}for(const c of visible.slice(0,100)){const card=text('article','', 'landcard');card.append(text('h2',label(c)),text('p',format(c.open)+' records on the last indexed government list'),text('p','Source checked: '+(c.checked||'date unavailable'),'muted'));if(c.priceLabel)card.append(text('p',c.priceLabel,'muted'));if(/^https:\/\//.test(c.source||'')){const a=text('a','Open official government source');a.href=c.source;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}results.append(card);}if(visible.length>100)results.append(text('p','Showing first 100 sources. Select a state or county to narrow the list.','muted'));}const stateFips={AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56'};
const normalize=s=>String(s||'').toLowerCase().replace(/\\b(county|parish|borough|municipality|census area|city of|division)\\b/g,'').replace(/\\([^)]*\\)/g,'').replace(/[^a-z0-9]/g,'');
let map=null,geometry=null,markers=[],recordPins=new Map(),stateBorders=null;
let landParcelLayer=null,landParcelRequest=0,parcelIndex=null,parcelCache=new Map(),parcelCanvas=null;
let parcelIndexPromise=null,parcelPending=new Map(),parcelRenderTimer=null;
function getParcelIndex(){
 if(parcelIndex)return Promise.resolve(parcelIndex);
 if(!parcelIndexPromise)parcelIndexPromise=fetch('/map/index.json').then(r=>{if(!r.ok)throw Error('Parcel index unavailable');return r.json();}).then(j=>parcelIndex=j.datasets.filter(d=>['MS','AL','AR'].includes(d.state)&&d.cats?.land_bank)).catch(e=>{parcelIndexPromise=null;throw e;});
 return parcelIndexPromise;
}
function getParcelData(file){
 if(parcelCache.has(file))return Promise.resolve(parcelCache.get(file));
 if(parcelPending.has(file))return parcelPending.get(file);
 const task=fetch('/map/data/'+encodeURIComponent(file)).then(r=>{if(!r.ok)throw Error('Parcel data unavailable');return r.json();}).then(d=>{parcelCache.set(file,d);return d;}).finally(()=>parcelPending.delete(file));
 parcelPending.set(file,task);return task;
}
async function renderLandParcels(){
 const token=++landParcelRequest;
 if(!map||!['MS','AL','AR'].includes(state.value)||map.getZoom()<6){
  if(landParcelLayer){landParcelLayer.remove();landParcelLayer=null;}return;
 }
 const caption=document.getElementById('mapcaption'),stateCode=state.value,view=map.getBounds(),zoom=map.getZoom();
 caption.textContent='Loading mapped '+stateNames[stateCode]+' parcels…';
 try{
  const index=await getParcelIndex();if(token!==landParcelRequest)return;
  const datasets=index.filter(d=>d.state===stateCode&&d.mapped&&d.bb&&(!county.value||normalize(d.county)===normalize(county.value))&&view.intersects(L.latLngBounds([d.bb[1],d.bb[0]],[d.bb[3],d.bb[2]])));
  const layer=L.featureGroup(),oldLayer=landParcelLayer;
  let count=0,centers=0,completed=0;
  // Keep existing geometry visible while the next viewport loads.
  const updateCaption=()=>{if(token===landParcelRequest)caption.textContent=count+' mapped state-held parcels in view'+(centers?' · '+centers+' tiny parcels highlighted':'')+(completed<datasets.length?' · loading '+completed+'/'+datasets.length+' counties…':' · availability unconfirmed');};
  const drawDataset=(dataset,data)=>{
   for(const parcel of data.recs||[]){
    if(parcel.c!=='land_bank'||!Array.isArray(parcel.g)||!parcel.g.length)continue;
    const center=Array.isArray(parcel.cx)?[parcel.cx[1],parcel.cx[0]]:null;
    if(center&&!view.contains(center))continue;
    const rings=parcel.g.map(ring=>ring.map(point=>[point[1],point[0]]));
    const bounds=L.latLngBounds(rings.flat());if(!view.intersects(bounds))continue;
    const popup=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('p'),link=document.createElement('a');
    title.textContent='Parcel '+(parcel.p||'unknown');detail.textContent=dataset.county+(parcel.ac!=null?' · '+parcel.ac+' acres':'')+' · Sale status unconfirmed';
    link.textContent='View parcel';link.href='#land-property-dialog';link.addEventListener('click',event=>{event.preventDefault();openLandProperty(parcel,dataset);});
    popup.append(title,detail,link);
    L.polygon(rings,{color:'#a4ffe1',weight:zoom<9?2.5:2,fillColor:'#12b981',fillOpacity:0.46,renderer:parcelCanvas||(parcelCanvas=L.canvas({padding:0.25}))}).bindPopup(popup).addTo(layer);
    const nw=map.latLngToContainerPoint(bounds.getNorthWest()),se=map.latLngToContainerPoint(bounds.getSouthEast());
    if(Math.max(Math.abs(nw.x-se.x),Math.abs(nw.y-se.y))<9&&center){
     L.circleMarker(center,{radius:zoom<8?3.5:2.5,color:'#d9fff1',weight:1,fillColor:'#31e6b1',fillOpacity:0.9,renderer:parcelCanvas}).bindPopup(popup.cloneNode(true)).addTo(layer);centers++;
    }
    count++;
   }
  };
  // Cached counties paint immediately. Missing counties download concurrently
  // with a bounded worker pool, rather than blocking the whole map serially.
  const cached=datasets.filter(d=>parcelCache.has(d.file));
  const missing=datasets.filter(d=>!parcelCache.has(d.file));
  for(const d of cached){drawDataset(d,parcelCache.get(d.file));completed++;}
  if(token!==landParcelRequest)return;
  landParcelLayer=layer.addTo(map);if(oldLayer)oldLayer.remove();updateCaption();
  let next=0;
  const worker=async()=>{
   while(next<missing.length){
    const dataset=missing[next++];
    try{const data=await getParcelData(dataset.file);if(token!==landParcelRequest)return;drawDataset(dataset,data);}
    catch(e){/* One unavailable county must not block the other counties. */}
    if(token!==landParcelRequest)return;
    completed++;updateCaption();
   }
  };
  await Promise.all(Array.from({length:Math.min(5,missing.length)},()=>worker()));
  if(token===landParcelRequest)updateCaption();
 }catch(error){if(token===landParcelRequest)caption.textContent='Parcel geometry unavailable · browse government sources below';}
}
function clearMarkers(){for(const m of markers)m.remove();markers=[];recordPins.clear();}
function inside(p,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function centerOf(g){const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];let best=null,area=-1;for(const poly of polygons){const ring=poly[0];if(!ring?.length)continue;const xs=ring.map(x=>x[0]),ys=ring.map(x=>x[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);const size=(xmax-xmin)*(ymax-ymin);if(size<area)continue;let point=null;for(let n=0;n<12&&!point;n++)for(let i=0;i<12&&!point;i++)for(let j=0;j<12&&!point;j++){const x=xmin+(i+.5)*(xmax-xmin)/12,y=ymin+(j+.5)*(ymax-ymin)/12;if(inside([x,y],ring)&&!poly.slice(1).some(h=>inside([x,y],h)))point=[x,y];}if(point){best=point;area=size;}}return best;}
const stateCenters={AL:[32.65,-86.8],AR:[34.85,-92.4],MS:[32.75,-89.65]};
const stateNames={AL:'Alabama',AR:'Arkansas',MS:'Mississippi'};
function drawLandMap(fit=false){if(!map)return;clearMarkers();const selected=records.filter(c=>(!state.value||c.state===state.value)&&(!county.value||c.county===county.value));const grouped=new Map();for(const c of selected){if(!grouped.has(c.state))grouped.set(c.state,[]);grouped.get(c.state).push(c);}
const detail=map.getZoom()>=7||!!county.value;const bounds=[];let located=0;
for(const [code,items] of grouped){if(['MS','AL','AR'].includes(state.value)&&map.getZoom()>=6)continue;if(!detail){const center=stateCenters[code];if(!center)continue;const count=items.reduce((n,c)=>n+(Number(c.open)||0),0);const html='<span class="land-state-pin"><b>'+stateNames[code]+'</b><small>'+format(count)+' land records · '+items.length+' sources</small></span>';const marker=L.marker(center,{icon:L.divIcon({className:'land-marker-wrap',html,iconSize:[166,50],iconAnchor:[83,25]})}).addTo(map);marker.bindTooltip(stateNames[code]+' · '+format(count)+' government land records');marker.on('click',()=>{state.value=code;fillCounties();render();map.setView(center,7,{animate:true});drawLandMap();});markers.push(marker);bounds.push(center);located+=items.length;}else{for(const c of items){const feature=geometry?.get(stateFips[c.state]+':'+normalize(c.county));const point=feature?centerOf(feature.geometry):null;if(!point)continue;const marker=L.marker([point[1],point[0]],{icon:L.divIcon({className:'land-marker-wrap',html:'<span class="land-county-pin">'+format(c.open)+'</span>',iconSize:[40,40],iconAnchor:[20,20]})}).addTo(map);marker.bindTooltip(label(c)+' · government land inventory');marker.on('click',()=>{state.value=c.state;fillCounties();county.value=c.county;render();drawLandMap(true);});markers.push(marker);bounds.push([point[1],point[0]]);located++;}}}
document.getElementById('mapcaption').textContent=detail?located+' located county inventory sources · not individual parcels':grouped.size+' states · '+selected.length+' government inventory sources · tap a state';
if(fit){if(bounds.length)map.fitBounds(bounds,{padding:[65,65],maxZoom:['MS','AL','AR'].includes(state.value)?7:state.value?7:5,animate:false});else if(state.value&&stateCenters[state.value])map.setView(stateCenters[state.value],7,{animate:false});}void renderLandParcels();}
function initLandMap(){const caption=document.getElementById('mapcaption');if(typeof L==='undefined'){document.getElementById('landmap-fallback').textContent='Map renderer unavailable in this browser. Government land source listings are available below.';caption.textContent='Map unavailable · browse land sources below';return;}try{map=L.map('landmap',{zoomControl:false,scrollWheelZoom:false,attributionControl:true}).setView([38,-96],4);L.control.zoom({position:'topright'}).addTo(map);const fallback=document.getElementById('landmap-fallback');let loaded=false,errors=0;
const imagery=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Imagery © Esri',maxZoom:18}).addTo(map);
imagery.on('tileload',()=>{loaded=true;fallback.hidden=true;});
imagery.on('tileerror',()=>{if(++errors>=3&&!loaded){imagery.remove();const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);streets.on('tileload',()=>{loaded=true;fallback.hidden=true;caption.textContent='Street map fallback · county inventory locations, not parcels';});streets.on('tileerror',()=>{fallback.textContent='Map imagery unavailable in this browser. Browse government land sources below.';});}});
setTimeout(()=>{if(!loaded){fallback.hidden=true;caption.textContent='Satellite imagery is loading · land records remain available below';}},2500);map.on('zoomend',()=>{drawLandMap();});map.on('moveend',()=>{if(parcelRenderTimer)clearTimeout(parcelRenderTimer);parcelRenderTimer=setTimeout(()=>{if(['MS','AL','AR'].includes(state.value)&&map.getZoom()>=6)void renderLandParcels();},90);});map.whenReady(()=>{map.invalidateSize();drawLandMap();});fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json').then(r=>{if(!r.ok)throw Error('No county boundaries');return r.json();}).then(data=>{geometry=new Map();for(const feature of data.features||[]){const fips=String(feature.id||'').padStart(5,'0'),name=feature.properties?.NAME;if(name)geometry.set(fips.slice(0,2)+':'+normalize(name),feature);}drawLandMap(true);fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json').then(r=>r.json()).then(states=>{stateBorders=L.geoJSON(states,{style:{color:'#050505',weight:2.5,opacity:1,fillOpacity:0},interactive:false}).addTo(map);stateBorders.bringToFront();}).catch(()=>{caption.textContent='State border overlay unavailable · inventory markers remain available';});}).catch(()=>{caption.textContent='County location data unavailable · browse official land sources below';});}catch(e){document.getElementById('landmap-fallback').textContent='Map could not start. Browse government land sources below.';caption.textContent='Map unavailable · browse official land sources below';console.error('Land map initialization failed',e);}}
document.getElementById('maxprice').addEventListener('input',render);document.getElementById('minacres').addEventListener('input',render);
initLandMap();initLandMap();state.addEventListener('change',()=>{fillCounties();render();drawLandMap(true);});county.addEventListener('change',()=>{render();drawLandMap(true);});fetch('/liens/states/radar.json').then(r=>{if(!r.ok)throw Error('Radar data unavailable');return r.json();}).then(data=>{records=(data.counties||[]).filter(c=>c.group==='state-held'&&c.source&&c.county&&c.state);const codes=[...new Set(records.map(c=>c.state))].sort();for(const code of codes)state.add(new Option(code,code));for(const option of state.options){if(option.value)option.textContent=({AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',FL:'Florida',GA:'Georgia',MS:'Mississippi',TN:'Tennessee',TX:'Texas',WV:'West Virginia'})[option.value]||option.value;}const initial=new URLSearchParams(location.search).get('state');if(codes.includes(initial))state.value=initial;fillCounties();render();drawLandMap(true);}).catch(e=>{status.textContent='Land research data could not be loaded. Please try again later.';console.error(e);});})();+format(parcel.mv):'Not on file');addFact('Availability','Not confirmed');addFact('Owner',parcel.o||'Not on file');addFact('Zoning',parcel.zn||'Not on file');addFact('Flood zone',parcel.fz?.z||'Not checked');addFact('Wetlands',parcel.wt!=null?parcel.wt+'% mapped':'Not checked');panel.append(facts);
 panel.append(text('p','State-held or land-bank record. The displayed county value is not an asking price. Confirm ownership, availability and terms with the official source.','muted'));
 const tools=text('div','','land-property-tools');
 const center=Array.isArray(parcel.cx)&&parcel.cx.length===2?parcel.cx:null;
 const actions=[['📷','Photo'],['🚶','Street View'],['🎥','Cameras'],['🌤️','Weather'],['🔥','Fires'],['🛡️','Crime'],['🏠','Record'],['🏘️','Neighborhood'],['💼','Jobs'],['🛣️','Road'],['📍','Places'],['⚡','Energy'],['🌲','Parks']];
 const info=text('div','Select a tool to see its available information.','land-property-tool-info');
 for(const [emoji,name] of actions){const btn=text('button',emoji+' '+name);btn.type='button';btn.onclick=()=>{
  info.replaceChildren();
  if(name==='Photo'){info.append(text('p','The satellite image and verified parcel outline are shown above.'));return;}
  if(name==='Record'){info.append(text('p','Parcel '+String(parcel.p||'')+' · '+dataset.county+', '+dataset.state));if(dataset.gis?.url){const a=text('a','Open official county GIS record');a.href=dataset.gis.url;a.target='_blank';a.rel='noopener noreferrer';info.append(a);}return;}
  if(!center){info.append(text('p','Coordinates are not available for this parcel.'));return;}
  if(name==='Street View'){const a=text('a','Open Google Street View');a.href='https://www.google.com/maps/@?api=1&map_action=pano&viewpoint='+encodeURIComponent(center[1]+','+center[0]);a.target='_blank';a.rel='noopener noreferrer';info.append(a);return;}
  if(name==='Weather'){const a=text('a','View local weather forecast');a.href='https://forecast.weather.gov/MapClick.php?lat='+encodeURIComponent(center[1])+'&lon='+encodeURIComponent(center[0]);a.target='_blank';a.rel='noopener noreferrer';info.append(a);return;}
  info.append(text('p',name+' data is not verified for this parcel in Cheap Land. No results will be invented.'));};
  tools.append(btn);
 }
 panel.append(tools,info);
 const source=parcel.su||dataset.gis?.url;
 if(source&&/^https:\/\//.test(source)){const a=text('a','Check official property source');a.href=source;a.target='_blank';a.rel='noopener noreferrer';panel.append(a);}
 document.body.append(shade);shade.addEventListener('click',e=>{if(e.target===shade)shade.remove();});
 if(typeof L!=='undefined'&&center){const m=L.map(photo,{zoomControl:true,scrollWheelZoom:false,attributionControl:true}).setView([center[1],center[0]],16);L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Imagery © Esri',maxZoom:19}).addTo(m);
 if(Array.isArray(parcel.g)&&parcel.g.length){const rings=parcel.g.map(ring=>ring.map(pt=>[pt[1],pt[0]]));const outline=L.polygon(rings,{color:'#9effd8',weight:3,fillColor:'#17b889',fillOpacity:.25}).addTo(m);m.fitBounds(outline.getBounds(),{padding:[48,48],maxZoom:18});}else L.marker([center[1],center[0]]).addTo(m);
 shade.addEventListener('click',e=>{if(e.target===shade||e.target===close)m.remove();});setTimeout(()=>m.invalidateSize(),60);
 }else photo.append(text('p','Parcel imagery or coordinates unavailable.'));
 close.focus();
}

function render(){const visible=records.filter(c=>(!state.value||c.state===state.value)&&(!county.value||c.county===county.value)).sort((a,b)=>(Number(b.open)||0)-(Number(a.open)||0));results.replaceChildren();refreshMississippiParcels();const maxPrice=Number(document.getElementById('maxprice').value),minAcres=Number(document.getElementById('minacres').value);if(maxPrice||minAcres){status.textContent='Price and acreage filters require verified parcel-level records; no qualifying individual parcel data is available in this source index.';results.append(text('p','Individual parcels with verified price and acreage have not been imported. Clear those filters to browse county inventory sources.','empty'));return;}status.textContent=visible.length+' government land inventory sources found'+(state.value?' for '+state.options[state.selectedIndex].text:'')+'. Availability not confirmed.';if(!visible.length){results.append(text('p','No state-held land records are currently tracked for this selection. This does not mean no land is for sale.','empty'));return;}for(const c of visible.slice(0,100)){const card=text('article','', 'landcard');card.append(text('h2',label(c)),text('p',format(c.open)+' records on the last indexed government list'),text('p','Source checked: '+(c.checked||'date unavailable'),'muted'));if(c.priceLabel)card.append(text('p',c.priceLabel,'muted'));if(/^https:\/\//.test(c.source||'')){const a=text('a','Open official government source');a.href=c.source;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}results.append(card);}if(visible.length>100)results.append(text('p','Showing first 100 sources. Select a state or county to narrow the list.','muted'));}const stateFips={AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56'};
const normalize=s=>String(s||'').toLowerCase().replace(/\\b(county|parish|borough|municipality|census area|city of|division)\\b/g,'').replace(/\\([^)]*\\)/g,'').replace(/[^a-z0-9]/g,'');
let map=null,geometry=null,markers=[],recordPins=new Map(),stateBorders=null;
let landParcelLayer=null,landParcelRequest=0,parcelIndex=null,parcelCache=new Map(),parcelCanvas=null;
let parcelIndexPromise=null,parcelPending=new Map(),parcelRenderTimer=null;
function getParcelIndex(){
 if(parcelIndex)return Promise.resolve(parcelIndex);
 if(!parcelIndexPromise)parcelIndexPromise=fetch('/map/index.json').then(r=>{if(!r.ok)throw Error('Parcel index unavailable');return r.json();}).then(j=>parcelIndex=j.datasets.filter(d=>['MS','AL','AR'].includes(d.state)&&d.cats?.land_bank)).catch(e=>{parcelIndexPromise=null;throw e;});
 return parcelIndexPromise;
}
function getParcelData(file){
 if(parcelCache.has(file))return Promise.resolve(parcelCache.get(file));
 if(parcelPending.has(file))return parcelPending.get(file);
 const task=fetch('/map/data/'+encodeURIComponent(file)).then(r=>{if(!r.ok)throw Error('Parcel data unavailable');return r.json();}).then(d=>{parcelCache.set(file,d);return d;}).finally(()=>parcelPending.delete(file));
 parcelPending.set(file,task);return task;
}
async function renderLandParcels(){
 const token=++landParcelRequest;
 if(!map||!['MS','AL','AR'].includes(state.value)||map.getZoom()<6){
  if(landParcelLayer){landParcelLayer.remove();landParcelLayer=null;}return;
 }
 const caption=document.getElementById('mapcaption'),stateCode=state.value,view=map.getBounds(),zoom=map.getZoom();
 caption.textContent='Loading mapped '+stateNames[stateCode]+' parcels…';
 try{
  const index=await getParcelIndex();if(token!==landParcelRequest)return;
  const datasets=index.filter(d=>d.state===stateCode&&d.mapped&&d.bb&&(!county.value||normalize(d.county)===normalize(county.value))&&view.intersects(L.latLngBounds([d.bb[1],d.bb[0]],[d.bb[3],d.bb[2]])));
  const layer=L.featureGroup(),oldLayer=landParcelLayer;
  let count=0,centers=0,completed=0;
  // Keep existing geometry visible while the next viewport loads.
  const updateCaption=()=>{if(token===landParcelRequest)caption.textContent=count+' mapped state-held parcels in view'+(centers?' · '+centers+' tiny parcels highlighted':'')+(completed<datasets.length?' · loading '+completed+'/'+datasets.length+' counties…':' · availability unconfirmed');};
  const drawDataset=(dataset,data)=>{
   for(const parcel of data.recs||[]){
    if(parcel.c!=='land_bank'||!Array.isArray(parcel.g)||!parcel.g.length)continue;
    const center=Array.isArray(parcel.cx)?[parcel.cx[1],parcel.cx[0]]:null;
    if(center&&!view.contains(center))continue;
    const rings=parcel.g.map(ring=>ring.map(point=>[point[1],point[0]]));
    const bounds=L.latLngBounds(rings.flat());if(!view.intersects(bounds))continue;
    const popup=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('p'),link=document.createElement('a');
    title.textContent='Parcel '+(parcel.p||'unknown');detail.textContent=dataset.county+(parcel.ac!=null?' · '+parcel.ac+' acres':'')+' · Sale status unconfirmed';
    link.textContent='View parcel';link.href='/map/?'+new URLSearchParams({c:dataset.id,p:String(parcel.p||'')});
    popup.append(title,detail,link);
    L.polygon(rings,{color:'#a4ffe1',weight:zoom<9?2.5:2,fillColor:'#12b981',fillOpacity:0.46,renderer:parcelCanvas||(parcelCanvas=L.canvas({padding:0.25}))}).bindPopup(popup).addTo(layer);
    const nw=map.latLngToContainerPoint(bounds.getNorthWest()),se=map.latLngToContainerPoint(bounds.getSouthEast());
    if(Math.max(Math.abs(nw.x-se.x),Math.abs(nw.y-se.y))<9&&center){
     L.circleMarker(center,{radius:zoom<8?3.5:2.5,color:'#d9fff1',weight:1,fillColor:'#31e6b1',fillOpacity:0.9,renderer:parcelCanvas}).bindPopup(popup.cloneNode(true)).addTo(layer);centers++;
    }
    count++;
   }
  };
  // Cached counties paint immediately. Missing counties download concurrently
  // with a bounded worker pool, rather than blocking the whole map serially.
  const cached=datasets.filter(d=>parcelCache.has(d.file));
  const missing=datasets.filter(d=>!parcelCache.has(d.file));
  for(const d of cached){drawDataset(d,parcelCache.get(d.file));completed++;}
  if(token!==landParcelRequest)return;
  landParcelLayer=layer.addTo(map);if(oldLayer)oldLayer.remove();updateCaption();
  let next=0;
  const worker=async()=>{
   while(next<missing.length){
    const dataset=missing[next++];
    try{const data=await getParcelData(dataset.file);if(token!==landParcelRequest)return;drawDataset(dataset,data);}
    catch(e){/* One unavailable county must not block the other counties. */}
    if(token!==landParcelRequest)return;
    completed++;updateCaption();
   }
  };
  await Promise.all(Array.from({length:Math.min(5,missing.length)},()=>worker()));
  if(token===landParcelRequest)updateCaption();
 }catch(error){if(token===landParcelRequest)caption.textContent='Parcel geometry unavailable · browse government sources below';}
}
function clearMarkers(){for(const m of markers)m.remove();markers=[];recordPins.clear();}
function inside(p,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function centerOf(g){const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];let best=null,area=-1;for(const poly of polygons){const ring=poly[0];if(!ring?.length)continue;const xs=ring.map(x=>x[0]),ys=ring.map(x=>x[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);const size=(xmax-xmin)*(ymax-ymin);if(size<area)continue;let point=null;for(let n=0;n<12&&!point;n++)for(let i=0;i<12&&!point;i++)for(let j=0;j<12&&!point;j++){const x=xmin+(i+.5)*(xmax-xmin)/12,y=ymin+(j+.5)*(ymax-ymin)/12;if(inside([x,y],ring)&&!poly.slice(1).some(h=>inside([x,y],h)))point=[x,y];}if(point){best=point;area=size;}}return best;}
const stateCenters={AL:[32.65,-86.8],AR:[34.85,-92.4],MS:[32.75,-89.65]};
const stateNames={AL:'Alabama',AR:'Arkansas',MS:'Mississippi'};
function drawLandMap(fit=false){if(!map)return;clearMarkers();const selected=records.filter(c=>(!state.value||c.state===state.value)&&(!county.value||c.county===county.value));const grouped=new Map();for(const c of selected){if(!grouped.has(c.state))grouped.set(c.state,[]);grouped.get(c.state).push(c);}
const detail=map.getZoom()>=7||!!county.value;const bounds=[];let located=0;
for(const [code,items] of grouped){if(['MS','AL','AR'].includes(state.value)&&map.getZoom()>=6)continue;if(!detail){const center=stateCenters[code];if(!center)continue;const count=items.reduce((n,c)=>n+(Number(c.open)||0),0);const html='<span class="land-state-pin"><b>'+stateNames[code]+'</b><small>'+format(count)+' land records · '+items.length+' sources</small></span>';const marker=L.marker(center,{icon:L.divIcon({className:'land-marker-wrap',html,iconSize:[166,50],iconAnchor:[83,25]})}).addTo(map);marker.bindTooltip(stateNames[code]+' · '+format(count)+' government land records');marker.on('click',()=>{state.value=code;fillCounties();render();map.setView(center,7,{animate:true});drawLandMap();});markers.push(marker);bounds.push(center);located+=items.length;}else{for(const c of items){const feature=geometry?.get(stateFips[c.state]+':'+normalize(c.county));const point=feature?centerOf(feature.geometry):null;if(!point)continue;const marker=L.marker([point[1],point[0]],{icon:L.divIcon({className:'land-marker-wrap',html:'<span class="land-county-pin">'+format(c.open)+'</span>',iconSize:[40,40],iconAnchor:[20,20]})}).addTo(map);marker.bindTooltip(label(c)+' · government land inventory');marker.on('click',()=>{state.value=c.state;fillCounties();county.value=c.county;render();drawLandMap(true);});markers.push(marker);bounds.push([point[1],point[0]]);located++;}}}
document.getElementById('mapcaption').textContent=detail?located+' located county inventory sources · not individual parcels':grouped.size+' states · '+selected.length+' government inventory sources · tap a state';
if(fit){if(bounds.length)map.fitBounds(bounds,{padding:[65,65],maxZoom:['MS','AL','AR'].includes(state.value)?7:state.value?7:5,animate:false});else if(state.value&&stateCenters[state.value])map.setView(stateCenters[state.value],7,{animate:false});}void renderLandParcels();}
function initLandMap(){const caption=document.getElementById('mapcaption');if(typeof L==='undefined'){document.getElementById('landmap-fallback').textContent='Map renderer unavailable in this browser. Government land source listings are available below.';caption.textContent='Map unavailable · browse land sources below';return;}try{map=L.map('landmap',{zoomControl:false,scrollWheelZoom:false,attributionControl:true}).setView([38,-96],4);L.control.zoom({position:'topright'}).addTo(map);const fallback=document.getElementById('landmap-fallback');let loaded=false,errors=0;
const imagery=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Imagery © Esri',maxZoom:18}).addTo(map);
imagery.on('tileload',()=>{loaded=true;fallback.hidden=true;});
imagery.on('tileerror',()=>{if(++errors>=3&&!loaded){imagery.remove();const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);streets.on('tileload',()=>{loaded=true;fallback.hidden=true;caption.textContent='Street map fallback · county inventory locations, not parcels';});streets.on('tileerror',()=>{fallback.textContent='Map imagery unavailable in this browser. Browse government land sources below.';});}});
setTimeout(()=>{if(!loaded)fallback.textContent='Map imagery is taking longer than expected. Browse government land sources below.';},8000);map.on('zoomend',()=>{drawLandMap();});map.on('moveend',()=>{if(parcelRenderTimer)clearTimeout(parcelRenderTimer);parcelRenderTimer=setTimeout(()=>{if(['MS','AL','AR'].includes(state.value)&&map.getZoom()>=6)void renderLandParcels();},90);});map.whenReady(()=>{map.invalidateSize();drawLandMap();});fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json').then(r=>{if(!r.ok)throw Error('No county boundaries');return r.json();}).then(data=>{geometry=new Map();for(const feature of data.features||[]){const fips=String(feature.id||'').padStart(5,'0'),name=feature.properties?.NAME;if(name)geometry.set(fips.slice(0,2)+':'+normalize(name),feature);}drawLandMap(true);fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json').then(r=>r.json()).then(states=>{stateBorders=L.geoJSON(states,{style:{color:'#050505',weight:2.5,opacity:1,fillOpacity:0},interactive:false}).addTo(map);stateBorders.bringToFront();}).catch(()=>{caption.textContent='State border overlay unavailable · inventory markers remain available';});}).catch(()=>{caption.textContent='County location data unavailable · browse official land sources below';});}catch(e){document.getElementById('landmap-fallback').textContent='Map could not start. Browse government land sources below.';caption.textContent='Map unavailable · browse official land sources below';console.error('Land map initialization failed',e);}}
document.getElementById('maxprice').addEventListener('input',render);document.getElementById('minacres').addEventListener('input',render);
state.addEventListener('change',()=>{fillCounties();render();drawLandMap(true);});county.addEventListener('change',()=>{render();drawLandMap(true);});fetch('/liens/states/radar.json').then(r=>{if(!r.ok)throw Error('Radar data unavailable');return r.json();}).then(data=>{records=(data.counties||[]).filter(c=>c.group==='state-held'&&c.source&&c.county&&c.state);const codes=[...new Set(records.map(c=>c.state))].sort();for(const code of codes)state.add(new Option(code,code));for(const option of state.options){if(option.value)option.textContent=({AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',FL:'Florida',GA:'Georgia',MS:'Mississippi',TN:'Tennessee',TX:'Texas',WV:'West Virginia'})[option.value]||option.value;}const initial=new URLSearchParams(location.search).get('state');if(codes.includes(initial))state.value=initial;fillCounties();render();drawLandMap(true);}).catch(e=>{status.textContent='Land research data could not be loaded. Please try again later.';console.error(e);});})();