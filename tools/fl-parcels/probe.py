import json, re
from net import fetch
U='https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query'
L=json.load(open('work/listings.json'))
CO={'Palm Beach':60,'Hillsborough':39,'Escambia':27,'Manatee':51,'Leon':47}
def cands(p):
    s={p,p.replace('-',''),p.replace(' ',''),re.sub(r'[^A-Za-z0-9]','',p),p.replace('-',' '),p[1:],re.sub(r'\s+',' ',p)}
    return [c for c in s if c]
for name,co in CO.items():
    ps=[x['parcel'] for x in L if x['county']==name][:4]
    cs=sorted({c for p in ps for c in cands(p)})
    w="CO_NO=%d AND PARCEL_ID IN (%s)"%(co,','.join("'"+c.replace("'","")+"'" for c in cs))
    d=fetch(U,{'where':w,'outFields':'PARCEL_ID,ASMNT_YR','returnGeometry':'false','f':'json'},timeout=90)
    print(name,ps,'->',[f['attributes']['PARCEL_ID'] for f in d['features']])
