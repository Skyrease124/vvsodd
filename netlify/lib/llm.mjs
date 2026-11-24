// Shared AI helper: calls NVIDIA's chat API and, if the model has been retired, finds a working one automatically.
const API_URL = process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';
export const DEFAULT_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';
// ---- Model selection: NVIDIA retires models, so if ours is gone we find a working one automatically. ----
const MODELS_URL = process.env.NVIDIA_MODELS_URL || API_URL.replace(/\/chat\/completions$/, '/models');
const SKIP = /embed|rerank|guard|safety|reward|vision|\bvl\b|vlm|clip|retriev|parse|asr|tts|image|audio|speech|translate|code|math|bge|nv-embed|riva|diffusion|flux|sdxl|video|molmim|bio|dna|protein/i;
const PREFER = [/nemotron.*(ultra|super)/i, /nemotron/i, /llama-3\.3/i, /llama-4/i, /llama-3\.1-70b/i, /gpt-oss-120b/i, /qwen.*(72b|32b|30b)/i, /gpt-oss/i, /llama-3\.1-8b/i, /mistral/i, /gemma/i, /deepseek/i, /./];
let autoModel = null;

export function rankModels(ids) {
  const ok = ids.filter(id => !SKIP.test(id) && /instruct|chat|nemotron|gpt-oss|qwen|llama|mistral|gemma|deepseek|phi/i.test(id));
  const out = [];
  PREFER.forEach(rx => ok.filter(id => rx.test(id) && !out.includes(id)).sort().reverse().forEach(id => out.push(id)));
  return out;
}
async function listModels(key) {
  const r = await fetch(MODELS_URL, {headers: {Authorization: 'Bearer ' + key, Accept: 'application/json'}});
  if (!r.ok) return [];
  const d = await r.json(); return (d.data || []).map(m => m.id).filter(Boolean);
}
async function chat(key, model, system, q, signal) {
  return fetch(API_URL, {
    method: 'POST', signal,
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + key},
    body: JSON.stringify({model, temperature: 0.1, max_tokens: 700, messages: [{role: 'system', content: system}, {role: 'user', content: q}]})
  });
}


// Returns {text, model}. Throws an Error with .status and .detail when the service fails.
export async function complete(cfg, system, user, opts = {}) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), opts.timeoutMs || 25000);
  const body = (model) => JSON.stringify({model, temperature: opts.temperature ?? 0.1, max_tokens: opts.maxTokens || 700, messages: [{role: 'system', content: system}, {role: 'user', content: user}]});
  const call = (model) => fetch(API_URL, {method: 'POST', signal: ctl.signal, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key}, body: body(model)});
  try {
    let model = cfg.model || autoModel || DEFAULT_MODEL;
    let r = await call(model);
    let fallbackFrom = null;
    if (!r.ok && [400, 404, 410].includes(r.status)) {
      // Logged without the key: which model NVIDIA refused, and with what status.
      fallbackFrom = {model, status: r.status};
      console.warn('NVIDIA refused model', model, 'with HTTP', r.status, '- trying a fallback');
      const tried = [model];
      let ids = []; try { ids = await listModels(cfg.key); } catch (e) {}
      for (const id of rankModels(ids).filter(x => x !== model).slice(0, 8)) {
        const r2 = await call(id); tried.push(id);
        if (r2.ok) { r = r2; model = id; autoModel = id; console.log('Using model', id); break; }
      }
      if (!r.ok) { const e = new Error('no working model'); e.status = 502; e.code = 'NO_MODEL'; e.upstreamStatus = r.status; e.detail = 'No working model found. Tried: ' + tried.join(', ').slice(0, 300); throw e; }
    }
    if (!r.ok) { let d = ''; try { d = (await r.text()).replace(/\s+/g, ' ').slice(0, 200); } catch (e) {} const e = new Error('nvidia error'); e.status = 502; e.code = 'UPSTREAM'; e.upstreamStatus = r.status; e.detail = 'NVIDIA said ' + r.status + (d ? ': ' + d : ''); throw e; }
    const out = await r.json();
    const choice = out && out.choices && out.choices[0];
    const raw = choice && choice.message && choice.message.content;
    const text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!text) {
      // NVIDIA answered (HTTP 200) but with no visible text: usually a reasoning model that spent the token limit thinking.
      const reasoning = !!(choice && choice.message && (choice.message.reasoning_content || /<think>/i.test(String(raw || ''))));
      const e = new Error('empty'); e.status = 502; e.code = 'EMPTY_ANSWER'; e.upstreamStatus = r.status; e.model = model; e.fallbackFrom = fallbackFrom;
      e.detail = 'Empty answer from ' + model + ' (finish: ' + ((choice && choice.finish_reason) || 'unknown') + (reasoning ? ', reasoning only' : '') + ')';
      throw e;
    }
    return {text, model, fallbackFrom};
  } finally { clearTimeout(timer); }
}
