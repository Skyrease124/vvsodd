// Netlify scheduled function; it ONLY executes on published production deploys.
// Default is OFF until owner explicitly enables PPA_WAYNE_AUTORUN_ENABLED=true
// in Netlify Functions environment. Deploy previews do not invoke schedules.
import {runScheduledWayne} from './owner-brain-wayne-run.mjs';
const enabled=()=>typeof Netlify!=='undefined'&&Netlify.env.get('PPA_WAYNE_AUTORUN_ENABLED')==='true';
export const config={schedule:'*/30 * * * *'};
export default async function scheduled(req,context){
 if(context?.deploy?.context!=='production'||context.deploy.published!==true)return new Response(null,{status:204});
 if(!enabled())return new Response(null,{status:204});
 const synthetic=new Request('https://pricepocketasset.com/.netlify/functions/owner-brain-wayne-run',{method:'POST'});
 const result=await runScheduledWayne(synthetic,context);
 // Keep a concise audit trail in Netlify scheduled-function logs.
 if(!result.ok)console.error('Scheduled Wayne batch:',result.status,await result.text());
 else console.log('Scheduled Wayne batch:',await result.text());
 return new Response(null,{status:204});
}
