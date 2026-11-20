#!/usr/bin/env python3
"""Review-only import of Palm Beach County's official county-held certificate XLSX."""
import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

def load_module(name, filename):
    spec=importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

_wakulla=load_module('wakulla', 'stage-wakulla-certificates.py')
URL='https://www.pbctax.gov/wp-content/uploads/2026/11/County_Certs_PBCTax-11.2.26.xlsx'
def normalize(rows):
    if len(rows)<2:raise ValueError('No certificate records')
    head=[re.sub(r'[^a-z0-9]','',s.lower()) for s in rows[0]]
    required={'pin':'parcelId','certificatenumber':'certificateNumber','taxyear':'taxYear',
              'faceamount':'faceAmountRaw','interestrate':'interestRateRaw','totalamt':'totalAmountRaw'}
    missing=[name for name in required if name not in head]
    if missing:raise ValueError('Missing Palm Beach columns: '+','.join(missing))
    indexes={out:head.index(col) for col,out in required.items()}
    seen=set();accepted=[];rejected=[]
    for number,cells in enumerate(rows[1:],2):
        def read(col):
            ix=indexes[col]
            return str(cells[ix]).strip() if ix<len(cells) else ''
        parcel=read('parcelId')
        cert=read('certificateNumber')
        year=read('taxYear')
        problems=[]
        if not parcel or not cert or len(parcel)>100 or len(cert)>100:problems.append('Missing/invalid parcel or certificate ID')
        key=(parcel.casefold(),cert.casefold(),year)
        if key in seen:problems.append('Duplicate parcel/certificate/year')
        seen.add(key)
        money={}
        for col in ('faceAmountRaw','totalAmountRaw'):
            raw=read(col)
            if raw and not re.fullmatch(r'\$?\d+(?:,\d{3})*(?:\.\d{1,2})?',raw):
                problems.append('Invalid '+col)
            money[col]=raw or None
        rate=read('interestRateRaw')
        if rate and not re.fullmatch(r'\d+(?:\.\d+)?%?',rate):problems.append('Invalid interest rate')
        if problems:
            rejected.append({'row':number,'errors':problems})
            continue
        accepted.append({'state':'FL','county':'Palm Beach','parcelId':parcel,
                         'certificateNumber':cert,'taxYear':year or None,
                         'faceAmountRaw':money['faceAmountRaw'],
                         'totalAmountRaw':money['totalAmountRaw'],
                         'interestRateRaw':rate or None,
                         'sourceUrl':URL,'status':'unverified','availableForPurchase':False})
    return {'source':URL,'checkedAt':datetime.now(timezone.utc).isoformat(),
            'classification':'official county-held certificate file; verify availability with Tax Collector',
            'summary':{'received':len(rows)-1,'accepted':len(accepted),'rejected':len(rejected)},
            'rejected':rejected[:100],'records':accepted}
def main():
    probe=load_module('probe','probe-county-certificate-files.py')
    result=normalize(_wakulla.load_rows(probe.download(URL)))
    if not result['records'] or result['summary']['rejected']:
        raise ValueError('Refusing staging due to failed records: '+json.dumps(result['summary']))
    out=Path('county-import-staging/fl-palm-beach-certificate-export.json')
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'staged':str(out),'summary':result['summary'],'sample':result['records'][:1]},indent=2))
if __name__=='__main__':
    try:main()
    except Exception as exc:print('Palm Beach staging failed:',exc,file=sys.stderr);sys.exit(1)
