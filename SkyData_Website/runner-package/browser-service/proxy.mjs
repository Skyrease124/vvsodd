// Per-job egress gateway: public DNS pinned at every request; HTTPS is inspected, not blindly tunneled.
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import {readFileSync} from 'node:fs';
import {publicUrl,resolvePublic} from './url-policy.mjs';
// The runner passes the site it is paired with; only an https:// origin (or http://localhost for local tests) is used.
const site=value=>{try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)?u.origin:null;}catch{return null;}};
const SITE=site(process.env.SKYDATA_SITE);
export function createProxy({certificate='/opt/proxy/cert.pem',privateKey='/opt/proxy/key.pem',relayToken=process.env.SKYDATA_JOB_TOKEN,jobId=process.env.SKYDATA_JOB_ID,resolveAddress=resolvePublic}={}){
 let total=0,requests=0,relayCalls=0;const sockets=new Set();
 const denied=(res,status=403)=>{res.writeHead(status);res.end('Blocked by SkyData public read-only browser policy.');};
 const server=http.createServer(async(req,res)=>{
  try{
   // This is a fixed local broker capability, not a user-controlled HTTP proxy target.
   if(req.url==='/__skydata_model'&&req.method==='POST'&&!req.socket.skydataTunnel){
    if(!SITE||!relayToken||req.headers['x-skydata-job-token']!==relayToken||++relayCalls>3)return denied(res);
    req.socket.setTimeout(50000);let raw='',bytes=0;for await(const c of req){bytes+=c.length;if(bytes>160000)return denied(res,413);raw+=c;}
    const params=JSON.parse(raw);
    const response=await fetch(SITE+'/api/engineering-runner/browser-model',{method:'POST',headers:{authorization:'Browser '+relayToken,'content-type':'application/json'},body:JSON.stringify({id:jobId,params}),redirect:'error',signal:AbortSignal.timeout(45000)});
    if(!response.ok){res.writeHead(response.status);return res.end('Browser model request failed.');}
    const text=await response.text();if(text.length>60000)return denied(res,413);res.writeHead(200,{'content-type':'application/json'});return res.end(text);
   }
   if(++requests>240||!['GET','HEAD'].includes(req.method))return denied(res);
   const tunnel=req.socket.skydataTunnel;
   const u=publicUrl(tunnel?'https://'+tunnel.host+req.url:req.url);
   if(tunnel&&(req.headers.host!==tunnel.host||!req.url.startsWith('/')||req.url.startsWith('//')))return denied(res);
   if(!tunnel&&u.protocol!=='http:')return denied(res);
   if(/\.(?:m3u8|mpd|mp4|m4s|ts|zip|exe|pdf)(?:\?|$)/i.test(u.pathname)||/(?:logout|signout|delete|purchase|checkout|subscribe)/i.test(u.pathname))return denied(res);
   const address=await resolveAddress(u.hostname);
   const transport=u.protocol==='https:'?https:http;
   const headers={host:u.host,'user-agent':String(req.headers['user-agent']||'SkyData public inspection'),accept:String(req.headers.accept||'*/*'),'accept-encoding':'identity'};
   // No cookies, Authorization, proxy credentials or client certificates forwarded to investigated websites.
   const upstream=transport.request({hostname:u.hostname,port:u.protocol==='https:'?443:80,path:u.pathname+u.search,method:req.method,headers,servername:u.hostname,rejectUnauthorized:true,lookup:(_host,options,callback)=>options?.all?callback(null,[address]):callback(null,address.address,address.family),timeout:20000},response=>{
    const type=String(response.headers['content-type']||'').toLowerCase();
    if(/^(video|audio)\//.test(type)||/mpegurl|dash\+xml|octet-stream/.test(type)){response.destroy();return denied(res);}
    const clean={...response.headers};delete clean['set-cookie'];delete clean['alt-svc'];delete clean['strict-transport-security'];
    res.writeHead(response.statusCode||502,clean);let bytes=0;
    response.on('data',d=>{bytes+=d.length;total+=d.length;if(bytes>4*1024*1024||total>24*1024*1024){response.destroy();res.destroy();}});
    response.pipe(res);
   });
   upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)denied(res,502);else res.destroy();});res.on('close',()=>upstream.destroy());upstream.end();
  }catch{if(!res.headersSent)denied(res);else res.destroy();}
 });
 server.on('connection',socket=>{sockets.add(socket);socket.setTimeout(25000,()=>socket.destroy());socket.on('close',()=>sockets.delete(socket));});
 server.on('upgrade',(_req,socket)=>socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'));
 server.on('connect',async(req,client,head)=>{
  try{
   const u=publicUrl('https://'+req.url);if(u.port&&u.port!=='443')throw Error();await resolveAddress(u.hostname);
   if(head.length)throw Error('Unexpected CONNECT body.');
   const context=tls.createSecureContext({key:readFileSync(privateKey),cert:readFileSync(certificate)});
   client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
   const secured=new tls.TLSSocket(client,{isServer:true,secureContext:context,ALPNProtocols:['http/1.1']});
   secured.skydataTunnel={host:u.host};secured.on('error',()=>client.destroy());server.emit('connection',secured);
  }catch{client.end('HTTP/1.1 403 Forbidden\r\n\r\n');}
 });
 server.closeJobs=()=>{for(const socket of sockets)socket.destroy();server.close();};
 return server;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const server=createProxy().listen(8080,'0.0.0.0');setTimeout(()=>{server.closeJobs();process.exit(0);},210000);
}
