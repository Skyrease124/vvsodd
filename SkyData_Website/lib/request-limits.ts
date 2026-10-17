import type { SecretEnv } from './secret-store';
export async function enforceRequestLimit(request:Request,env:SecretEnv,path:string){
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner||(request.method!=='POST'&&request.method!=='DELETE'&&!(request.method==='GET'&&(['/api/chat-state','/api/chat-backup','/api/chats','/api/projects'].includes(path)||path.startsWith('/api/chats/')||path.startsWith('/api/projects/')))))return null;
 const setup=path==='/api/setup'||path.startsWith('/connect');
 const policies:Record<string,number>={'/api/engineering':12,'/owner/models':6,'/api/polly-settings':12,'/api/polly-preview':30,'/api/gemini-token':4,'/api/voice-settings':12,'/api/voice-preview':30,'/api/knowledge':180,'/api/decisions':6,'/api/editor-plan':20,'/api/debate-score':3,'/api/debate-check':6,'/api/debate':12,'/api/chat':40,'/api/vision':30,'/api/voice':120,'/api/transcribe':60,'/api/chat-state':240,'/api/chats':240,'/api/image-generate':10,'/api/chat-backup':30};
 const limit=path.startsWith('/api/projects')?240:setup?6:policies[path];if(!limit)return null;
 if(!env.DB)return Response.json({error:'Request protection is temporarily unavailable. Try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
 const window=Math.floor(Date.now()/60000),key=owner+':'+(path.startsWith('/api/projects')?'projects':setup?'setup':path);
 const row=await env.DB.prepare('INSERT INTO request_limits (id, window, count) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET window = excluded.window, count = CASE WHEN request_limits.window = excluded.window THEN request_limits.count + 1 ELSE 1 END RETURNING count').bind(key,window).first<{count:number}>();
 if(!row||row.count<=limit)return null;
 const retry=Math.max(1,60-Math.floor(Date.now()/1000)%60);
 console.warn('SkyData request limit reached',{path,limit});
 return Response.json({error:`Too many requests. Wait ${retry} seconds and try again.`,retryable:true},{status:429,headers:{'Retry-After':String(retry),'Cache-Control':'no-store'}});
}
