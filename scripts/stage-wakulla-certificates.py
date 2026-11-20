#!/usr/bin/env python3
"""Stage official Wakulla XLSX records for human review, never mark as purchasable."""
import io
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
import importlib.util
_spec=importlib.util.spec_from_file_location('probe',Path(__file__).with_name('probe-county-certificate-files.py'))
_probe=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_probe)
download=_probe.download

NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
URL=None
MAX_ROWS=100000
def clean(value):
    return str(value or '').strip()
def col_index(ref):
    col=re.match(r'^[A-Z]+',ref or '')
    if not col:return None
    n=0
    for ch in col.group(0):n=n*26+ord(ch)-64
    return n-1
def load_rows(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        if sum(f.file_size for f in z.infolist())>50*1024*1024:raise ValueError('Oversized workbook')
        strings=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            shared=ET.fromstring(z.read('xl/sharedStrings.xml'))
            strings=[''.join(t.text or '' for t in si.iter(NS+'t')) for si in shared.findall(NS+'si')]
        sheet='xl/worksheets/sheet1.xml'
        if sheet not in z.namelist():raise ValueError('No worksheet')
        root=ET.fromstring(z.read(sheet))
        data_node=root.find('.//'+NS+'sheetData')
        if data_node is None:raise ValueError('No sheet data')
        rows=[]
        for row in data_node.findall(NS+'row'):
            values=[]
            for cell in row.findall(NS+'c'):
                ix=col_index(cell.get('r',''))
                if ix is None or ix>250:continue
                v=cell.find(NS+'v');raw=v.text if v is not None else ''
                if cell.get('t')=='s' and raw:
                    n=int(raw);raw=strings[n] if n<len(strings) else ''
                inline=cell.find(NS+'is')
                if inline is not None:raw=''.join(t.text or '' for t in inline.iter(NS+'t'))
                while len(values)<=ix:values.append('')
                values[ix]=clean(raw)
            if any(values):
                rows.append(values)
                if len(rows)>MAX_ROWS+1:raise ValueError('More than 100,000 records')
        return rows
def normalize(rows, source_url):
    if len(rows)<2:raise ValueError('No certificate records')
    head=rows[0]
    names={re.sub(r'[^a-z0-9]','',h.lower()):i for i,h in enumerate(head)}
    def field(*candidates):
        for c in candidates:
            if c in names:return names[c]
        return None
    parcel_i=field('parcel')
    cert_i=field('cert','certnumber','certno')
    taxyear_i=field('taxyear')
    face_i=field('certfaceamt')
    balance_i=field('unpaidbal')
    class_i=field('countyvsind')
    status_i=field('paidstatus')
    rate_i=field('cert')
    if parcel_i is None or cert_i is None:raise ValueError('Unexpected Wakulla schema: parcel or cert missing')
    def value(row,i):
        return clean(row[i]) if i is not None and i<len(row) else ''
    out=[];seen=set();rejected=[]
    for num,row in enumerate(rows[1:],start=2):
        parcel=value(row,parcel_i);cert=value(row,cert_i)
        if not parcel or not cert or len(parcel)>100 or len(cert)>100:
            rejected.append({'row':num,'reason':'Missing/invalid parcel or certificate number'});continue
        key=(parcel,cert,value(row,taxyear_i))
        if key in seen:
            rejected.append({'row':num,'reason':'Duplicate parcel/certificate/tax year'});continue
        seen.add(key)
        out.append({
            'state':'FL','county':'Wakulla','parcelId':parcel,'certificateNumber':cert,
            'taxYear':value(row,taxyear_i) or None,
            'certificateFaceAmountRaw':value(row,face_i) or None,
            'unpaidBalanceRaw':value(row,balance_i) or None,
            'countyOrIndividualRaw':value(row,class_i) or None,
            'paidStatusRaw':value(row,status_i) or None,
            'sourceUrl':source_url,'status':'unverified','availableForPurchase':False
        })
    return {'source':source_url,'checkedAt':datetime.now(timezone.utc).isoformat(),
            'classification':'county certificate export; status unverified; review required',
            'summary':{'received':len(rows)-1,'accepted':len(out),'rejected':len(rejected)},
            'rejected':rejected[:100],'records':out}
def run():
    discovery_spec=importlib.util.spec_from_file_location('wakulla_source', Path(__file__).with_name('discover-wakulla-source.py'))
    discovery=importlib.util.module_from_spec(discovery_spec)
    discovery_spec.loader.exec_module(discovery)
    current_url=discovery.discover_url()
    report=normalize(load_rows(download(current_url)),current_url)
    if not report['records'] or report['summary']['rejected']:
        raise ValueError('Validation failed; refusing to stage '+json.dumps(report['summary']))
    dest=Path('county-import-staging/fl-wakulla-certificate-export.json')
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'staged':str(dest),'summary':report['summary'],'sample':report['records'][:1]},indent=2))
if __name__=='__main__':
    try:run()
    except Exception as e:print('Wakulla staging failed:',e,file=sys.stderr);sys.exit(1)
