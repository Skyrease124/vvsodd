const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('kinvest-liens'),mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html',
 '.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
http.createServer((req,res)=>{
 let u;try{u=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const relative=u.replace(/^\/+/,'');let file=path.resolve(root,relative);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{
  if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  const ext=path.extname(file);
  res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');}
}).listen(8765,'127.0.0.1',()=>console.log('Serving map tests on port 8765'));
