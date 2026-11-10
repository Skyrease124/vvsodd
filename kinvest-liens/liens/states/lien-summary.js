// Which counties have real lien lists on the site (used by the home map's live dots and counters).
// Keep this in step with the liens-*.js files when a county is added or refreshed.
const LIEN_SUMMARY = [
  {state: 'FL', county: 'Palm Beach', count: 841},
  {state: 'FL', county: 'Leon', count: 113},
  {state: 'FL', county: 'Manatee', count: 297},
  {state: 'FL', county: 'Alachua', count: 226},
  {state: 'FL', county: 'Bay', count: 5},
  {state: 'FL', county: 'Miami-Dade', count: 263},
  {state: 'FL', county: 'Walton', count: 76},
  {state: 'FL', county: 'Santa Rosa', count: 662},
  {state: 'CO', county: 'Larimer', count: 1920},
  {state: 'CO', county: 'Saguache', count: 840},
  {state: 'AZ', county: 'Pinal', count: 88},
  {state: 'AZ', county: 'Coconino', count: 1421}
];

// Past sale records: history we show for learning (not open to buy). NYC = properties on its 2019-2025 lien sale lists (counts only);
// Middletown = liens in its September 2025 sale notice. Keep in step with nyc-history.js and middletown-ny.js.
const HISTORY_SUMMARY = [
  {state: 'NY', label: 'New York City lien sale lists, 2019 to 2025', count: 56396},
  {state: 'NY', label: 'Middletown, Sept 2025 sale', count: 197}
];
