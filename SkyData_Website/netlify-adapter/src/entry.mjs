// Netlify Function that runs SkyData's existing server (built for Cloudflare Workers by ChatGPT Sites)
// on Netlify: Netlify Database stands in for D1, Netlify Blobs for R2, and this file for the parts of
// ChatGPT Sites the site relied on (its identity headers, sign-in paths and secret key).
import worker from '../../dist/server/index.js';
import { D1OnPostgres } from './d1.mjs';
import { R2OnBlobs } from './r2.mjs';
import { ownerSetup, OWNER_SETUP_PATH } from './owner-setup.mjs';
import { protectedDownloads } from './downloads.mjs';

// Headers ChatGPT Sites (and Cloudflare) set after verifying a request. On Netlify nobody verifies them, so a
// visitor could send them to pose as the owner: they are always removed, and the site's own login session
// (which sets them internally after checking the password) is the only way in.
const UNTRUSTED_HEADER = /^(oai-|cf-|x-forwarded-for$|x-real-ip$|true-client-ip$)/i;
const ASSET_LOOP = 'x-skydata-asset-fetch';

function safeReturn(url) {
  const r = url.searchParams.get('return_to') || '/';
  return r.startsWith('/') && !r.startsWith('//') ? r : '/';
}

export function createHandler(deps) {
  let envPromise;
  const getEnv = (origin) => (envPromise ??= deps.makeEnv(origin));

  return async function handle(incoming, context = {}) {
    const url = new URL(incoming.url);
    // A static file the CDN did not have: never loop back into the site.
    if (incoming.headers.get(ASSET_LOOP)) return new Response('Not found', { status: 404 });

    // ChatGPT sign-in pages don't exist here; SkyData's own login replaces them.
    if (url.pathname === '/signin-with-chatgpt' || url.pathname === '/callback') return Response.redirect(new URL('/login', url), 303);
    if (url.pathname === '/signout-with-chatgpt') return Response.redirect(new URL(safeReturn(url) === '/' ? '/login' : safeReturn(url), url), 303);

    const headers = new Headers();
    for (const [k, v] of incoming.headers) if (!UNTRUSTED_HEADER.test(k)) headers.set(k, v);
    if (context.ip) headers.set('cf-connecting-ip', context.ip);
    const init = { method: incoming.method, headers, redirect: 'manual' };
    if (!['GET', 'HEAD'].includes(incoming.method)) {
      init.body = incoming.body;
      init.duplex = 'half';
    }
    const request = new Request(url, init);

    let env;
    try {
      env = await getEnv(url.origin);
    } catch (e) {
      envPromise = undefined; // try again on the next request
      console.error('SkyData storage is unavailable', e);
      return new Response('SkyData is starting up or its storage is unavailable. Reload in a moment.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '5' } });
    }
    if (url.pathname === OWNER_SETUP_PATH) return ownerSetup(request, env, deps.setupCodeHash);

    const ctx = {
      waitUntil: (p) => (context.waitUntil ? context.waitUntil(p) : p?.catch?.(() => {})),
      passThroughOnException() {},
      props: {},
    };
    return worker.fetch(request, env, ctx);
  };
}

/** Static files for the site's own server code (image resizing, protected downloads). */
export function assetsBinding(origin, downloads = protectedDownloads) {
  return {
    async fetch(input) {
      const req = input instanceof Request ? input : new Request(input);
      const path = new URL(req.url).pathname;
      if (path.startsWith('/downloads/')) {
        const file = downloads[path.slice('/downloads/'.length)];
        if (!file) return new Response('Not found', { status: 404 });
        return new Response(req.method === 'HEAD' ? null : file, { headers: { 'content-type': 'application/zip', 'content-length': String(file.byteLength) } });
      }
      return fetch(new URL(path + new URL(req.url).search, origin), { headers: { [ASSET_LOOP]: '1' } });
    },
  };
}

// Secrets and settings from Netlify environment variables, plus a site secret key kept in Blobs when the
// SKYDATA_SECRET_KEY variable isn't set (ChatGPT Sites provided one automatically).
// Netlify Functions run on AWS Lambda, which sets its own AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY /
// AWS_SESSION_TOKEN / AWS_REGION for the function itself. SkyData reads those names before the owner's
// saved Amazon Polly keys, so they must never reach the site: Polly would call AWS as Netlify and be denied.
const RUNTIME_VAR = /^(AWS_|LAMBDA_|_X_AMZN|_HANDLER$|_LAMBDA)/;

export async function siteEnv({ vars, pool, files, parts, system, origin }) {
  const env = Object.fromEntries(Object.entries(vars).filter(([k]) => !RUNTIME_VAR.test(k)));
  if (!/^[a-f0-9]{64}$/.test(env.SKYDATA_SECRET_KEY ?? '')) {
    let key = await system.get('secret-key', { consistency: 'strong' });
    if (!key) {
      const fresh = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
      await system.set('secret-key', fresh, { onlyIfNew: true });
      key = await system.get('secret-key', { consistency: 'strong' });
    }
    env.SKYDATA_SECRET_KEY = key;
  }
  env.DB = new D1OnPostgres(pool);
  env.FILES = new R2OnBlobs(files, parts);
  env.ASSETS = assetsBinding(origin);
  return env;
}
