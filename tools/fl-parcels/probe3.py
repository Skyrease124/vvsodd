from net import fetch
U='https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query'
for co,c in [(39,["172714ZZZ000000093800U","U-14-27-17-ZZZ-000000-09380.0","A0009670000","0009670000","U1427172ZZ00000009380"]),(27,["211S301101025008","21-1S-30-1101-025-008","023125000"])]:
    w="CO_NO=%d AND PARCEL_ID IN (%s)"%(co,','.join("'%s'"%x for x in c))
    d=fetch(U,{'where':w,'outFields':'PARCEL_ID,ALT_KEY','returnGeometry':'false','f':'json'},timeout=90); print(co,[f['attributes'] for f in d['features']])
