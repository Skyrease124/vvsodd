#!/usr/bin/env python3
"""Stage official St Johns unpaid tax-certificate CSV for review only."""
import csv
import io
import json
import re
import sys
import urllib.request
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import datetime, timezone
from pathlib import Path

URL='https://sjctax.us/downloads/Unredeemed_County_Individual_Certificates.csv'
MAX_BYTES=15*1024*1024
MAX_ROWS=100000
REQUIRED={'PropertyNumber','BillYear','CertificateYear','CertificateNumber','CertificateType','FaceAmount',
          'DueAmount','CertificateStatus','RedemptionDate','TDA','ProcessDate'}
def parse_money(raw):
    if not raw.strip():return None
    try:
        n=Decimal(raw.replace(',','').replace('$',''))
        q=n.quantize(Decimal('0.01'),rounding=ROUND_HALF_UP)
        if not n.is_finite() or n<0 or n>Decimal('1000000000000') or abs(n-q)>Decimal('0.000001'):
            raise ValueError('Invalid amount')
        return format(q,'.2f')
    except (InvalidOperation,ValueError):
        raise ValueError('Invalid amount')
def normalize(text):
    reader=csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    if reader.fieldnames is None or not REQUIRED.issubset(set(reader.fieldnames)):
        raise ValueError('Official St Johns certificate schema changed')
    out=[];rejected=[];seen=set();counts={}
    for n,row in enumerate(reader,2):
        if n>MAX_ROWS+1:raise ValueError('More than 100,000 records')
        if None in row:raise ValueError('Unexpected CSV column count at row '+str(n))
        parcel=str(row.get('PropertyNumber') or '').strip()
        number=str(row.get('CertificateNumber') or '').strip()
        year=str(row.get('CertificateYear') or '').strip()
        taxyear=str(row.get('BillYear') or '').strip()
        cert_type=str(row.get('CertificateType') or '').strip()
        status=str(row.get('CertificateStatus') or '').strip()
        if not parcel or not number or not year or len(parcel)>100 or len(number)>100:
            rejected.append({'row':n,'reason':'Missing or oversized identifiers'});continue
        key=(parcel.casefold(),number.casefold(),year)
        if key in seen:
            rejected.append({'row':n,'reason':'Duplicate parcel certificate and year'});continue
        seen.add(key)
        try:
            face=parse_money(str(row.get('FaceAmount') or '').strip())
            due=parse_money(str(row.get('DueAmount') or '').strip())
        except ValueError:
            rejected.append({'row':n,'reason':'Invalid monetary amount'});continue
        counts[status]=counts.get(status,0)+1
        out.append({'state':'FL','county':'St. Johns','parcelId':parcel,'certificateNumber':number,
            'certificateYear':year,'taxYear':taxyear or None,'certificateTypeRaw':cert_type or None,
            'faceAmount':face,'dueAmount':due,'certificateStatusRaw':status or None,
            'redemptionDateRaw':str(row.get('RedemptionDate') or '').strip() or None,
            'taxDeedApplicationRaw':str(row.get('TDA') or '').strip() or None,
            'processDateRaw':str(row.get('ProcessDate') or '').strip() or None,
            'sourceUrl':URL,'status':'unverified','availableForPurchase':False})
    if not out:raise ValueError('No certificate rows to stage')
    report={'source':URL,'checkedAt':datetime.now(timezone.utc).isoformat(),
      'classification':'unpaid county-and-individual tax certificate report; not an availability list',
      'summary':{'received':len(out)+len(rejected),'accepted':len(out),'rejected':len(rejected),
                 'sourceStatusCodes':counts},
      'rejected':rejected[:100],'records':out}
    return report
def main():
    req=urllib.request.Request(URL,headers={'User-Agent':'PricePocketAsset public source validation','Accept':'text/csv,*/*'})
    with urllib.request.urlopen(req,timeout=25) as response:
        if response.url!=URL:raise ValueError('Unexpected source redirect')
        data=response.read(MAX_BYTES+1)
    if len(data)>MAX_BYTES:raise ValueError('Source exceeds size limit')
    report=normalize(data.decode('utf-8-sig',errors='strict'))
    if report['summary']['rejected']:
        raise ValueError('Refusing staging due to rejected rows: '+json.dumps(report['summary'])+
                         '; example: '+json.dumps(report['rejected'][:8]))
    dest=Path('county-import-staging/fl-st-johns-unpaid-certificates.json')
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'staged':str(dest),'summary':report['summary'],'sample':report['records'][:1]},indent=2))
if __name__=='__main__':
    try:main()
    except Exception as exc:print('St Johns staging failed:',exc,file=sys.stderr);sys.exit(1)
