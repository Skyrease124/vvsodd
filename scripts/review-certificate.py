#!/usr/bin/env python3
"""Manually review one staged Florida tax certificate.

Generates a tamper-evident (hash-linked-to-snapshot) audit receipt for repository
workflow artifacts. No certificate is published or marked available to buy.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

SNAPSHOTS = {
    'wakulla': ('Wakulla', 'county-import-staging/fl-wakulla-certificate-export.json'),
    'palm-beach': ('Palm Beach', 'county-import-staging/fl-palm-beach-certificate-export.json'),
    'st-johns': ('St. Johns', 'county-import-staging/fl-st-johns-unpaid-certificates.json'),
}
DECISIONS = ('approved-for-research', 'needs-follow-up', 'rejected')
ALLOWED_EVIDENCE_HOSTS = (
    'floridarevenue.com', 'sjctax.us', 'wakullatax.com',
    'pbctax.gov', 'flataxsales.com', 'lienhub.com',
)

def certificate_key(record):
    year = record.get('certificateYear') or record.get('taxYear')
    fields = (record.get('state'), record.get('county'), record.get('parcelId'),
              record.get('certificateNumber'), year)
    if any(not str(value or '').strip() for value in fields):
        raise ValueError('Incomplete certificate identity')
    return '|'.join(str(value).strip().casefold() for value in fields)

def validate_evidence(url):
    parsed = urlparse(str(url))
    host = (parsed.hostname or '').lower()
    if parsed.scheme != 'https' or not host or parsed.username or parsed.password or parsed.port:
        raise ValueError('Evidence must be a public HTTPS county/portal URL')
    if not any(host == allowed or host.endswith('.' + allowed) for allowed in ALLOWED_EVIDENCE_HOSTS):
        raise ValueError('Evidence must come from an approved official source')
    if len(url) > 2000:
        raise ValueError('Evidence URL too long')
    return url

def review(snapshot_bytes, county_slug, key, decision, evidence_url, reviewer, reason, reviewed_at=None):
    if county_slug not in SNAPSHOTS:
        raise ValueError('Unsupported county')
    if decision not in DECISIONS:
        raise ValueError('Unsupported decision')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,80}', reviewer or ''):
        raise ValueError('A real GitHub reviewer is required')
    if len(reason.strip()) < 12 or len(reason) > 1000:
        raise ValueError('A review reason of 12-1000 characters is required')
    validate_evidence(evidence_url)
    snapshot = json.loads(snapshot_bytes)
    if not isinstance(snapshot, dict) or not isinstance(snapshot.get('records'), list):
        raise ValueError('Invalid staged county snapshot')
    if len(snapshot['records']) > 100000:
        raise ValueError('Snapshot too large')
    matches = [r for r in snapshot['records'] if certificate_key(r) == key.casefold().strip()]
    if len(matches) != 1:
        raise ValueError('Certificate key missing or ambiguous in staged snapshot')
    record = matches[0]
    if record.get('county') != SNAPSHOTS[county_slug][0] or record.get('state') != 'FL':
        raise ValueError('Snapshot county/state mismatch')
    if record.get('availableForPurchase') is not False:
        raise ValueError('Unsafe record: purchase availability not false')
    if record.get('status') != 'unverified':
        raise ValueError('Unexpected purchase-status label')
    receipt = {
        'schemaVersion': 1,
        'receiptType': 'human-certificate-research-review',
        'reviewedAt': reviewed_at or datetime.now(timezone.utc).isoformat(),
        'reviewerGitHubActor': reviewer,
        'county': record['county'],
        'state': 'FL',
        'certificateKey': certificate_key(record),
        'decision': decision,
        'evidenceUrl': evidence_url,
        'reason': reason.strip(),
        'sourceUrl': record.get('sourceUrl'),
        'sourceCheckedAt': snapshot.get('checkedAt'),
        'snapshotSha256': hashlib.sha256(snapshot_bytes).hexdigest(),
        'publicationAuthorized': False,
        'availableForPurchase': False,
        'note': 'Research review only. Does not confirm current certificate purchase availability or trigger publishing.'
    }
    return receipt

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--county', required=True, choices=list(SNAPSHOTS))
    parser.add_argument('--certificate-key', required=True)
    parser.add_argument('--decision', required=True, choices=DECISIONS)
    parser.add_argument('--evidence-url', required=True)
    parser.add_argument('--reason', required=True)
    parser.add_argument('--reviewer', required=True)
    parser.add_argument('--snapshot', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    input_path = Path(args.snapshot)
    if input_path.name != Path(SNAPSHOTS[args.county][1]).name:
        raise ValueError('Snapshot filename does not match requested county')
    result = review(input_path.read_bytes(), args.county, args.certificate_key,
                    args.decision, args.evidence_url, args.reviewer, args.reason)
    dest = Path(args.output)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(f'Review receipt generated for {result["county"]}: {result["decision"]}; '
          'publication disabled')

if __name__ == '__main__':
    main()
