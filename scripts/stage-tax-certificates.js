'use strict';
// Import official county-exported tax certificate CSVs into a review-only staging format.
// Never infer availability, redemption, ownership, or an upcoming auction from a row.
const fs=require('node:fs');
const path=require('node:path');
function parseCSV(source){
  const rows=[];let row=[],value='',quoted=false;
  source=String(source).replace(/^\uFEFF/,'');
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quoted){if(c==='"'&&source[i+1]==='"'){value+='"';i++}else if(c==='"')quoted=false;else value+=c}
    else if(c==='"'){if(value.length)throw Error('Unexpected quote in CSV');quoted=true}
    else if(c===','){row.push(value);value=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;row.push(value);value='';if(row.some(x=>x.trim()))rows.push(row);row=[]}
    else value+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(row.length||value){row.push(value);if(row.some(x=>x.trim()))rows.push(row)}
  return rows;
}
function normalizeExport(csv,{state,county,sourceUrl='',checkedAt=new Date().toISOString()}={}){
  if(!/^[A-Z]{2}$/.test(state||'')||!county||typeof county!=='string'||county.length>100)throw Error('State and county required');
  const rows=parseCSV(csv);if(rows.length<2)throw Error('CSV must contain header and records');
  if(rows.length>100001)throw Error('CSV exceeds 100,000 records');
  const headers=rows.shift().map(h=>h.trim().toLowerCase().replace(/[^a-z0-9]/g,''));
  const field=names=>names.map(n=>headers.indexOf(n)).find(n=>n!==-1);
  const id=field(['parcelid','parcelnumber','parcelno','parcels','accountnumber','accountno','apn','folio','propertyid','realestateaccount']);
  const cert=field(['certificatenumber','certificateno','certnumber','certno','certificateid','certid']);
  const amount=field(['faceamount','certificateamount','certamount','taxamount','amountdue','amountowed','totaldue']);
  const year=field(['taxyear','certyear','saleyear','year']);
  if(id===undefined||cert===undefined)throw Error('CSV must include recognizable parcel AND certificate number columns');
  const seen=new Set(),accepted=[],rejected=[];
  for(let index=0;index<rows.length;index++){
    const cells=rows[index],parcelId=String(cells[id]||'').trim(),certificateNumber=String(cells[cert]||'').trim();
    const problems=[];
    if(cells.length!==headers.length)problems.push('Wrong column count');
    if(!parcelId||parcelId.length>100)problems.push('Invalid parcel number');
    if(!certificateNumber||certificateNumber.length>100)problems.push('Invalid certificate number');
    const key=parcelId.toLowerCase()+':'+certificateNumber.toLowerCase()+':'+String(year===undefined?'':cells[year]).trim();
    if(seen.has(key))problems.push('Duplicate certificate in export');seen.add(key);
    const raw=amount===undefined?'':String(cells[amount]||'').trim();
    let faceAmount=null;
    if(raw){if(!/^\$?\d+(?:,\d{3})*(?:\.\d{1,2})?$/.test(raw))problems.push('Invalid face amount');else faceAmount=Number(raw.replace(/[$,]/g,''))}
    if(problems.length)rejected.push({row:index+2,parcelId,certificateNumber,errors:problems});
    else accepted.push({state,county,parcelId,certificateNumber,taxYear:year===undefined?null:String(cells[year]||'').trim()||null,faceAmount,sourceUrl,checkedAt,status:'unverified',availableForPurchase:false});
  }
  return {source:{state,county,sourceUrl,checkedAt,classification:'historical-or-current-certificate-export; availability not established'},summary:{received:rows.length,accepted:accepted.length,rejected:rejected.length},readyToStage:accepted.length>0&&rejected.length===0,accepted,rejected};
}
module.exports={parseCSV,normalizeExport};
if(require.main===module){
  try{
    const [file,state,county,sourceUrl]=process.argv.slice(2);
    if(!file||!state||!county)throw Error('Usage: node scripts/stage-tax-certificates.js <file.csv> <FL> <County Name> [source URL]');
    const data=fs.readFileSync(file);if(data.length>15*1024*1024)throw Error('CSV over 15 MB');
    const report=normalizeExport(data.toString('utf8'),{state,county,sourceUrl});
    const out=path.join('county-import-staging','tax-certificates-'+state.toLowerCase()+'-'+county.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json');
    if(report.readyToStage){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log('Staged for review: '+out)}
    console.log(JSON.stringify({summary:report.summary,readyToStage:report.readyToStage,rejected:report.rejected.slice(0,10)},null,2));
    if(!report.readyToStage)process.exitCode=1;
  }catch(e){console.error(e.message);process.exitCode=1}
}
