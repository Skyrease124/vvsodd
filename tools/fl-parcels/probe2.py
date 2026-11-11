from net import fetch
H='https://gis.hcpafl.org/arcgis/rest/services/Webmaps/HillsboroughFL_WebParcels/MapServer/0/query'
d=fetch(H,{'where':"folio='0009670000'",'outFields':'*','returnGeometry':'false','f':'json'})
print({k:v for k,v in d['features'][0]['attributes'].items() if v not in (None,'',0)} if d.get('features') else d)
E='https://gismaps.myescambia.com/arcgis/rest/services/Escambia_County/MapServer/0/query'
d=fetch(E,{'where':"CONTROLNO='023125000'",'outFields':'*','returnGeometry':'false','f':'json'})
print({k:v for k,v in d['features'][0]['attributes'].items() if v not in (None,'',0)} if d.get('features') else d)
