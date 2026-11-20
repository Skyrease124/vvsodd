// Verify a key-based camera provider before switching it on (VERIFIED in netlify/functions/cameras.mjs).
// Run:  AZ511_KEY=... NODE_USE_ENV_PROXY=1 node tools/cameras/verify.mjs az      (or GA511_KEY=... ... ga)
// Prints the number of cameras, one real record, and checks that its preview image loads as a JPEG/PNG.
import { PROVIDERS } from '../../netlify/functions/cameras.mjs';
const id = process.argv[2], p = PROVIDERS[id];
if (!p || !p.keyed) { console.error('usage: node tools/cameras/verify.mjs az|ga|wi'); process.exit(2); }
if (!process.env[p.keyEnv]) { console.error(p.keyEnv + ' is not set'); process.exit(2); }
const list = await p.keyed.call(p);
const c = list[Math.floor(list.length / 2)];
console.log(p.name + ': ' + list.length + ' camera views'); console.log(JSON.stringify(c, null, 2));
const r = await fetch(c.image, { headers: { 'User-Agent': 'PricePocketAsset parcel research site (https://pricepocketasset.com)' } });
const type = r.headers.get('content-type') || '', size = (await r.arrayBuffer()).byteLength;
console.log('preview:', r.status, type, size + ' bytes', 'last-modified:', r.headers.get('last-modified') || 'none');
console.log(r.ok && /^image\//.test(type) && size > 2000 ? 'PREVIEW OK: open ' + c.viewer + ' and compare, then set VERIFIED.' + id + ' = true' : 'PREVIEW FAILED: do not enable');
