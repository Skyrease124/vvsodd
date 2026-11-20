#!/usr/bin/env python3
"""Convert ONE human-reviewed certificate into a research-only publication candidate.

This is a second manual gate, not an automated publish step. The output must
be separately reviewed and merged before Netlify exposes anything.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import importlib.util

def helper(filename):
    spec=importlib.util.spec_from_file_location('certificate_review',Path(__file__).with_name(filename))
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

review_module=helper('review-certificate.py')
ALLOWED_DECISION='approved-for-research'

def candidate(snapshot_bytes, receipt, county_slug):
    if county_slug not in review_module.SNAPSHOTS:
        raise ValueError('Unsupported county')
    if not isinstance(receipt,dict) or receipt.get('schemaVersion')!=1 or receipt.get('receiptType')!='human-certificate-research-review':
        raise ValueError('Review receipt is invalid')
    if receipt.get('decision')!=ALLOWED_DECISION or receipt.get('publicationAuthorized') is not False or receipt.get('availableForPurchase') is not False:
        raise ValueError('Only a non-publishing approved-for-research receipt may become a candidate')
    if receipt.get('snapshotSha256')!=hashlib.sha256(snapshot_bytes).hexdigest():
        raise ValueError('Receipt and source snapshot hash do not match; re-review current data')
    if receipt.get('county')!=review_module.SNAPSHOTS[county_slug][0] or receipt.get('state')!='FL':
        raise ValueError('Receipt county/state mismatch')
    if not receipt.get('reviewerGitHubActor') or not receipt.get('reviewedAt') or not receipt.get('reason'):
        raise ValueError('Receipt is missing reviewer audit fields')
    review_module.validate_evidence(receipt.get('evidenceUrl',''))
    data=json.loads(snapshot_bytes)
    if not isinstance(data,dict) or not isinstance(data.get('records'),list) or len(data['records'])>100000:
        raise ValueError('Invalid source snapshot')
    if receipt.get('sourceUrl')!=data.get('source') or receipt.get('sourceCheckedAt')!=data.get('checkedAt'):
        raise ValueError('Receipt source version mismatch')
    records=[r for r in data['records'] if review_module.certificate_key(r)==receipt.get('certificateKey')]
    if len(records)!=1:
        raise ValueError('Reviewed certificate missing or ambiguous')
    r=records[0]
    if r.get('state')!='FL' or r.get('county')!=receipt.get('county'):
        raise ValueError('Certificate county mismatch')
    if r.get('availableForPurchase') is not False or r.get('status')!='unverified':
        raise ValueError('Certificate purchase status is unsafe')
    # Strict allowlist: no owner name, address, owner identifiers, or raw CSV.
    fields=('parcelId','certificateNumber','certificateYear','taxYear',
            'holdingType','redemptionStatus','taxDeedStatus',
            'faceAmount','faceAmountRaw','certificateFaceAmountRaw',
            'dueAmount','totalAmountRaw','unpaidBalanceRaw')
    public={key:r[key] for key in fields if r.get(key) is not None}
    public.update({'state':'FL','county':receipt['county'],
        'certificateKey':receipt['certificateKey'],
        'listingType':'tax-certificate-research-only',
        'researchReviewStatus':'approved-for-research',
        'status':'unverified',
        'availableForPurchase':False,
        'purchaseLink':None,
        'evidenceUrl':receipt['evidenceUrl'],
        'sourceUrl':data['source'],
        'sourceCheckedAt':data.get('checkedAt'),
        'disclaimer':'Research record only. Ownership, redemption, tax-deed status and purchase availability must be verified with the county.'})
    return {'schemaVersion':1,'candidateGeneratedAt':datetime.now(timezone.utc).isoformat(),
        'sourceSnapshotSha256':receipt['snapshotSha256'],
        'reviewedBy':receipt['reviewerGitHubActor'],
        'reviewReceiptSha256':hashlib.sha256(json.dumps(receipt,sort_keys=True).encode()).hexdigest(),
        'publicationState':'awaiting-separate-human-merge',
        'record':public}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--snapshot',required=True)
    parser.add_argument('--receipt',required=True)
    parser.add_argument('--county',required=True,choices=list(review_module.SNAPSHOTS))
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    if Path(args.snapshot).name!=Path(review_module.SNAPSHOTS[args.county][1]).name:
        raise ValueError('Snapshot filename does not match county')
    result=candidate(Path(args.snapshot).read_bytes(),json.loads(Path(args.receipt).read_text()),args.county)
    output=Path(args.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print('Research-only candidate prepared, no production publication: '+str(output))

if __name__=='__main__':
    main()
