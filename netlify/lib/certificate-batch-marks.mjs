// Pure owner triage validation; never approves or publishes certificates.
const MAX_BATCH=100;
const ACTIONS=new Set(['mark-follow-up','mark-inspected','clear-mark']);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
export function applyBatchMarks(stored,body){
  if(!stored||!Array.isArray(stored.items))throw Error('Scan a current county snapshot first.');
  if(body.snapshotSha256!==stored.snapshotSha256)throw Error('The county snapshot changed. Refresh first.');
  if(!ACTIONS.has(body.action)||!Array.isArray(body.certificateKeys)||body.certificateKeys.length===0||body.certificateKeys.length>MAX_BATCH)
    throw Error('Choose 1–100 certificates for private triage.');
  const keys=body.certificateKeys;
  if(keys.some(k=>typeof k!=='string'||k.length>250)||new Set(keys).size!==keys.length)throw Error('Invalid or repeated certificate keys.');
  const known=new Set(stored.items.map(x=>x.certificateKey));
  if(keys.some(k=>!known.has(k)))throw Error('Certificate not found in current county scan.');
  const marks=Object.assign(Object.create(null),stored.triageMarks||{});
  for(const key of keys){
    if(body.action==='clear-mark')delete marks[key];
    else marks[key]={status:body.action==='mark-follow-up'?'follow-up':'inspected',updatedAt:new Date().toISOString()};
  }
  return {...stored,triageMarks:marks};
}

