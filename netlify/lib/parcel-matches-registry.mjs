// The parcel-match audit documents the owner intake can import. Each file is written by tools/parcel-match/run.mjs.
// They are server-side only: they contain pending positions, which are never published.
import rochester from './data/parcel-matches/NY-city-of-rochester.json' with {type: 'json'};
import scott from './data/parcel-matches/IA-scott.json' with {type: 'json'};

export const MATCHES = Object.freeze({
  'NY-city-of-rochester': rochester,
  'IA-scott': scott,
});
