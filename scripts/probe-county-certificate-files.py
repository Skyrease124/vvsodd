#!/usr/bin/env python3
"""Probe approved county-held certificate files. Inspect headers only; never publish."""
import csv, io, json, re, urllib.request, zipfile, xml.etree.ElementTree as ET
SOURCES=[
  {"id":"fl-wakulla","url":"https://wakullatax.com/s/WakullaCountyCertificates-h4x5.xlsx","type":"xlsx"},
  {"id":"fl-leon-held","url":"https://www.leontaxcollector.net/Portals/69/userFiles/CertFiles/OpenCountyCertificates20261102.zip","type":"zip"}
]
M='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
LIMIT=15*1024*1024
def download(url):
  req=urllib.request.Request(url,headers={'User-Agent':'PricePocketAsset public source validation','Accept':'application/octet-stream'})
  with urllib.request.urlopen(req,timeout=25) as r:
    if r.url!=url: raise ValueError('Unexpected redirect')
    data=r.read(LIMIT+1)
  if len(data)>LIMIT: raise ValueError('Download exceeds 15 MB')
  return data
def workbook(data):
  with zipfile.ZipFile(io.BytesIO(data)) as z:
    if 'xl/workbook.xml' not in z.namelist(): raise ValueError('Not XLSX')
    if sum(f.file_size for f in z.infolist())>50*1024*1024: raise ValueError('Workbook too large')
    strings=[]
    if 'xl/sharedStrings.xml' in z.namelist():
      root=ET.fromstring(z.read('xl/sharedStrings.xml'))
      strings=[''.join(t.text or '' for t in node.iter(M+'t')) for node in root.findall(M+'si')]
    sheets=[]
    for name in sorted(n for n in z.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml',n))[:10]:
      first=[]
      with z.open(name) as handle:
        for _,elem in ET.iterparse(handle,events=('end',)):
          if elem.tag==M+'row':
            cells=[]
            for cell in elem.findall(M+'c'):
              val=cell.find(M+'v')
              raw=val.text if val is not None else ''
              if cell.get('t')=='s' and raw:
                index=int(raw);raw=strings[index] if index<len(strings) else ''
              inline=cell.find(M+'is')
              if inline is not None:raw=''.join(t.text or '' for t in inline.iter(M+'t'))
              cells.append(str(raw or '').strip()[:120])
            if any(cells):first=cells[:50];break
          elem.clear()
      sheets.append({'sheet':name,'firstPopulatedRow':first})
    return sheets
def inspect(src,data):
  if src['type']=='xlsx':return {'sheets':workbook(data)}
  entries=[]
  with zipfile.ZipFile(io.BytesIO(data)) as z:
    infos=z.infolist()
    if len(infos)>50 or sum(i.file_size for i in infos)>50*1024*1024:raise ValueError('ZIP too large')
    for info in infos:
      name=info.filename
      if info.is_dir():continue
      if '/' in name or '\\' in name:raise ValueError('Nested ZIP path refused')
      if name.lower().endswith('.xlsx'):entries.append({'name':name,'sheets':workbook(z.read(info))})
      elif name.lower().endswith(('.csv','.txt')):
        text=z.read(info).decode('utf-8-sig',errors='replace')
        head=next(csv.reader(io.StringIO(text)),[])
        entries.append({'name':name,'firstRow':head[:50]})
      else:entries.append({'name':name,'unsupported':True})
  return {'files':entries}
def main():
  results=[]
  for src in SOURCES:
    try:
      data=download(src['url'])
      results.append({'id':src['id'],'ok':True,'bytes':len(data),'inspection':inspect(src,data)})
    except Exception as e:results.append({'id':src['id'],'ok':False,'error':str(e)})
  with open('county-source-probe-report.json','w') as f:json.dump(results,f,indent=2)
  print(json.dumps(results,indent=2))
  if not any(x['ok'] for x in results):raise SystemExit(1)
if __name__=='__main__':main()
