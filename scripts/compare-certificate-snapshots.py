#!/usr/bin/env python3
"""Compare reviewed certificate snapshots; never equate absence with redemption.

Input files are stage-only exports from a single county. Output is a review-only
change report. The first run establishes a baseline with no inferred events.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

STATUS_FIELDS=('holdingType','redemptionStatus','taxDeedStatus')
AMOUNT_FIELDS=('faceAmount','faceAmountRaw','certificateFaceAmountRaw','dueAmount','totalAmountRaw','unpaidBalanceRaw')
EVIDENCE_FIELDS=('certificateStatusRaw','paidStatusRaw','redemptionDateRaw','taxDeedApplicationRaw',
                 'certificateTypeRaw','countyOrIndividualRaw')
MAX_RECORDS=100000

def certificate_key(row):
    return '|'.join(str(row.get(k) or '').strip().casefold() for k in
                    ('state','county','parcelId','certificateNumber',
                     'certificateYear' if row.get('certificateYear') else 'taxYear'))

def load_snapshot(path):
    data=json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(data,dict) or not isinstance(data.get('records'),list):
        raise ValueError('Invalid certificate snapshot')
    if len(data['records'])>MAX_RECORDS:
        raise ValueError('Snapshot exceeds 100,000 records')
    keys={}
    for row in data['records']:
        if not isinstance(row,dict):
            raise ValueError('Non-object certificate')
        key=certificate_key(row)
        parts=key.split('|')
        if len(parts)!=5 or not all(parts) or key in keys:
            raise ValueError('Missing or duplicate certificate identity')
        keys[key]=row
    return data,keys

def compare(current,previous=None):
    cur,cur_keys=load_snapshot(current)
    if previous is None:
        return {'mode':'initial-baseline','source':cur.get('source'),
                'checkedAt':cur.get('checkedAt'),'summary':{'baselineRecords':len(cur_keys),
                'added':0,'missingFromLatest':0,'statusChanged':0,'amountChanged':0},
                'changes':[],'note':'First snapshot: no change or redemption inferred.'}
    old,old_keys=load_snapshot(previous)
    old_source=urlparse(str(old.get('source') or ''))
    current_source=urlparse(str(cur.get('source') or ''))
    if old_source.scheme!='https' or current_source.scheme!='https' or old_source.hostname!=current_source.hostname:
        raise ValueError('Different source URLs: refusing cross-source comparison')
    cur_counties={(r.get('state'),r.get('county')) for r in cur_keys.values()}
    prev_counties={(r.get('state'),r.get('county')) for r in old_keys.values()}
    if cur_counties!=prev_counties or len(cur_counties)!=1:
        raise ValueError('County mismatch between snapshots')
    changes=[]
    summary={'baselineRecords':len(old_keys),'currentRecords':len(cur_keys),
             'added':0,'missingFromLatest':0,'statusChanged':0,'amountChanged':0}
    for key in sorted(cur_keys.keys()-old_keys.keys()):
        summary['added']+=1
        changes.append({'type':'new-in-report','certificateKey':key,
                        'classification':'unverified-not-purchasable'})
    for key in sorted(old_keys.keys()-cur_keys.keys()):
        summary['missingFromLatest']+=1
        changes.append({'type':'missing-from-report','certificateKey':key,
                        'classification':'reason-unknown-check-county',
                        'isRedemptionConfirmed':False})
    for key in sorted(cur_keys.keys() & old_keys.keys()):
        before=old_keys[key];after=cur_keys[key]
        changed_status={f:{'before':before.get(f),'after':after.get(f)} for f in
                        STATUS_FIELDS+EVIDENCE_FIELDS if before.get(f)!=after.get(f)}
        changed_amounts={f:{'before':before.get(f),'after':after.get(f)} for f in
                         AMOUNT_FIELDS if before.get(f)!=after.get(f)}
        if changed_status:
            summary['statusChanged']+=1
            changes.append({'type':'status-evidence-changed','certificateKey':key,
                            'changedFields':changed_status,'requiresReview':True})
        if changed_amounts:
            summary['amountChanged']+=1
            changes.append({'type':'amount-changed','certificateKey':key,
                            'changedFields':changed_amounts,'requiresReview':True})
    return {'mode':'comparison','source':cur.get('source'),'checkedAt':cur.get('checkedAt'),
            'previousCheckedAt':old.get('checkedAt'),'summary':summary,'changes':changes,
            'note':'A certificate missing from the new file is NOT proof of redemption.'}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--current',required=True)
    parser.add_argument('--previous')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    report=compare(args.current,args.previous if args.previous and Path(args.previous).is_file() else None)
    path=Path(args.output)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'mode':report['mode'],'summary':report['summary'],'output':str(path)},indent=2))
if __name__=='__main__':main()
