import {createHash,randomBytes} from 'node:crypto';
import {request} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
// Chromium's unpacked-extension ID: first 16 SHA256 bytes mapped from hex to a-p.
export async function stagehandOrigin(){
 const path=await realpath(fileURLToPath(new URL('./extension/',import.meta.resolve('@browserbasehq/stagehand'))));
 const manifest=JSON.parse(await readFile(path+'/manifest.json','utf8'));
 const source=manifest.key?Buffer.from(manifest.key,'base64'):path;
 const id=createHash('sha256').update(source).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 return 'chrome-extension://'+id;
}
export function requireOriginRejected(websocketUrl,origin){
 const url=new URL(websocketUrl);
 if(url.protocol!=='ws:'||url.hostname!=='127.0.0.1'||url.username||url.password)throw Error('Unexpected local control endpoint.');
 return new Promise((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port:url.port,path:url.pathname,method:'GET',agent:false,headers:{Origin:origin,Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':randomBytes(16).toString('base64')}},res=>{res.resume();if(res.statusCode===403)resolve();else reject(Error('Chrome control origin guard did not reject with HTTP 403.'));});
  req.setTimeout(3000,()=>req.destroy(Error('Chrome control origin check timed out.')));
  req.on('upgrade',(_res,socket)=>{socket.destroy();reject(Error('Unsafe Chrome control origin accepted; investigation stopped.'));});
  req.on('error',reject);req.end();
 });
}
export async function verifyControlBoundary(){
 const res=await fetch('http://127.0.0.1:9222/json/version',{signal:AbortSignal.timeout(3000)});
 if(!res.ok)throw Error('Chrome control discovery failed.');
 const {webSocketDebuggerUrl}=await res.json();
 for(const origin of ['https://example.com','http://example.com','null','chrome-extension://'+'a'.repeat(32)])await requireOriginRejected(webSocketDebuggerUrl,origin);
 return true;
}
