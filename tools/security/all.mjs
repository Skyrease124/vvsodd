// Runs every security test, each in its own clean process. node tools/security/all.mjs
import { spawnSync } from 'node:child_process';
const T = ['matrix.mjs', 'owner.mjs', 'idor.mjs', 'roll.mjs', 'lifecycle.mjs', 'attacks.mjs', 'spend.mjs', 'portfolio-ai.mjs'];
const dir = new URL('.', import.meta.url).pathname; let fail = 0;
for (const t of T) { const r = spawnSync('node', [dir + t], { encoding: 'utf8', timeout: 120000 }); const out = (r.stdout || '') + (r.stderr || ''); const bad = /FAIL|UNEXPECTED|CONFIRMED/.test(out) && !/0 unexpected/.test(out) || /FAIL/.test(out);
  console.log('== ' + t + (bad ? '  <-- needs a look' : '  ok')); if (bad) { fail++; console.log(out.split('\n').filter(l => /FAIL|UNEXPECTED|CONFIRMED/.test(l)).join('\n')); } else console.log(out.split('\n').filter(l => /passed|checks|burst|responses|next single/.test(l)).slice(-3).join('\n')); }
process.exit(fail ? 1 : 0);
