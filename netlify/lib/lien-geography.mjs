import { COUNTY_STATES } from './county-geography.mjs';

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const keyFor = name => name.toLowerCase().replace(/ county$/, '');
const names = Object.keys(COUNTY_STATES).sort((a, b) => b.length - a.length).map(escape).join('|');
const countyNames = new RegExp('\\b(' + names + ')\\s+(?:county|parish|borough)\\b', 'gi');
const unknownCounty = /\b([a-z][\w'-]*)\s+(?:county|parish|borough)\b/gi;
const AMBIGUOUS_CODES = new Set(['IN', 'OR', 'OK', 'ME', 'HI', 'OH', 'DE', 'ID', 'AS', 'IT', 'US', 'MA', 'PA', 'AL', 'LA', 'MD', 'CA', 'CO', 'WA', 'MS', 'SD', 'AR']);

export function namedCounties(question, available) {
  const counties = new Map();
  const add = (name, qualified = name) => counties.set(keyFor(name), { key: keyFor(name), name, qualified });
  let remainder = question.replace(countyNames, (qualified, name) => { add(name, qualified); return ' '; });
  remainder = remainder.replace(unknownCounty, (qualified, name) => {
    if (/^(?:a|all|and|any|by|each|every|from|in|no|per|the|which|with|without|your)$/i.test(name)) return qualified;
    add(name, qualified);
    return ' ';
  });
  for (const name of available) {
    const base = name.replace(/ County$/, '');
    if (counties.has(keyFor(base))) continue;
    const pattern = new RegExp('(?:^|\\b(?:in|across|from|for)\\s+)' + escape(base) + '\\b', 'i');
    const match = remainder.match(pattern) || remainder.match(new RegExp('\\b' + escape(base) + '(?=\\s+(?:tax\\s+)?(?:liens?|parcels?)\\b)', 'i'));
    if (match && !(base === 'Mobile' && /\bmobile homes?\b/i.test(remainder))) add(base);
  }
  // Allow an unloaded county without a suffix when it is followed by a state separator.
  for (const match of remainder.matchAll(new RegExp('\\b(' + names + ')\\s*,', 'gi'))) add(match[1]);
  return { counties: [...counties.values()], remainder };
}

export function namedStates(question, states) {
  const matches = new Set();
  let rest = question;
  for (const { a, n } of [...states].sort((x, y) => y.n.length - x.n.length)) {
    rest = rest.replace(new RegExp('\\b' + escape(n).replace(/\s+/g, '\\s+') + '\\b', 'gi'), () => { matches.add(a); return ' '; });
  }
  for (const { a } of states) {
    const code = escape(a);
    if (new RegExp('(?:,\\s*|\\b(?:in|across|from|state of)\\s+)' + code + '\\b').test(rest)
      || !AMBIGUOUS_CODES.has(a) && new RegExp('\\b' + code + '\\b').test(rest)) matches.add(a);
  }
  return [...matches];
}

export function resolveLienGeography(named, scope, available, states) {
  const label = code => states.find(s => s.a === code)?.n || code;
  const requested = named.map(c => c.qualified);
  const candidates = [];
  for (const county of named) {
    const local = Object.keys(available).filter(c => keyFor(c) === county.key);
    const locations = new Set((Object.hasOwn(COUNTY_STATES, county.key) ? COUNTY_STATES[county.key].split(' ') : []).concat(local.map(c => available[c])));
    if (!locations.size) return { requested, message: 'I could not identify ' + county.qualified + '. Check the county name and include its state.' };
    const matched = [...locations].filter(code => !scope.length || scope.includes(code));
    if (!matched.length) return { requested, message: county.qualified + ' is in ' + [...locations].map(label).join(', ') + '. It does not match the requested state' + (scope.length === 1 ? ' ' : 's ') + scope.map(label).join(', ') + '.' };
    if (!scope.length && matched.length > 1) return { requested, message: county.qualified + ' is in more than one state (' + matched.map(label).join(', ') + '). Which state did you mean?' };
    candidates.push(...matched.map(state => ({ county: county.qualified, state, key: local.find(c => available[c] === state) })));
  }
  return { requested, candidates };
}
