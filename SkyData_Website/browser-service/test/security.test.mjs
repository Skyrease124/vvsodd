import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {publicUrl,publicAddress,resolvePublic} from '../url-policy.mjs';
import {createProxy} from '../proxy.mjs';
test('URL canonicalization rejects private, encoded, credentials and unsupported schemes/ports',()=>{
 for(const value of ['http://localhost','http://127.1','http://2130706433','http://0x7f000001','http://10.0.0.1','http://169.254.169.254/latest/meta-data/','http://[::1]','http://[::ffff:127.0.0.1]','http://metadata.google.internal','http://printer.local','file:///etc/passwd','ftp://example.com','https://user:password@example.com','https://example.com:22'])assert.throws(()=>publicUrl(value),value);
 assert.equal(publicUrl('https://example.com/path#frag').href,'https://example.com/path');
});
test('IP classification includes mapped IPv6 and reserved ranges',()=>{
 for(const a of ['0.0.0.0','127.0.0.1','10.2.3.4','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','198.18.0.1','192.0.2.1','224.0.0.1','255.255.255.255','::1','fc00::1','fe80::1','2001:db8::1','::ffff:10.1.1.1'])assert.equal(publicAddress(a),false,a);
 assert.equal(publicAddress('93.184.216.34'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
});
test('mixed DNS answers rejected; rebinding cannot affect the returned literal address',async()=>{
 await assert.rejects(resolvePublic('example.com',async()=>[{address:'93.184.216.34',family:4},{address:'127.0.0.1',family:4}]));
 let calls=0;const lookup=async()=>++calls===1?[{address:'93.184.216.34',family:4}]:[{address:'10.0.0.1',family:4}];
 const pinned=await resolvePublic('example.com',lookup);assert.equal(pinned.address,'93.184.216.34');assert.equal(calls,1);await assert.rejects(resolvePublic('example.com',lookup));
});
test('real CONNECT proxy refuses loopback/metadata tunnels',async()=>{
 const proxy=createProxy();await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
 try{for(const target of ['127.0.0.1:443','169.254.169.254:443','[::1]:443','metadata.google.internal:443']){
  const text=await new Promise((resolve,reject)=>{const socket=net.connect(proxy.address().port,'127.0.0.1');socket.setTimeout(3000,()=>socket.destroy(Error('test timeout')));let data='';socket.on('connect',()=>socket.write('CONNECT '+target+' HTTP/1.1\r\nHost: '+target+'\r\n\r\n'));socket.on('data',d=>data+=d);socket.on('end',()=>resolve(data));socket.on('error',reject);});assert.match(text,/403 Forbidden/);
 }}finally{await new Promise(r=>proxy.close(r));}
});
