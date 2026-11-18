// Master Class hub: chapter map, learning paths, searchable glossary and county pages.
// Pure functions over data we already hold (state courses, state data, county buying steps, sale calendar, lien list summary).
// Nothing here invents a rule: every chapter points at real modules of each state course, and every county line comes from a county record.
import { COURSES, minutes } from './index.mjs';
import { NATIONAL } from './glossary.mjs';

// The ten chapters every state class is organized around. `modules` are 1-based module numbers in the state courses (all six share one 12-module layout).
export const CHAPTERS = [
  { n: 1, title: 'Introduction to the state’s tax sale system', modules: [1] },
  { n: 2, title: 'Tax liens versus tax deeds', modules: [1], foundations: true },
  { n: 3, title: 'How to find available properties', modules: [2, 4] },
  { n: 4, title: 'How to research parcels and owners', modules: [5] },
  { n: 5, title: 'Bidding and auction procedures', modules: [3] },
  { n: 6, title: 'Calculating potential returns and expenses', modules: [7] },
  { n: 7, title: 'Redemption, foreclosure and the tax deed process', modules: [8, 9] },
  { n: 8, title: 'Property due diligence', modules: [6] },
  { n: 9, title: 'Common mistakes and investment risks', modules: [7, 11] },
  { n: 10, title: 'Realistic examples and practice', modules: [10, 12], drills: true }
];
export const PATHS = [
  { id: 'beginner', title: 'Beginner', blurb: 'How the system works, where sales are listed and how bidding goes. Start here.', chapters: [1, 2, 3, 5], drillLevel: 1 },
  { id: 'intermediate', title: 'Intermediate', blurb: 'Research a parcel, check title and property problems, and run the numbers.', chapters: [4, 6, 8], drillLevel: 2 },
  { id: 'advanced', title: 'Advanced', blurb: 'Redemption and deed steps, costly mistakes, and a full practice project.', chapters: [7, 9, 10], drillLevel: 3 }
];

// Chapter map for one course: each chapter with the real modules and lessons that cover it, plus the member's progress.
export function chapterMap(c, progress) {
  const done = (progress && progress.lessons) || {};
  return CHAPTERS.map(ch => {
    const mods = ch.modules.map(i => c.modules[i - 1]).filter(Boolean);
    const lessons = mods.flatMap(m => m.lessons.map(l => ({ id: l.id, title: l.title, mins: minutes(l), free: !!m.free, done: !!done[l.id], module: m.id })));
    return { n: ch.n, title: ch.title, foundations: !!ch.foundations, drills: !!ch.drills, modules: mods.map(m => ({ id: m.id, title: m.title, free: !!m.free })), lessons, doneCount: lessons.filter(x => x.done).length, total: lessons.length, mins: lessons.reduce((t, x) => t + x.mins, 0) };
  });
}
export function pathsFor(c, progress) {
  const map = chapterMap(c, progress);
  return PATHS.map(p => {
    const chs = map.filter(x => p.chapters.includes(x.n)), seen = new Map(); // a lesson that serves two chapters counts once
    chs.forEach(x => x.lessons.forEach(l => seen.set(l.id, l)));
    const all = [...seen.values()];
    return { id: p.id, title: p.title, blurb: p.blurb, drillLevel: p.drillLevel, chapters: chs.map(x => x.n), total: all.length, done: all.filter(l => l.done).length, mins: all.reduce((t, l) => t + l.mins, 0) };
  });
}

// Searchable glossary. Each entry: term, definition, scope ('national' or a state code), source course (for state entries).
export function glossary() {
  const out = NATIONAL.map(([term, def]) => ({ term, def, scope: 'national', course: null }));
  for (const c of Object.values(COURSES)) if (c.status === 'published') for (const [term, def] of c.glossary || []) out.push({ term, def, scope: c.state, course: c.id, checked: c.checked });
  return out.sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }) || a.scope.localeCompare(b.scope));
}
export function searchGlossary(list, q) {
  const t = String(q || '').toLowerCase().trim(); if (!t) return list;
  const words = t.split(/\s+/);
  return list.map(e => { const hay = (e.term + ' ' + e.def).toLowerCase(); let s = 0; if (e.term.toLowerCase() === t) s += 100; else if (e.term.toLowerCase().startsWith(t)) s += 50; else if (e.term.toLowerCase().includes(t)) s += 30; for (const w of words) if (hay.includes(w)) s += 5; else return null; return { e, s }; }).filter(Boolean).sort((a, b) => b.s - a.s).map(x => x.e);
}

// County page from verified county records. data: {COUNTY_BUY, STATES}, sales: upcoming-sales.json, summary: LIEN_SUMMARY rows.
export function countyList(data) { return Object.keys(data.COUNTY_BUY).filter(k => !/^[A-Z]{2}-/.test(k)).sort(); }
export function countyPage(name, data, sales, summary, today) {
  const b = data.COUNTY_BUY[name]; if (!b) return null;
  const sc = sales && sales.counties && sales.counties[name];
  const state = (sc && sc.state) || (summary.find(r => String(r.county).replace(/ County$/, '') === name) || {}).state || null;
  const st = state && data.STATES.find(s => s.a === state);
  const course = state && Object.values(COURSES).find(c => c.state === state && c.status === 'published');
  const events = ((sales && sales.events) || []).filter(e => e.county === name && e.saleDate >= today).sort((a, b) => a.saleDate.localeCompare(b.saleDate));
  const lists = summary.filter(r => String(r.county).replace(/ County$/, '') === name && r.state === state);
  return {
    name, state, stateName: st ? st.n : null, office: b.office, phone: b.phone || null, status: b.status || null,
    system: st ? { sys: st.sys, rate: st.rate, redemption: st.red, bidding: st.bid, verify: !!st.v } : null,
    steps: b.steps, links: b.links.map(l => ({ name: l[0], url: l[1] })), record: b.record || null,
    officialSites: sc ? Object.entries(sc.links || {}).map(([n, u]) => ({ name: n, url: u })) : [], calendar: sc && sc.calendar ? sc.calendar : null,
    upcoming: events.slice(0, 5).map(e => ({ date: e.saleDate, time: e.saleTime || null, tz: e.tz || null, type: e.type, status: e.status, page: e.officialPage || e.auctionUrl || null, note: e.note || '' })),
    lists: lists.map(r => ({ count: r.count })), course: course ? { id: course.id, title: course.title, checked: course.checked } : null,
    notes: ['Procedures above come from our hand-checked county records. County pages change: confirm registration rules, deposits and dates on the official pages before you act.', 'Educational only. Not legal, tax or investment advice.']
  };
}
