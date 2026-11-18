// Master Class hub data (public: it only repackages course outlines, glossaries and county records that are already public).
// Chapter map and path progress are personalized when signed in. Locked lesson text is never sent from here.
import * as auth from '../lib/auth.mjs';
import { COURSES } from '../lib/curriculum/index.mjs';
import { CHAPTERS, PATHS, chapterMap, pathsFor, glossary, searchGlossary, countyList, countyPage } from '../lib/curriculum/hub.mjs';
import { _loadData } from './ask.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });
const priv = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const HERE = path.dirname(fileURLToPath(import.meta.url));
function readJs(name, fallback) { const root = process.env.LAMBDA_TASK_ROOT || process.cwd(); for (const d of [path.join(root, 'kinvest-liens/liens/states'), path.join(HERE, '../../kinvest-liens/liens/states'), path.join(process.cwd(), 'kinvest-liens/liens/states')]) { try { return fs.readFileSync(path.join(d, name), 'utf8'); } catch (e) { /* next */ } } return fallback; }
let SUM = null; function summary() { if (SUM) return SUM; try { SUM = new Function(readJs('lien-summary.js', 'const LIEN_SUMMARY=[];') + '\n;return LIEN_SUMMARY;')(); } catch (e) { SUM = []; } return SUM; }
let SALES = null; function sales() { if (SALES) return SALES; try { SALES = JSON.parse(readJs('upcoming-sales.json', '{}')); } catch (e) { SALES = {}; } return SALES; }

export default async (req) => {
  const u = new URL(req.url);
  if (u.searchParams.get('glossary')) { const list = glossary(), q = u.searchParams.get('q') || ''; return json(200, { terms: searchGlossary(list, q), total: list.length, states: [...new Set(list.map(x => x.scope))] }); }
  if (u.searchParams.get('counties')) { const d = _loadData(); return json(200, { counties: countyList(d) }); }
  if (u.searchParams.get('county')) {
    const page = countyPage(String(u.searchParams.get('county')), _loadData(), sales(), summary(), new Date().toISOString().slice(0, 10));
    return page ? json(200, { county: page }) : json(404, { error: 'We do not have a county page for that name.' });
  }
  if (u.searchParams.get('paths')) {
    const id = String(u.searchParams.get('c') || 'fl').toLowerCase(), c = COURSES[id]; if (!c || c.status !== 'published') return json(404, { error: 'That course is not published yet.' });
    const me = await auth.userFromCookie(req.headers.get('cookie') || ''), prog = me && me.course && me.course[c.id];
    return priv(200, { course: { id: c.id, state: c.state, title: c.title, checked: c.checked }, courses: Object.values(COURSES).filter(x => x.status === 'published').map(x => ({ id: x.id, state: x.state })), signedIn: !!me, paid: auth.isPaid(me), chapters: chapterMap(c, prog), paths: pathsFor(c, prog) });
  }
  return json(400, { error: 'Ask for glossary, counties, county or paths.' });
};
