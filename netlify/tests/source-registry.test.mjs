import { SOURCES, byId, mayCall, integrated } from '../lib/source-registry.mjs'; import assert from 'node:assert/strict';
const ids = new Set(); for (const s of SOURCES) { assert(!ids.has(s.id), 'dup ' + s.id); ids.add(s.id); for (const k of ['name', 'owner', 'kind', 'coverage', 'access', 'reliability', 'update', 'limits']) assert(s[k], s.id + ' missing ' + k); assert(['official-primary', 'official-derived', 'third-party'].includes(s.reliability)); if (s.integrated) assert(s.usedBy.length, s.id + ' integrated but unused'); }
assert(mayCall('fema-nfhl', true) && !mayCall('fema-nfhl', false) && !mayCall('land-banks', true));
console.log('registry ok', SOURCES.length, 'sources,', integrated().length, 'integrated');
