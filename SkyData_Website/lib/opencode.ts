// OpenCode Zen: an OpenAI-compatible gateway (https://opencode.ai/zen) that offers DeepSeek V4.1 Flash for free for a
// limited time. It is an extra, optional chat model: the owner pastes an OpenCode API key once on /connect-opencode
// (works from a phone), SkyData checks it against Zen's model list, remembers which free DeepSeek Flash model Zen
// offers, and saves both encrypted. When the free offer ends, replies say so and the other models keep working.
import { issueCsrf, verifyCsrf } from './connection-page';
import { saveKey, type SecretEnv } from './secret-store';

export const OPENCODE_ENDPOINT = 'https://opencode.ai/zen/v1/chat/completions';
const MODELS_URL = 'https://opencode.ai/zen/v1/models';
// Zen model ids, best first: the V4.1 free model the offer names, then the V4 free model, then any free DeepSeek Flash.
export function pickFreeDeepseek(ids: string[]) {
  return ids.find((id) => /^deepseek-v4\.1-flash-free$/.test(id)) ?? ids.find((id) => /^deepseek-v4-flash-free$/.test(id)) ?? ids.find((id) => /deepseek.*flash.*free/i.test(id));
}

/** Verifies an OpenCode key with Zen's model list and saves it with the free model's id. */
export async function setupOpenCodeKey(value: string, env: SecretEnv, upstream: typeof fetch = fetch) {
  if (value.length < 20 || value.length > 1024 || !/^[\x21-\x7e]+$/.test(value)) throw Error('Paste only the complete OpenCode API key, without spaces or extra code.');
  const response = await upstream(MODELS_URL, { headers: { Authorization: 'Bearer ' + value }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'OpenCode rejected this key. Copy the complete key from opencode.ai/zen and try again.' : 'OpenCode could not check this key right now. Try again shortly.');
  const data = (await response.json().catch(() => ({}))) as { data?: { id?: unknown }[] };
  const ids = (data.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string');
  const model = pickFreeDeepseek(ids);
  if (!model) throw Error('This OpenCode account does not list a free DeepSeek Flash model right now (the free offer may have ended). Your key was not saved.');
  await saveKey(env, value, 'OPENCODE_API_KEY');
  await saveKey(env, model, 'OPENCODE_MODEL_ID');
  return model;
}

const escape = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function page(message: string, connected: boolean, status: number, csrf: string) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Connect OpenCode · SkyData</title><style>body{margin:0;background:#080d17;color:#f1f5fa;font-family:Arial,sans-serif}main{max-width:480px;margin:8vh auto;padding:28px}h1{font-size:30px}p,li{line-height:1.6;color:#b7c9df}input,button{box-sizing:border-box;width:100%;font:inherit;font-size:16px;border-radius:10px;padding:16px}input{border:1px solid #56718d;background:#111d2e;color:white}button{margin-top:18px;background:#9bdfff;border:0;color:#082036;cursor:pointer}a{color:#9bdfff}.result{padding:18px;border:1px solid ${connected ? '#76d9ad' : '#ffb8ba'};border-radius:10px;color:${connected ? '#76d9ad' : '#ffb8ba'}}</style></head><body><main><h1>${connected ? 'OpenCode connected' : 'Connect OpenCode'}</h1>${message ? `<p class="result" role="${connected ? 'status' : 'alert'}">${escape(message)}</p>` : ''}${connected ? '' : `<p>Adds <strong>DeepSeek V4.1 Flash (free, OpenCode)</strong> as an extra chat model while OpenCode's free offer lasts.</p><ol><li>On your phone, open <a href="https://opencode.ai/zen" target="_blank" rel="noopener noreferrer">opencode.ai/zen</a> and sign in.</li><li>Create an API key and copy it.</li><li>Paste it below.</li></ol><p>SkyData checks it with OpenCode and saves it encrypted. Free models on OpenCode may be used by the provider to improve their service, so don't send private information with this model.</p><form action="/connect-opencode" method="post"><input type="hidden" name="csrf" value="${escape(csrf)}"><label for="key">OpenCode API key</label><input id="key" name="key" type="password" required maxlength="1024" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Paste your complete API key"><button type="submit">Connect</button></form>`}<p><a href="/" target="_top">Back to SkyData chat</a></p></main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
}

/** /connect-opencode: the owner's key form (GET) and its submission (POST, same-origin with a signed form token). */
export async function handleOpenCodeConnection(request: Request, env: SecretEnv) {
  try {
    const csrf = await issueCsrf(request, env);
    if (request.method === 'GET') return page('', false, 200, csrf);
    if (request.method !== 'POST') return page('Use the Connect button.', false, 405, csrf);
    const origin = request.headers.get('origin');
    if (origin !== new URL(request.url).origin && !(origin === 'null' && request.headers.get('sec-fetch-site') === 'same-origin')) return page('Open this page from SkyData and try again.', false, 403, csrf);
    const body = await request.text();
    if (body.length > 4096) return page('Paste only your API key.', false, 400, csrf);
    const form = new URLSearchParams(body);
    if (!(await verifyCsrf(form.get('csrf') || '', request, env))) return page('The page expired. Paste your key and try again.', false, 403, csrf);
    const key = (form.get('key') || '').trim().replace(/^Bearer\s+/i, '');
    try {
      const model = await setupOpenCodeKey(key, env);
      return page(`Your OpenCode key was verified and saved (model ${model}). Return to chat and pick “DeepSeek V4.1 Flash (free, OpenCode)”.`, true, 200, csrf);
    } catch (e) {
      return page(e instanceof Error ? e.message : 'Could not connect OpenCode.', false, 502, csrf);
    }
  } catch {
    return page('Could not connect. Reload this page and try again.', false, 503, '');
  }
}
