import { validProject } from './projects';
import {encryptStoredText, decryptStoredText, type SecretEnv } from './secret-store';
import { isSupportedModel } from './models';
import { isReplyLanguage } from './languages';
export async function handleChatState(request:Request,env:SecretEnv){
 const headers={'Cache-Control':'private, no-store'};
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return Response.json({error:'Sign in to save your chat.'},{status:403,headers});
 if(!env.DB)return Response.json({error:'Chat saving is unavailable.'},{status:503,headers});
 if(new URL(request.url).pathname==='/api/chat-backup'&&request.method!=='GET')return Response.json({error:'Use GET.'},{status:405,headers});
 try{
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT state FROM chat_state WHERE owner = ?').bind(owner).first<{state:string}>();
   let state=null;
   if(row){const stored=JSON.parse(row.state);if(stored.version===1){state=JSON.parse(await decryptStoredText(env,stored,'chat:'+owner));}else{
    state=stored;
    const encrypted=JSON.stringify(await encryptStoredText(env,row.state,'chat:'+owner));
    // Upgrade old text safely without overwriting a newer autosave.
    await env.DB.prepare('UPDATE chat_state SET state = ? WHERE owner = ? AND state = ?').bind(encrypted,owner,row.state).run();
   }}
   if(new URL(request.url).pathname==='/api/chat-backup')return new Response(JSON.stringify({format:'skydata-chat',version:1,state},null,2),{headers:{...headers,'Content-Type':'application/json','Content-Disposition':'attachment; filename="skydata-chat-backup.json"','X-Content-Type-Options':'nosniff'}});
   return Response.json({state},{headers});
  }
  if(request.method!=='POST')return Response.json({error:'Use GET or POST.'},{status:405,headers});
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403,headers});
  if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Send JSON.'},{status:415,headers});
  const raw=await request.text();if(raw.length>1000000)return Response.json({error:'This chat is too large to save. Start a new chat.'},{status:413,headers});
  const state=JSON.parse(raw);
  if(!state||!Array.isArray(state.messages)||state.messages.length>100||state.messages.some((m:any)=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>32000)||typeof state.draft!=='string'||state.draft.length>8000||!isSupportedModel(state.model)||!isReplyLanguage(state.replyLanguage))return Response.json({error:'Invalid chat state.'},{status:400,headers});
  // Save only text and source links. Camera/audio bytes stay outside the database.
  const messages=state.messages.map((m:any)=>({role:m.role,content:m.content,...(validProject(m.project)?{project:m.project}:{}),sources:Array.isArray(m.sources)?m.sources.filter((s:any)=>s&&typeof s.title==='string'&&s.title.length<=500&&typeof s.url==='string'&&/^https?:\/\//.test(s.url)&&s.url.length<=2048).slice(0,10):undefined}));
  const clean=JSON.stringify({messages,draft:state.draft,model:state.model,replyLanguage:state.replyLanguage});
  await env.DB.prepare('INSERT INTO chat_state (owner, state) VALUES (?, ?) ON CONFLICT(owner) DO UPDATE SET state = excluded.state').bind(owner,JSON.stringify(await encryptStoredText(env,clean,'chat:'+owner))).run();
  return Response.json({saved:true,state:JSON.parse(clean)},{headers});
 }catch(error){console.error('Chat state storage failed',{method:request.method,name:error instanceof Error?error.name:'Unknown'});return Response.json({error:'Could not load or save your chat. Try again.'},{status:503,headers});}
}
