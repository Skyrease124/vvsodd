import {open} from 'node:fs/promises';
// Startup logs are bounded and never include a scoped capability or provider credential.
export async function startupDiagnostics(path='/tmp/chromium-startup.log'){
 let file;
 try{
  file=await open(path,'r');const buffer=Buffer.alloc(8192);const {bytesRead}=await file.read(buffer,0,buffer.length,0);
  return buffer.subarray(0,bytesRead).toString('utf8').replace(/[a-f0-9]{64}/gi,'[redacted]').replace(/AIza[\w-]+|sk-[\w-]+/g,'[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]');
 }catch{return '';}
 finally{await file?.close();}
}
