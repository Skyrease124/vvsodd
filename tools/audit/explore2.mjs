import { loadLiens } from './load.mjs';
const L = loadLiens();
const norm = s => String(s || '(none)').replace(/\d+/g, '#').slice(0, 110);
const st = {}; L.forEach(r => { const k = (r._file.replace('liens-','').replace('.js','')) + ' :: ' + norm(r.status); st[k] = (st[k] || 0) + 1; });
Object.entries(st).sort().forEach(([k, v]) => console.log(v, k));
const keys = {}; L.forEach(r => Object.keys(r).forEach(k => keys[k] = (keys[k] || 0) + 1)); console.log(JSON.stringify(keys));
const sd = {}; L.forEach(r => { const k = String(r.saleDate || '(none)').replace(/\d/g,'#').slice(0,40); sd[k]=(sd[k]||0)+1 }); console.log(Object.entries(sd).sort((a,b)=>b[1]-a[1]).slice(0,12));
