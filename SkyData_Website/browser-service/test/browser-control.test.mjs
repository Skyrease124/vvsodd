import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {stagehandOrigin,requireOriginRejected} from '../browser-control.mjs';
test('control origin is a single installed extension, never wildcard',async()=>{
 assert.match(await stagehandOrigin(),/^chrome-extension:\/\/[a-p]{32}$/);
});
test('real HTTP handshake: guard requires explicit rejection and fails on accepted WebSocket',async()=>{
 let accept=false;const seen=[];const server=createServer();
 server.on('upgrade',(req,socket)=>{
  seen.push(req.headers.origin);
  if(!accept){socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');return;}
  const key=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+key+'\r\n\r\n');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='ws://127.0.0.1:'+server.address().port+'/devtools/browser/test';
 try{
  await requireOriginRejected(url,'https://example.com');assert.equal(seen[0],'https://example.com');
  accept=true;await assert.rejects(requireOriginRejected(url,'null'),/Unsafe Chrome control origin accepted/);
  assert.throws(()=>requireOriginRejected('ws://10.0.0.1:9222/','null'),/Unexpected local/);
 }finally{await new Promise(r=>server.close(r));}
});
