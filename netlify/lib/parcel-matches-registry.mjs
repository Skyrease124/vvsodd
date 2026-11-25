// The parcel-match audits the owner intake can import. Each file is written by tools/parcel-match and is server-side only:
// the pending positions in it are never published. A county becomes selectable in the owner dashboard when its audit
// is registered here. Nothing else (no endpoint default, no dashboard option) names a county.
import rochester from './data/parcel-matches/NY-city-of-rochester.json' with {type: 'json'};
import scott from './data/parcel-matches/IA-scott.json' with {type: 'json'};

export const MATCHES = Object.freeze({
  'NY-city-of-rochester': rochester,
  'IA-scott': scott,
});

export function datasetById(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(MATCHES, id) ? MATCHES[id] : null;
}

// The datasets for the owner dashboard's state and county selector, ordered by state and then county.
export function datasetList() {
  return Object.keys(MATCHES)
    .map(id => {
      const d = MATCHES[id];
      return {id, state: d.state, county: d.county, generatedAt: d.generatedAt,
        records: d.summary.records, matched: d.summary.matched, pending: d.summary.pending};
    })
    .sort((a, b) => a.state.localeCompare(b.state) || a.county.localeCompare(b.county));
}
