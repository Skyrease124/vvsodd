// Which counties have real lien lists on the site (used by the home map's live dots and counters).
// Keep this in step with the liens-*.js files when a county is added or refreshed.
const LIEN_SUMMARY = [
  {state: 'FL', county: 'Palm Beach', count: 841},
  {state: 'FL', county: 'Leon', count: 113},
  {state: 'FL', county: 'Manatee', count: 297},
  {state: 'FL', county: 'Alachua', count: 226},
  {state: 'FL', county: 'Bay', count: 5},
  {state: 'FL', county: 'Miami-Dade', count: 248},
  {state: 'FL', county: 'Walton', count: 76},
  {state: 'FL', county: 'Santa Rosa', count: 1950},
  {state: 'FL', county: 'Volusia', count: 950},
  {state: 'FL', county: 'Pasco', count: 100},
  {state: 'FL', county: 'Osceola', count: 2},
  {state: 'FL', county: 'Sarasota', count: 118},
  {state: 'FL', county: 'Duval', count: 116},
  {state: 'FL', county: 'Escambia', count: 27},
  {state: 'FL', county: 'Hillsborough', count: 47},
  {state: 'FL', county: 'Hernando', count: 27},
  {state: 'MS', county: 'State-held land', count: 6980},
  {state: 'FL', county: 'Nassau', count: 8},
  {state: 'CO', county: 'Larimer', count: 1920},
  {state: 'CO', county: 'Saguache', count: 840},
  {state: 'CO', county: 'El Paso', count: 171},
  {state: 'CO', county: 'Boulder', count: 661},
  {state: 'IA', county: 'Scott', count: 144},
  {state: 'TN', county: 'Davidson', count: 46},
  {state: 'AZ', county: 'Pinal', count: 88},
  {state: 'AZ', county: 'Coconino', count: 1421}
];

// Past sale records: history we show for learning (not open to buy). NYC = properties on its 2019-2025 lien sale lists (counts only);
// Middletown = liens in its September 2025 sale notice. Keep in step with nyc-history.js and middletown-ny.js.
const HISTORY_SUMMARY = [
  {state: 'NY', label: 'New York City lien sale lists, 2019 to 2025', count: 56396},
  {state: 'NY', label: 'Middletown, Sept 2025 sale', count: 197}
];
