// Curated public webcams. Coordinates, names and viewing pages come from the operator's own webcam map
// (https://www.visitfortmyers.com/webcams, map data checked 2026-11-17). Embedding is not offered: the operator's reuse/embed
// terms were not confirmed, so every camera opens on the official page ("Open official camera").
const V = 'https://www.visitfortmyers.com/webcams#';
const cam = (id, name, area, lat, lng, anchor, type) => ({ src: 'fmy', id, name, road: area, direction: '', lat, lng, kind: 'viewer', type, image: '', video: '', embed: '',
  viewer: V + anchor, operator: 'Visit Fort Myers (Lee County Visitor & Convention Bureau)', sourceMeta: 'Curated from the official webcam map, 2026-11-17' });
export const BEACH_CAMS = [
  cam('gasparilla', 'Gasparilla Island State Park', 'Boca Grande', 26.717324, -82.260861, 'boca-grande', 'Beach cam'),
  cam('turner', 'Turner Beach', 'Captiva Island', 26.483035, -82.183891, 'captiva-island', 'Beach cam'),
  cam('ding', 'J.N. "Ding" Darling National Wildlife Refuge', 'Sanibel Island', 26.47759475, -82.143702065739, 'jn-ding-darling-wildlife-refuge', 'Weather cam'),
  cam('lighthouse', 'Lighthouse Beach Park', 'Sanibel Island', 26.45223035, -82.015972261437, 'sanibel-island', 'Beach cam'),
  cam('timessq', 'Times Square', 'Fort Myers Beach', 26.452566, -81.956567, 'fort-myers-beach', 'Beach cam'),
  cam('loverskey', 'Lovers Key State Park', 'Fort Myers Beach', 26.396858, -81.872962, 'lovers-key-state-park', 'Beach cam'),
  cam('wonder', 'Wonder Gardens', 'Bonita Springs', 26.343316, -81.779601, 'bonita-springs', 'Weather cam'),
  cam('manatee', 'Manatee Park', 'Fort Myers', 26.693739, -81.778557, 'manatee-park', 'Weather cam'),
  cam('davis', 'Sidney & Berne Davis Art Center', 'Fort Myers', 26.645388, -81.868543, 'fort-myers', 'Weather cam'),
  cam('northshore', 'North Shore Park', 'North Fort Myers', 26.656312, -81.882023, 'north-fort-myers', 'Weather cam'),
  cam('prairiepines', 'Prairie Pines Preserve', 'North Fort Myers', 26.730868, -81.896452, 'prairie-pines-preserve', 'Weather cam'),
  cam('butterfly', 'Tom Allen Memorial Butterfly House', 'Cape Coral', 26.548365, -81.981341, 'cape-coral', 'Weather cam'),
  cam('knights', 'Knights Landing', 'Pine Island', 26.711111, -82.1625, 'pine-island', 'Weather cam'),
];
