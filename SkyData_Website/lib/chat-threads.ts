import {encryptStoredText,decryptStoredText,type SecretEnv} from './secret-store';
import {cleanChatState} from './chat-state';
// Saved chats: every conversation keeps its own encrypted record so the home screen can list them and any can be reopened.
const KEEP=40,headers={'Cache-Control':'private, no-store'};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers});
const ID=/^[a-f0-9-]{36}$/;
async function schema(db:D1Database){await db.prepare('CREATE TABLE IF NOT EXISTS chat_thread (owner TEXT NOT NULL, id TEXT NOT NULL, updated INTEGER NOT NULL, meta TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY(owner,id))').run();}
const plain=(t:string)=>t.replace(/[#*_`>\[\]()]/g,'').replace(/\s+/g,' ').trim();
function metaOf(state:{messages:{role:string;content:string}[]}){
 const first=state.messages.find(m=>m.role==='user'),last=[...state.messages].reverse().find(m=>m.role==='assistant')||first;
 return {title:plain(first?.content||'New chat').slice(0,70)||'New chat',preview:plain(last?.content||'').slice(0,140),count:state.messages.length};
}
async function put(env:SecretEnv,owner:string,id:string,cleanJson:string){
 const state=JSON.parse(cleanJson),db=env.DB!,now=Date.now();
 await db.prepare('INSERT INTO chat_thread(owner,id,updated,meta,state) VALUES(?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET updated=excluded.updated,meta=excluded.meta,state=excluded.state').bind(owner,id,now,JSON.stringify(await encryptStoredText(env,JSON.stringify(metaOf(state)),'chatmeta:'+owner+':'+id)),JSON.stringify(await encryptStoredText(env,cleanJson,'chatthread:'+owner+':'+id))).run();
 await db.prepare('DELETE FROM chat_thread WHERE owner=? AND id NOT IN (SELECT id FROM chat_thread WHERE owner=? ORDER BY updated DESC LIMIT ?)').bind(owner,owner,KEEP).run();
}
export async function handleChatThreads(request:Request,env:SecretEnv){
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Sign in to see your chats.'},403);
 if(!env.DB)return json({error:'Chat saving is unavailable.'},503);
 const path=new URL(request.url).pathname,id=path.slice('/api/chats'.length).replace(/^\//,'');
 try{
  await schema(env.DB);
  if(request.method==='GET'&&!id){
   let rows=(await env.DB.prepare('SELECT id,updated,meta FROM chat_thread WHERE owner=? ORDER BY updated DESC LIMIT ?').bind(owner,KEEP).all<{id:string;updated:number;meta:string}>()).results;
   if(!rows.length){
    // One-time move of the single chat saved before this library existed.
    const legacy=await env.DB.prepare('SELECT state FROM chat_state WHERE owner=?').bind(owner).first<{state:string}>();
    if(legacy){try{const stored=JSON.parse(legacy.state),state=stored.version===1?JSON.parse(await decryptStoredText(env,stored,'chat:'+owner)):stored;if(Array.isArray(state?.messages)&&state.messages.length){const clean=cleanChatState(state);if(clean)await put(env,owner,crypto.randomUUID(),clean);}}catch{}
     rows=(await env.DB.prepare('SELECT id,updated,meta FROM chat_thread WHERE owner=? ORDER BY updated DESC LIMIT ?').bind(owner,KEEP).all<{id:string;updated:number;meta:string}>()).results;}
   }
   const chats=[];for(const r of rows){try{chats.push({id:r.id,updated:r.updated,...JSON.parse(await decryptStoredText(env,JSON.parse(r.meta),'chatmeta:'+owner+':'+r.id))});}catch{}}
   return json({chats});
  }
  if(!ID.test(id))return json({error:'Unknown chat.'},404);
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT state FROM chat_thread WHERE owner=? AND id=?').bind(owner,id).first<{state:string}>();if(!row)return json({error:'That chat was not found.'},404);
   return json({state:JSON.parse(await decryptStoredText(env,JSON.parse(row.state),'chatthread:'+owner+':'+id))});
  }
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
  if(request.method==='DELETE'){await env.DB.prepare('DELETE FROM chat_thread WHERE owner=? AND id=?').bind(owner,id).run();return json({deleted:true});}
  if(request.method!=='POST')return json({error:'Use GET, POST or DELETE.'},405);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Send JSON.'},415);
  const raw=await request.text();if(raw.length>1000000)return json({error:'This chat is too large to save. Start a new chat.'},413);
  const clean=cleanChatState(JSON.parse(raw));if(!clean)return json({error:'Invalid chat state.'},400);
  if(!JSON.parse(clean).messages.length)return json({saved:false});
  await put(env,owner,id,clean);return json({saved:true});
 }catch{return json({error:'Could not load or save your chats. Try again.'},503);}
}
