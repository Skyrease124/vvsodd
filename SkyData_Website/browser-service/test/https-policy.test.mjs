import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createProxy} from '../proxy.mjs';
test('real TLS CONNECT terminates in the policy gateway: POST, smuggled host and WebSocket blocked',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'skydata-proxy-test-'));const key=join(dir,'key.pem'),cert=join(dir,'cert.pem');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=test-only','-keyout',key,'-out',cert],{stdio:'ignore'});
 const proxy=createProxy({certificate:cert,privateKey:key,resolveAddress:async()=>({address:'93.184.216.34',family:4})});await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
 async function request(raw){return new Promise((resolve,reject)=>{
  const plain=net.connect(proxy.address().port,'127.0.0.1');plain.setTimeout(5000,()=>plain.destroy(Error('test timeout')));plain.on('error',reject);
  plain.on('connect',()=>plain.write('CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n\r\n'));
  plain.once('data',d=>{assert.match(d.toString(),/200 Connection Established/);const secure=tls.connect({socket:plain,rejectUnauthorized:false,servername:'example.com'});secure.on('error',reject);secure.on('secureConnect',()=>secure.write(raw));let out='';secure.on('data',d=>{out+=d;if(out.includes('\r\n\r\n')){secure.destroy();resolve(out);}});});
 });}
 try{
  for(const raw of ['POST /submit HTTP/1.1\r\nHost: example.com\r\nContent-Length: 0\r\n\r\n','GET / HTTP/1.1\r\nHost: 169.254.169.254\r\n\r\n','GET /socket HTTP/1.1\r\nHost: example.com\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'])assert.match(await request(raw),/403 Forbidden/);
 }finally{proxy.closeJobs();await rm(dir,{recursive:true,force:true});}
});
