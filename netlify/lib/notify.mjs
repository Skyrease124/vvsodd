// In-site notifications (the bell). One small list per member: nt_<uid> {items:[{id,kind,actor,text,path,at,read,group}]}.
// Likes on the same post within an hour are grouped into one line. Private message text is never stored here.
import crypto from 'node:crypto';
import * as auth from './auth.mjs';
const now = () => new Date().toISOString();
export async function add(uid, { kind, actor, text, path, group }) {
  if (!uid || !/^[a-f0-9]{16}$/.test(uid)) return; const k = 'nt_' + uid, box = (await auth.kvGet(k)) || { items: [] };
  const g = group ? box.items.find(x => x.group === group && !x.read && Date.now() - Date.parse(x.at) < 3600e3) : null;
  if (g) { g.actors = [...new Set([actor].concat(g.actors || [g.actor]))].slice(0, 20); g.actor = actor; g.at = now(); }
  else box.items.unshift({ id: crypto.randomBytes(5).toString('hex'), kind, actor, actors: [actor], text: String(text || '').slice(0, 140), path: /^\/(?!\/)/.test(path || '') ? path : '/', group: group || '', at: now(), read: false });
  box.items.sort((a, b) => (a.at < b.at ? 1 : -1)); box.items = box.items.slice(0, 100); await auth.kvPut(k, box);
}
export async function list(uid) { return ((await auth.kvGet('nt_' + uid)) || { items: [] }).items; }
export async function unread(uid) { return (await list(uid)).filter(x => !x.read).length; }
export async function markRead(uid) { const k = 'nt_' + uid, box = (await auth.kvGet(k)) || { items: [] }; box.items.forEach(x => { x.read = true; }); await auth.kvPut(k, box); return { ok: true }; }
