export const PROJECT_PREFIX='SKYDATA_PROJECT_V1\n';
export function safePath(path){return typeof path==='string'&&path.length<=240&&path.split('/').every(p=>/^[a-zA-Z0-9_][a-zA-Z0-9_. -]*$/.test(p)&&p!=='.'&&p!=='..')&&!/(?:^|\/)(?:node_modules|vendor|dist|build|coverage|__MACOSX)(?:\/|$)/i.test(path)&&!/(?:secret|credential|token|private[ _-]?key|service[ _-]?account)/i.test(path)&&/\.(?:[cm]?js|json|html?|css|md|txt|ts|tsx|jsx)$/i.test(path);}
export function validBundle(b){
 if(!b||typeof b.name!=='string'||b.name.length>300||!Array.isArray(b.files)||!b.files.length||b.files.length>100||typeof b.entry!=='string'||!b.files.some(f=>f.path===b.entry)||!/\.(?:[cm]?js)$/i.test(b.entry))return false;
 const seen=new Set();let size=0;
 for(const f of b.files){if(!f||!safePath(f.path)||typeof f.text!=='string'||f.text.includes('\0')||seen.has(f.path.toLowerCase()))return false;seen.add(f.path.toLowerCase());size+=new TextEncoder().encode(f.text).length;if(size>400000)return false;}
 return true;
}
export function projectScript(bundle){
 if(!validBundle(bundle))throw Error('Invalid project bundle.');
 return `const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');\nconst bundle=${JSON.stringify(bundle)};\nconst root=fs.mkdtempSync('/tmp/skydata-project-');\nfor(const file of bundle.files){const target=path.join(root,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file.text);}\nconsole.log('Selected project files: '+bundle.files.length+'; test entry: '+bundle.entry);\nconst result=cp.spawnSync(process.execPath,['--test','--test-reporter=tap','--',bundle.entry],{cwd:root,encoding:'utf8',timeout:8000,maxBuffer:60000,env:{PATH:process.env.PATH,HOME:'/tmp'}});\nprocess.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');\nif(result.error){console.error(result.error.code||'Test process error');process.exit(result.error.code==='ETIMEDOUT'?124:1);}process.exit(result.status===null?1:result.status);`;
}
