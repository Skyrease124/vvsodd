import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
export function publicAddress(value) {
 try { let a=ipaddr.parse(value);if(a.kind()==='ipv6'&&a.isIPv4MappedAddress())a=a.toIPv4Address();return a.range()==='unicast'; } catch { return false; }
}
export function publicUrl(value) {
 if(typeof value!=='string'||value.length>2048)throw Error('Invalid URL.');
 const u=new URL(value);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port))throw Error('Use a public HTTP(S) website on port 80 or 443, without credentials.');
 const h=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();
 if(!h.includes('.')&&!h.includes(':')||/(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(h)||h==='metadata.google.internal'||ipaddr.isValid(h)&&!publicAddress(h))throw Error('Private or reserved destination blocked.');
 u.hash='';return u;
}
export async function resolvePublic(host,lookup=dns.lookup) {
 host=host.replace(/^\[|\]$/g,'');
 const answers=await lookup(host,{all:true,verbatim:true});
 if(!answers.length||answers.some(a=>!publicAddress(a.address)))throw Error('DNS resolved to a private or reserved address.');
 // Caller connects to this literal IP, never resolves the hostname again.
 return answers[0];
}
