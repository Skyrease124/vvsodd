import {browserModel} from '../lib/hp-browser';
import {handleWebsiteInvestigation} from '../lib/website-investigation';
import {handleRunnerOwner,handleRunnerDevice} from '../lib/engineering-runner';
import {handleEngineering} from '../lib/engineering';
import {aiDashboard} from '../lib/ai-dashboard';
import {pollySpeech,pollyManagement,pollyConnection,pollyReady} from '../lib/polly';
import {voiceSettings} from '../lib/voice-config';
import { geminiConnection,geminiToken,geminiReady,geminiVoiceSettings,selectedGeminiVoice } from '../lib/gemini-live';
import {geminiUpstream,geminiSpeech} from '../lib/gemini-provider';
import { handleKnowledge } from '../lib/knowledge';
import { handleBlenderDevice, handleBlenderOwner } from '../lib/blender-pairing';
import { memberAllowance, withMemberAllowance } from '../lib/member-allowance';
import { resolveAccess, handleLogin, accountPage, handleLogout, loginPage, waitingPage, accessPage } from '../lib/access';
import { ownerDashboard } from '../lib/owner-dashboard';
import { INVITE_LINKS, handleInvite } from '../lib/member-invites';
import { handleDecisions } from '../lib/decisions';
import { handleEditorPlan } from '../lib/editor-plan';
import { handleDebateScore } from '../lib/debate-score';
import { handleDebateCheck } from '../lib/debate-check';
import { handleDebate } from '../lib/debate';
import { isSiteAdmin, inviteInbox } from '../lib/site-admin';
import { handleProjects } from '../lib/projects';
import { enforceRequestLimit } from '../lib/request-limits';
import { handleChatState } from '../lib/chat-state';
import { handleWhisperConnection } from '../lib/whisper';
import { handleTranscribe } from '../lib/transcribe';
import { handleVision } from '../lib/vision';
import { handleVoice } from '../lib/voice';
import { readKey, setupKey, type SecretEnv } from "../lib/secret-store";
import { handleConnectionPage } from "../lib/connection-page";
import { requestsPaidModel, isPaidModel, MODELS } from "../lib/models";
import { handleChat } from "../lib/nvidia";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  async fetch(incoming: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const config = env as Cloudflare.Env & SecretEnv;
    let request=incoming;
    const incomingPath=new URL(incoming.url).pathname;
    if(incomingPath==='/api/engineering-runner/browser-model')return browserModel(incoming,config);
    if(['/api/engineering-runner/pair','/api/engineering-runner/poll','/api/engineering-runner/progress','/api/engineering-runner/result','/api/engineering-runner/rea-result','/api/engineering-runner/browser-result','/api/engineering-runner/browser-control'].includes(incomingPath))return handleRunnerDevice(incoming,config,incomingPath);
    if(['/api/blender/pair','/api/blender/heartbeat','/api/blender/result'].includes(incomingPath))return handleBlenderDevice(incoming,config,incomingPath);
    // Static assets are public; every working surface and API checks membership.
    if(!incomingPath.startsWith('/assets/') && !incomingPath.startsWith('/_next/static/') && !['/favicon.svg','/favicon.ico','/robots.txt'].includes(incomingPath)){
      try{
        if(incomingPath==='/login')return handleLogin(incoming,config);
        if(INVITE_LINKS&&incomingPath==='/invite')return handleInvite(incoming,config);
        const access=await resolveAccess(incoming,config);
        if(!access){
          if(incomingPath.startsWith('/api/'))return Response.json({error:'Sign in with an approved SkyData account.',access_denied:true},{status:403,headers:{'Cache-Control':'no-store'}});
          return incoming.headers.get('oai-authenticated-user-id')?waitingPage(incoming,config):loginPage(incoming,config);
        }
        request=access.request;
        if(incomingPath==='/api/engineering-browser'||incomingPath.startsWith('/api/engineering-browser/')){if(!access.admin)return Response.json({error:'Engineering Mode is owner-only.'},{status:403});const background=!!(config as {BACKGROUND_SECRET?:string}).BACKGROUND_SECRET&&request.headers.get('x-skydata-background')===(config as {BACKGROUND_SECRET?:string}).BACKGROUND_SECRET;const limited=background?null:await enforceRequestLimit(request,config,'/api/engineering');if(limited)return limited;return handleWebsiteInvestigation(request,config);}
        if(incomingPath.startsWith('/api/engineering-runner/'))return handleRunnerOwner(request,config,incomingPath);
        if(incomingPath==='/engineering/runner'&&!access.admin)return accessPage('Owner access only','<p>Runner management is owner-only.</p>',403);
        if(incomingPath==='/engineering'||incomingPath==='/api/engineering'){
          if(!access.admin)return incomingPath.startsWith('/api/')?Response.json({error:'Engineering Mode is owner-only.'},{status:403}):accessPage('Owner access only','<p>Engineering Mode is owner-only.</p>',403);
          if(incomingPath==='/api/engineering'){const limited=await enforceRequestLimit(request,config,'/api/engineering');if(limited)return limited;return handleEngineering(request,config);}
        }
        if(incomingPath.replace(/\/+$/, '')==='/owner/models'){
          if(!access.admin)return accessPage('Owner access only','<p>AI model management is owner-only.</p>',403);
          const limited=await enforceRequestLimit(request,config,'/owner/models');if(limited)return limited;
          return aiDashboard(request,config);
        }

        if(incomingPath==='/knowledge'||incomingPath.startsWith('/api/knowledge')){
          if(!access.admin)return incomingPath.startsWith('/api/')?Response.json({error:'Knowledge Core is owner-only.'},{status:403}):accessPage('Owner access only','<p>Knowledge Core is available to the SkyData owner.</p>',403);
          if(incomingPath.startsWith('/api/knowledge')){const limited=await enforceRequestLimit(request,config,'/api/knowledge');if(limited)return limited;return handleKnowledge(request,config,ctx);}
        }

        const blenderPath=incomingPath.replace(/\/+$/, '');
        if(blenderPath==='/blender'||['/downloads/skydata-blender-connector.zip','/downloads/skydata_connector_addon.zip'].includes(blenderPath)||blenderPath.startsWith('/api/blender/')){
          if(!access.admin)return blenderPath.startsWith('/api/')?Response.json({error:'Only the SkyData owner can connect Blender.'},{status:403,headers:{'Cache-Control':'no-store'}}):accessPage('Owner access only','<p>Only the SkyData owner can connect Blender.</p>',403);
          if(blenderPath.startsWith('/api/blender/'))return handleBlenderOwner(request,config,blenderPath);
          if(['/downloads/skydata-blender-connector.zip','/downloads/skydata_connector_addon.zip'].includes(blenderPath)){
            if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
            const asset=await env.ASSETS.fetch(request);
            const headers=new Headers(asset.headers);
            headers.set('Cache-Control','private, no-store');
            headers.set('Content-Disposition',`attachment; filename="${blenderPath.split('/').pop()}"`);
            headers.set('Content-Type','application/zip');
            return new Response(asset.body,{status:asset.status,headers});
          }
        }
        if(!access.admin&&['/decisions','/debate','/api/decisions','/api/debate','/api/debate-check','/api/debate-score'].includes(incomingPath.replace(/\/+$/, '')))return incomingPath.startsWith('/api/')?Response.json({error:'This feature is owner-only.',code:'owner_only'},{status:403,headers:{'Cache-Control':'no-store'}}):accessPage('Owner access only','<p>Decisions and Debate mode are available only to the SkyData owner.</p>',403);
        if(!access.admin&&incoming.method==='POST'&&['/api/chat','/api/debate','/api/vision'].includes(incomingPath)){
          let payload;try{payload=await incoming.clone().json();}catch{return Response.json({error:'Send valid JSON.'},{status:400});}
          if(requestsPaidModel(payload))return Response.json({error:'Paid models are currently owner-only. Choose a free model.',code:'owner_only'},{status:403,headers:{'Cache-Control':'no-store'}});
        }
        if(incomingPath==='/api/auth/session')return Response.json({signedIn:true,isOwner:access.admin,email:access.member.email,allowance:await memberAllowance(config,access.member.user_id!,access.admin)},{headers:{'Cache-Control':'private, no-store'}});
        if(incomingPath==='/account')return accountPage(request,config,access);
        if(incomingPath==='/logout')return handleLogout(request,config);
        if(incomingPath.replace(/\/+$/, '')==='/owner/voice'&&!access.admin)return accessPage('Owner access only','<p>Voice Management is available only to the creator.</p>',403);
        if(incomingPath==='/owner'||incomingPath==='/invite-requests')return access.admin?ownerDashboard(request,config):accessPage('Owner access only','<p>Only the SkyData owner can manage members.</p>',403);
        if((incomingPath==='/api/setup'||incomingPath.startsWith('/connect'))&&!access.admin)return Response.json({error:'Only the SkyData owner can manage connections.'},{status:403,headers:{'Cache-Control':'no-store'}});
      }catch{return incomingPath.startsWith('/api/')?Response.json({error:'Account access is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}}):accessPage('Temporarily unavailable','<p>Your account could not be checked. Please reload to try again.</p>',503);}
    }
    const path = new URL(request.url).pathname;
    if (["/api/editor-plan", "/connect-polly", "/api/polly-settings", "/api/polly-preview", "/connect-gemini", "/api/gemini-token", "/api/voice-settings", "/api/voice-preview", "/api/decisions", "/api/debate-score", "/api/debate-check", "/api/debate", "/invite-requests", "/api/chat-backup", "/api/chat-state", "/connect-whisper", "/api/transcribe", "/api/status", "/api/chat", "/api/setup", "/connect", "/connect-voice", "/api/voice", "/api/vision", "/connect-camera", "/connect-web", "/connect-deepseek", "/connect-gpt", "/connect-openrouter", "/connect-openai", "/connect-crypto"].includes(path) || path === "/api/projects" || path.startsWith("/api/projects/")) {
      // Membership was checked above; each user keeps a separate Site-scoped identity.
      if (!request.headers.get("oai-authenticated-user-id")) {console.warn("SkyData access denied",{path});return Response.json({ error: "Sign in with your SkyData owner account to continue." }, {status:403,headers:{"Cache-Control":"no-store"}});}
      try {
        const admin = await isSiteAdmin(request,config);
        if(!admin&&['/api/polly-preview','/api/polly-settings','/api/voice-preview','/api/voice-settings','/api/decisions','/api/debate','/api/debate-check','/api/debate-score'].includes(path))return Response.json({error:'This feature is owner-only.',code:'owner_only'},{status:403,headers:{'Cache-Control':'no-store'}});
        if((path==='/invite-requests'||path==='/api/setup'||path.startsWith('/connect'))&&!admin)return Response.json({error:'Only the SkyData owner can manage connections and invitations.'},{status:403,headers:{'Cache-Control':'no-store'}});
        if(path==='/invite-requests')return inviteInbox(config);
        const run=(work:()=>Promise<Response>)=>withMemberAllowance(request,config,admin,path,work);
        const limited = await enforceRequestLimit(request, config, path);
        if (limited) return limited;
        if(path === "/api/projects" || path.startsWith("/api/projects/")) return handleProjects(request, config);
        if (path === "/api/chat-state" || path === "/api/chat-backup") return handleChatState(request, config);
        if (path === "/connect-whisper") return handleWhisperConnection(request, config);
        if (path === "/connect-crypto") return handleConnectionPage(request, config, false, false, false, false, false, false, false, true);
        if (path === "/connect-openai") return handleConnectionPage(request, config, false, false, false, false, false, false, true);
        if (path === "/connect-openrouter") return handleConnectionPage(request, config, false, false, false, false, false, true);
        if (path === "/connect-gpt") return handleConnectionPage(request, config, false, false, false, false, true);
        if (path === "/connect-deepseek") return handleConnectionPage(request, config, false, false, false, true);
        if (path === "/connect-web") return handleConnectionPage(request, config, false, false, true);
        if (path === "/connect-camera") return handleConnectionPage(request, config, false, true);
        if (path === "/api/transcribe") return run(()=>handleTranscribe(request, config));
        if (path === "/api/vision") return run(()=>handleVision(request, config,geminiUpstream(config),true));
        if(path==='/connect-polly')return pollyConnection(request,config);
        if(path==='/api/polly-settings')return pollyManagement(request,config);
        if(path==='/api/polly-preview')return pollySpeech(request,config,true);
        if(path==='/connect-gemini')return geminiConnection(request,config);
        if(path==='/api/gemini-token')return run(()=>geminiToken(request,config));
        if(path==='/api/voice-preview')return geminiSpeech(request,config,true);
        if(path==='/api/voice-settings')return geminiVoiceSettings(request,config);
        if (path === "/connect-voice") return Response.redirect(new URL("/owner/voice",request.url),303);
        if (path === "/api/voice") return run(async()=>{const settings=await voiceSettings(config);return settings.provider==='polly'?pollySpeech(request,config):geminiSpeech(request,config);});
        if (path === "/connect") return handleConnectionPage(request, config);
        if (path === "/api/setup") return setupKey(request, config);
        const key = await readKey(config);
        if (path === "/api/status") {const speech=await voiceSettings(config);return Response.json({configured:Boolean(key)||Boolean(await readKey(config,"NVIDIA_GPT_OSS_API_KEY"))||await geminiReady(config),isOwner:admin,geminiConfigured:await geminiReady(config),...(admin?{geminiVoice:await selectedGeminiVoice(config)}:{}),decisionsConfigured:admin&&Boolean(await readKey(config,"OPENAI_API_KEY")),debateScoringConfigured:admin&&Boolean(await readKey(config,"OPENROUTER_API_KEY")),deepseekConfigured:admin&&Boolean(await readKey(config,"DEEPSEEK_API_KEY")),models:MODELS.filter(m=>m.available),visionConfigured:await geminiReady(config),webConfigured:Boolean(await readKey(config,"TAVILY_API_KEY")),voiceConfigured:speech.enabled&&(speech.provider==='polly'?await pollyReady(config):await geminiReady(config)),nativeVoiceEnabled:speech.enabled&&speech.provider==='gemini'}, {headers:{"Cache-Control":"no-store"}});}
        if(path==='/api/editor-plan')return run(()=>handleEditorPlan(request,key,config));
        if(path==='/api/decisions')return run(()=>handleDecisions(request,config));
        if(path==='/api/debate-score')return run(()=>handleDebateScore(request,config));
        if(path==='/api/debate-check')return run(()=>handleDebateCheck(request,key,config));
        if(path==='/api/debate')return run(()=>handleDebate(request,key,config));
        return run(()=>handleChat(request, key, config.NVIDIA_MODEL, fetch, config));
      } catch { console.error("SkyData protected route failed",{path}); return Response.json({error:"SkyData’s connection settings are unavailable. Try again."}, {status:503}); }
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};
