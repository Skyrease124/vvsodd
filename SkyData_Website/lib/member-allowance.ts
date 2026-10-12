import type { SecretEnv } from './secret-store';
const counted=new Set(['/api/chat','/api/vision','/api/debate','/api/debate-check','/api/debate-score','/api/decisions','/api/gemini-token']);
const aiPaths=new Set([...counted,'/api/voice','/api/transcribe']);
export function allowanceDay(now=Date.now()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(kind:string)=>parts.find(p=>p.type===kind)!.value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}
export type Allowance={limit:number;used:number;remaining:number;paused:boolean;day:string;ownerExempt:boolean};
export async function memberAllowance(env:SecretEnv,user:string,admin=false,now=Date.now()):Promise<Allowance>{
 const day=allowanceDay(now);
 if(admin)return {limit:0,used:0,remaining:0,paused:false,day,ownerExempt:true};
 const row=await env.DB!.prepare('SELECT members.daily_limit, members.usage_paused, COALESCE(daily_allowance.used,0) AS used FROM members LEFT JOIN daily_allowance ON daily_allowance.id = members.email || ? WHERE members.user_id = ?').bind(':'+day,user).first<{daily_limit:number;usage_paused:number;used:number}>();
 if(!row)throw Error('Member allowance unavailable');
 return {limit:row.daily_limit,used:row.used,remaining:Math.max(0,row.daily_limit-row.used),paused:row.usage_paused===1,day,ownerExempt:false};
}
export async function withMemberAllowance(request:Request,env:SecretEnv,admin:boolean,path:string,work:()=>Promise<Response>,now=Date.now()){
 if(admin||request.method!=='POST'||!aiPaths.has(path))return work();
 const user=request.headers.get('oai-authenticated-user-id');
 if(!user||!env.DB)return Response.json({error:'Your daily allowance could not be checked.'},{status:503});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403});
 let reservation:string|undefined;
 try{
  const current=await memberAllowance(env,user,false,now);
  if(current.paused)return Response.json({error:'Your AI usage is paused by the owner. You can still view saved chats.',allowance:current},{status:423,headers:{'Cache-Control':'private, no-store'}});
  if(counted.has(path)){
   // Atomic reservation rechecks current settings so concurrent tabs cannot exceed the allowance.
   const day=current.day;
   const row=await env.DB.prepare("INSERT INTO daily_allowance (id,email,day,used) SELECT email || ?,email,?,1 FROM members WHERE user_id = ? AND status = 'approved' AND usage_paused = 0 AND daily_limit > 0 ON CONFLICT(id) DO UPDATE SET used = daily_allowance.used + 1 WHERE daily_allowance.used < (SELECT daily_limit FROM members WHERE user_id = ? AND status = 'approved' AND usage_paused = 0) RETURNING id").bind(':'+day,day,user,user).first<{id:string}>();
   if(!row){const latest=await memberAllowance(env,user,false,now);return Response.json({error:latest.paused?'Your AI usage is paused by the owner.':'Your daily AI allowance has been reached. It resets at midnight Eastern time, or the owner can raise it.',allowance:latest},{status:latest.paused?423:429,headers:{'Cache-Control':'private, no-store'}});}
   reservation=row.id;
  }
  const response=await work();
  if(response.status>=400&&reservation){await env.DB.prepare('UPDATE daily_allowance SET used = MAX(0,used - 1) WHERE id = ?').bind(reservation).run();reservation=undefined;}
  return response;
 }catch(error){
  if(reservation)try{await env.DB.prepare('UPDATE daily_allowance SET used = MAX(0,used - 1) WHERE id = ?').bind(reservation).run();}catch{}
  console.error('Member allowance failed',{path,name:error instanceof Error?error.name:'Unknown'});
  return Response.json({error:'AI usage protection is temporarily unavailable. Try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
