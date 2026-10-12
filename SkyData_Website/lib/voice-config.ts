import type { SecretEnv } from './secret-store';

export const POLLY_ENGINES = ['standard','neural','long-form','generative'] as const;
export type PollyEngine = typeof POLLY_ENGINES[number];
export type VoiceSettings = {
 provider:'polly'|'gemini'; enabled:boolean; engine:PollyEngine; voice:string;
 speed:number; monthlyCharacters:number; monthlyBudget:number|null; alertPercent:number;
 prices:Record<PollyEngine,number|null>;
};
export const DEFAULT_VOICE_SETTINGS:VoiceSettings={provider:'polly',enabled:true,engine:'standard',voice:'Joanna',speed:1,monthlyCharacters:100000,monthlyBudget:null,alertPercent:80,prices:{standard:null,neural:null,'long-form':null,generative:null}};
export function voiceOriginAllowed(request:Request){const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');return site!=='cross-site'&&(origin===new URL(request.url).origin||(origin==='null'&&site==='same-origin'));}
export function normalizeVoiceSettings(value:unknown):VoiceSettings {
 const v=value as VoiceSettings;
 if(!v||!['polly','gemini'].includes(v.provider)||typeof v.enabled!=='boolean'||!POLLY_ENGINES.includes(v.engine)||typeof v.voice!=='string'||! /^[A-Za-z0-9]{1,40}$/.test(v.voice)||!Number.isFinite(v.speed)||v.speed<.5||v.speed>1.5||!Number.isSafeInteger(v.monthlyCharacters)||v.monthlyCharacters<1||v.monthlyCharacters>100000000||!Number.isFinite(v.alertPercent)||v.alertPercent<1||v.alertPercent>100||!(v.monthlyBudget===null||Number.isFinite(v.monthlyBudget)&&v.monthlyBudget>0&&v.monthlyBudget<=100000))throw Error('Choose valid voice settings and usage limits.');
 const prices={} as VoiceSettings['prices'];
 for(const engine of POLLY_ENGINES){const n=v.prices?.[engine];if(!(n===null||Number.isFinite(n)&&n>=0&&n<=10000))throw Error('Enter prices per million characters, or leave them blank.');prices[engine]=n;}
 if(v.monthlyBudget!==null&&POLLY_ENGINES.some(e=>prices[e]===null))throw Error('Configure a price for every engine before enabling a dollar spending limit.');
 return {provider:v.provider,enabled:v.enabled,engine:v.engine,voice:v.voice,speed:v.speed,monthlyCharacters:v.monthlyCharacters,monthlyBudget:v.monthlyBudget,alertPercent:v.alertPercent,prices};
}
export async function voiceSettings(env:SecretEnv):Promise<VoiceSettings>{
 if(!env.DB)return structuredClone(DEFAULT_VOICE_SETTINGS);
 const row=await env.DB.prepare("SELECT value FROM polly_settings WHERE id='global'").first<{value:string}>();
 return row?.value?normalizeVoiceSettings(JSON.parse(row.value)):structuredClone(DEFAULT_VOICE_SETTINGS);
}
export async function geminiSpeechEnabled(env:SecretEnv){const settings=await voiceSettings(env);return settings.enabled&&settings.provider==='gemini';}
