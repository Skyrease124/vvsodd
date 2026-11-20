#!/usr/bin/env python3
"""Generate an offline read-only administrator review HTML file from staged county JSON.

GitHub Actions artifacts inherit repository/run access controls. This page is
never published on the website. Approval and production publishing are separate.
"""
import argparse
import html
import json
from pathlib import Path

MAX_ROWS = 100000

def load_json(path):
    data=json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(data,dict):raise ValueError('Expected a JSON object')
    return data

def render(records_report, changes_report, county):
    records=records_report.get('records')
    changes=changes_report.get('changes')
    if not isinstance(records,list) or not isinstance(changes,list):
        raise ValueError('Missing staged records or changes')
    if len(records)>MAX_ROWS or len(changes)>MAX_ROWS*2:
        raise ValueError('Too many records to render')
    if changes_report.get('mode') not in ('initial-baseline','comparison'):
        raise ValueError('Unrecognized comparison mode')
    expected={str(r.get('county','')).strip() for r in records}
    if expected!={county}:
        raise ValueError('County mismatch: refusing combined report')
    safe_county=html.escape(county,quote=True)
    checked=html.escape(str(records_report.get('checkedAt') or 'Unknown'),quote=True)
    source=html.escape(str(records_report.get('source') or 'Unknown'),quote=True)
    row_html=[]
    for r in records:
        if not isinstance(r,dict):raise ValueError('Non-object record')
        fields=[str(r.get(k) or '') for k in ('parcelId','certificateNumber','taxYear','holdingType','redemptionStatus','taxDeedStatus')]
        fields.append(str(r.get('dueAmount') or r.get('totalAmountRaw') or r.get('unpaidBalanceRaw') or ''))
        flags=r.get('verificationFlags') or []
        if not isinstance(flags,list):raise ValueError('Invalid flags')
        fields.append(', '.join(map(str,flags))[:250])
        row_html.append('<tr>' + ''.join('<td>'+html.escape(x)[:500]+'</td>' for x in fields) + '</tr>')
    change_html=[]
    for c in changes:
        if not isinstance(c,dict):raise ValueError('Non-object change')
        cells=[str(c.get('type') or ''),str(c.get('certificateKey') or '')]
        fields=c.get('changedFields')
        cells.append(json.dumps(fields,sort_keys=True)[:500] if fields else str(c.get('classification') or ''))
        change_html.append('<tr>' + ''.join('<td>'+html.escape(x)+'</td>' for x in cells) + '</tr>')
    counts=changes_report.get('summary') or {}
    summary=' · '.join(f'{label}: {int(counts.get(key,0))}' for key,label in [
        ('added','Added'),('missingFromLatest','Missing'),
        ('statusChanged','Status changes'),('amountChanged','Amount changes')])
    page='''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Certificate review — __COUNTY__</title>
<style>
:root{font:15px system-ui,-apple-system,sans-serif;color:#152333;background:#f3f6fb}
body{max-width:1280px;margin:0 auto;padding:22px}
header{background:#14263b;color:white;padding:25px;border-radius:16px}
h1{margin:0 0 10px;font-size:25px}h2{margin-top:26px}
p{line-height:1.5}
.notice{background:#fff2df;border:1px solid #edcf9b;border-radius:10px;padding:12px;margin:18px 0}
.stats{background:white;border:1px solid #d8e2ed;padding:14px;border-radius:10px}
input,select{padding:10px;border:1px solid #becbdd;border-radius:8px;background:white;max-width:100%}
.controls{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}
.table-wrap{max-height:540px;overflow:auto;background:white;border:1px solid #d8e2ed;border-radius:10px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{position:sticky;top:0;background:#e7eef6;text-align:left}
th,td{padding:9px;border-bottom:1px solid #e4eaf2;vertical-align:top}
tr:nth-child(even){background:#f8fafc}
small{display:block;overflow-wrap:anywhere;color:#6e7e91}
button{padding:9px 15px;background:#123d72;border:0;color:white;border-radius:8px;cursor:pointer}
</style></head><body>
<header><h1>Certificate admin review · __COUNTY__</h1>
<p>Staged source inspection only · __COUNT__ records · __MODE__ comparison</p></header>
<div class="notice"><strong>Review only — NOT APPROVED TO SELL.</strong>
Records are not verified as purchasable. Missing records do not prove redemption.
Review this report in the authorized GitHub workflow; only a separate authenticated approval process may authorize production publication.</div>
<p class="stats"><strong>Change summary:</strong> __SUMMARY__</p>
<small>Source: __SOURCE__ · Checked: __CHECKED__</small>
<h2>Changes requiring review (<span id="changeCount">__CHANGES__</span>)</h2>
<div class="controls"><input aria-label="Search changes" id="changeSearch" placeholder="Search change list" type="search"></div>
<div class="table-wrap"><table id="changeTable"><thead><tr><th>Event</th><th>Certificate key</th><th>Evidence / classification</th></tr></thead><tbody>__CHANGE_ROWS__</tbody></table></div>
<h2>Staged certificate records (<span id="recordCount">__COUNT__</span>)</h2>
<div class="controls"><input id="recordSearch" aria-label="Search records" placeholder="Search parcel or certificate" type="search">
<select id="holdingFilter" aria-label="Filter holding type"><option value="">All holding types</option><option>county-held</option><option>individually-held</option><option>unknown</option></select>
<select id="redemptionFilter" aria-label="Filter redemption"><option value="">All redemption states</option><option>reported-unredeemed</option><option>reported-redeemed</option><option>unknown</option></select></div>
<div class="table-wrap"><table id="recordTable"><thead><tr><th>Parcel</th><th>Certificate</th><th>Tax year</th><th>Holding</th><th>Redemption</th><th>Tax deed</th><th>Reported balance</th><th>Review flags</th></tr></thead><tbody>__RECORD_ROWS__</tbody></table></div>
<script>
function filterTable(table, search, counter, filters){
 const rows=document.querySelectorAll('#'+table+' tbody tr');
 const q=document.getElementById(search).value.toLowerCase();
 let visible=0;
 rows.forEach(row=>{
   const cells=row.cells;
   const matches=row.textContent.toLowerCase().includes(q) &&
     filters.every(([select,index])=>!document.getElementById(select).value ||
       cells[index].textContent===document.getElementById(select).value);
   row.hidden=!matches;if(matches)visible++;
 });
 document.getElementById(counter).textContent=visible;
}
const change=()=>filterTable('changeTable','changeSearch','changeCount',[]);
const record=()=>filterTable('recordTable','recordSearch','recordCount',
  [['holdingFilter',3],['redemptionFilter',4]]);
document.getElementById('changeSearch').addEventListener('input',change);
for(const id of ['recordSearch','holdingFilter','redemptionFilter'])
 document.getElementById(id).addEventListener('input',record);
</script></body></html>'''
    substitutions={
        '__COUNTY__':safe_county,'__COUNT__':str(len(records)),
        '__MODE__':html.escape(str(changes_report['mode'])),
        '__SUMMARY__':html.escape(summary),'__SOURCE__':source,
        '__CHECKED__':checked,'__CHANGES__':str(len(changes)),
        '__CHANGE_ROWS__':'\n'.join(change_html),
        '__RECORD_ROWS__':'\n'.join(row_html)
    }
    for key,val in substitutions.items():page=page.replace(key,val)
    return page

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--records',required=True)
    parser.add_argument('--changes',required=True)
    parser.add_argument('--county',required=True)
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    page=render(load_json(args.records),load_json(args.changes),args.county)
    path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(page,encoding='utf-8')
    print(f'Read-only admin HTML: {path} ({len(page)} chars)')
if __name__=='__main__':main()
