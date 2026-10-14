// Runs SkyData's own built-Worker tests twice: as written (Cloudflare's Miniflare: D1 + R2) and with
// Miniflare swapped for fake-miniflare.mjs (Netlify Database + Netlify Blobs). Run from SkyData_Website.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fake = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-miniflare.mjs');
const IMPORT = /const \{Miniflare\}=await import\('\.\.\/node_modules\/\.pnpm\/'\+[A-Za-z]+\+'\/node_modules\/miniflare\/dist\/src\/index\.js'\);/;
const only = process.argv.slice(2);
const scripts = readdirSync('scripts').filter((f) => /^test-.*\.mjs$/.test(f) && IMPORT.test(readFileSync(path.join('scripts', f), 'utf8')) && (!only.length || only.includes(f)));

function run(file) {
  try {
    const out = execFileSync(process.execPath, [file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    return { ok: true, out: out.trim().split('\n').at(-1) };
  } catch (e) {
    const err = (e.stderr || e.stdout || String(e)).split('\n').filter((l) => l && !/^\s+at /.test(l));
    return { ok: false, out: err.slice(0, 6).join(' | ').slice(0, 600) };
  }
}

const rows = [];
for (const s of scripts) {
  const source = readFileSync(path.join('scripts', s), 'utf8');
  const copy = path.join('scripts', '.netlify-' + s);
  writeFileSync(copy, source.replace(IMPORT, `const {Miniflare}=await import(${JSON.stringify(fake)});`));
  const cloudflare = run(path.join('scripts', s));
  const netlify = run(copy);
  rmSync(copy);
  rows.push({ test: s, cloudflare: cloudflare.ok ? 'PASS' : 'FAIL', netlify: netlify.ok ? 'PASS' : 'FAIL', detail: netlify.ok ? '' : netlify.out, baseline: cloudflare.ok ? '' : cloudflare.out });
  console.log(`${s.padEnd(34)} Cloudflare: ${rows.at(-1).cloudflare}  Netlify: ${rows.at(-1).netlify}${netlify.ok ? '' : '\n    netlify: ' + netlify.out}${cloudflare.ok ? '' : '\n    cloudflare: ' + cloudflare.out}`);
}
writeFileSync(process.env.RESULTS ?? '/dev/null', JSON.stringify(rows, null, 2));
const regressions = rows.filter((r) => r.cloudflare === 'PASS' && r.netlify !== 'PASS');
console.log(`\n${rows.length} tests; ${rows.filter((r) => r.netlify === 'PASS').length} pass on Netlify storage; ${regressions.length} pass on Cloudflare but not Netlify`);
process.exit(regressions.length ? 1 : 0);
