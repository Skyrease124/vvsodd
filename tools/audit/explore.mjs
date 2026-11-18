import { loadLiens, loadConst } from './load.mjs';
const L = loadLiens(); console.log('liens records', L.length, 'load errors', L.filter(x => x._loadError).map(x => x._loadError));
const by = {}; L.forEach(r => { const k = (r.state || 'FL') + '|' + r.county + '|' + r._file; by[k] = (by[k] || 0) + 1; }); console.log(by);
const st = {}; L.forEach(r => { const k = (r.status || '(none)').slice(0, 90); st[k] = (st[k] || 0) + 1; }); console.log(Object.entries(st).sort((a, b) => b[1] - a[1]).slice(0, 40));
const keys = {}; L.forEach(r => Object.keys(r).forEach(k => keys[k] = (keys[k] || 0) + 1)); console.log(keys);
