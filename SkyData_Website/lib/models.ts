export const GEMINI_TEXT_MODEL='gemini-3.8-flash';
export const MODELS = [{id:'nvidia/nemotron-3-ultra-550b-a55b',label:'Nemotron 3 Ultra',available:true},{id:'nvidia/nemotron-3.5-lightning-30b-a3b',label:'Nemotron 3.5 Lightning',available:true},{id:'deepseek-flash',label:'DeepSeek Flash',available:false},{id:'deepseek-v4-pro',label:'DeepSeek Pro',available:false},{id:'openai/gpt-oss-20b',label:'GPT-OSS 20B',available:true},{id:'inclusionai/ling-3.1-flash',label:'Ling 3.1 Flash',available:false},{id:'nvidia/nemotron-3.5-super-vl-120b-a12b',label:'Nemotron 3.5 Super VL',available:true},{id:'stepfun-ai/step-5-preview',label:'Step 5 (preview, 1M context)',available:true},{id:GEMINI_TEXT_MODEL,label:'Gemini Flash',available:false}] as const;
// Gemini is switched off on this site (not offered, refused if sent); the id stays so old saved chats still load.
export const SUPER_VL_MODEL='nvidia/nemotron-3.5-super-vl-120b-a12b';
// Extra NVIDIA-hosted chat model while its free preview lasts (Engineering keeps its own three). Remove when it ends.
export const STEP5_MODEL='stepfun-ai/step-5-preview';
export const DEFAULT_MODEL = MODELS[0].id;
export function isSupportedModel(value: unknown): value is typeof MODELS[number]['id'] { return MODELS.some(model => model.id === value); }

export const DEEPSEEK_MODEL='deepseek-ai/deepseek-v4.1-flash';
export const GPT_OSS_MODEL='openai/gpt-oss-20b';
export const LING_MODEL='inclusionai/ling-3.1-flash';
export const OPENROUTER_ENDPOINT='https://openrouter.ai/api/v1/chat/completions';
export const LING_SETTINGS={temperature:.6,provider:{max_price:{prompt:0,completion:0},allow_fallbacks:false}};
export function modelSettings(model:string){return model===SUPER_VL_MODEL?{temperature:1,top_p:.95}:model===STEP5_MODEL?{temperature:.7,top_p:.95}:isDirectDeepseek(model)?{temperature:.6,thinking:{type:'disabled'}}:model===LING_MODEL?LING_SETTINGS:model===GPT_OSS_MODEL?{temperature:1,top_p:1,reasoning_effort:'low'}:model===DEEPSEEK_MODEL?{temperature:1,top_p:.95,chat_template_kwargs:{thinking:false}}:{temperature:.6,chat_template_kwargs:{enable_thinking:false}};}

export function isModelAvailable(value:unknown): value is typeof MODELS[number]["id"] {return MODELS.some(model=>model.id===value&&model.available);}

export const DEEPSEEK_ENDPOINT='https://api.deepseek.com/chat/completions';
export function isDirectDeepseek(model:unknown){return model==='deepseek-flash'||model==='deepseek-v4-pro';}
export function isPaidModel(model:unknown){return isDirectDeepseek(model);}

export function requestsPaidModel(payload:unknown){
 if(!payload||typeof payload!=='object')return false;
 const p=payload as {model?:unknown;models?:unknown};
 return isPaidModel(p.model)||Array.isArray(p.models)&&p.models.some(isPaidModel);
}

export const VISIBLE_MODELS = MODELS.filter(model => model.available);
// Engineering (Superpowers, REA explanations, website investigations) uses the NVIDIA-hosted models only, never Gemini.
export const ENGINEERING_MODELS = VISIBLE_MODELS.filter(model => model.id !== SUPER_VL_MODEL && model.id !== STEP5_MODEL);

export function modelProvider(model:string){return model===GEMINI_TEXT_MODEL?'Google Gemini':isDirectDeepseek(model)?'DeepSeek':model===LING_MODEL?'OpenRouter':'NVIDIA';}
