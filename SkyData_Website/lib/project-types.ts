export type ProjectAttachment={id:string;name:string;paths?:string[]};
// Netlify Functions accept at most 6 MB per request, Cloudflare R2 needs 5 MiB+ parts: the Netlify build sets VITE_SKYDATA_NETLIFY.
export const PROJECT_LIMIT=500*1024*1024,PART_SIZE=(import.meta.env.VITE_SKYDATA_NETLIFY?3:8)*1024*1024;
export function validProject(v:unknown):v is ProjectAttachment{const p=v as ProjectAttachment;return !!p&&typeof p.id==='string'&&/^[a-f0-9-]{36}$/.test(p.id)&&typeof p.name==='string'&&p.name.length>0&&p.name.length<=300&&(p.paths===undefined||Array.isArray(p.paths)&&p.paths.length>0&&p.paths.length<=20&&new Set(p.paths).size===p.paths.length&&p.paths.every(x=>typeof x==='string'&&x.length>0&&x.length<=1000));}
