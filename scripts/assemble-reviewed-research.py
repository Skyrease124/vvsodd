#!/usr/bin/env python3
"""Explicit, manual-only build of the reviewed research dataset for Netlify.

Only accepts the research-only candidates from prepare-research-publication.py.
Run locally and inspect the resulting diff; never run in scheduled county jobs.
"""
import argparse
import json
from pathlib import Path
from datetime import datetime,timezone

PUBLIC_FIELDS={'state','county','certificateKey','parcelId','certificateNumber','certificateYear',
               'taxYear','holdingType','redemptionStatus','taxDeedStatus',
               'faceAmount','faceAmountRaw','certificateFaceAmountRaw',
               'dueAmount','totalAmountRaw','unpaidBalanceRaw','listingType','researchReviewStatus',
               'status','availableForPurchase','purchaseLink','evidenceUrl',
               'sourceUrl','sourceCheckedAt','disclaimer'}
COUNTIES={'Wakulla','Palm Beach','St. Johns'}

def assemble(candidates):
    records=[];keys=set()
    for candidate in candidates:
        if not isinstance(candidate,dict) or candidate.get('schemaVersion')!=1 or candidate.get('publicationState')!='awaiting-separate-human-merge':
            raise ValueError('Invalid publication candidate')
        if not candidate.get('reviewReceiptSha256') or not candidate.get('sourceSnapshotSha256') or not candidate.get('reviewedBy'):
            raise ValueError('Missing review provenance')
        r=candidate.get('record')
        if not isinstance(r,dict) or not set(r).issubset(PUBLIC_FIELDS):
            raise ValueError('Unexpected field in public research record')
        if r.get('state')!='FL' or r.get('county') not in COUNTIES:
            raise ValueError('Unexpected research state/county')
        if (r.get('listingType')!='tax-certificate-research-only'
                or r.get('researchReviewStatus')!='approved-for-research'
                or r.get('status')!='unverified'
                or r.get('availableForPurchase') is not False
                or r.get('purchaseLink') is not None):
            raise ValueError('Unsafe research availability flags')
        if not (r.get('parcelId') and r.get('certificateNumber') and r.get('certificateKey')):
            raise ValueError('Missing certificate identity')
        if not isinstance(r.get('disclaimer'),str) or len(r['disclaimer'])<40:
            raise ValueError('Missing research disclaimer')
        if r['certificateKey'] in keys:raise ValueError('Duplicate reviewed certificate')
        keys.add(r['certificateKey'])
        records.append(r)
    return {'schemaVersion':1,'kind':'approved-certificate-research',
            'publishedAt':datetime.now(timezone.utc).isoformat() if records else None,
            'records':sorted(records,key=lambda r:r['certificateKey']),
            'notice':'Research only. These records are not confirmed available for purchase.'}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--candidate',action='append',required=True)
    parser.add_argument('--output',default='kinvest-liens/data/reviewed-certificates.json')
    args=parser.parse_args()
    candidates=[json.loads(Path(p).read_text(encoding='utf8')) for p in args.candidate]
    output=assemble(candidates)
    path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(output,indent=2)+'\n',encoding='utf8')
    print(f'Prepared {len(output["records"])} research-only records for manual diff review: {path}')
if __name__=='__main__':main()
