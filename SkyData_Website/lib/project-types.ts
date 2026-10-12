export type ProjectAttachment={id:string;name:string};
export const PROJECT_LIMIT=500*1024*1024,PART_SIZE=8*1024*1024;
export function validProject(v:unknown):v is ProjectAttachment{const p=v as ProjectAttachment;return !!p&&typeof p.id==='string'&&/^[a-f0-9-]{36}$/.test(p.id)&&typeof p.name==='string'&&p.name.length>0&&p.name.length<=300;}
