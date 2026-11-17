#!/usr/bin/env python3
"""Checks kinvest-liens/liens/states/probate-matches.json and probate-sources.json.
A match record is only allowed when it is a verified, official, parcel-tied record; and it may never carry personal data we must not hold."""
import json, os, re, sys

STATES = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'kinvest-liens', 'liens', 'states')
ALLOWED = {'kind', 'number', 'date', 'decedent', 'tie', 'confirmsDeath', 'sameDecedent', 'personId', 'deathState', 'source', 'url', 'verifiedAt', 'note'}
KINDS = {'probate case', 'recorded instrument', 'death record'}
TIES = {'parcel-id', 'legal-description'}


def check_record(r):
    errs = []
    bad = set(r) - ALLOWED
    if bad: errs.append('fields not allowed (personal data or unknown): %s' % sorted(bad))
    if r.get('kind') not in KINDS: errs.append('kind')
    if not r.get('number'): errs.append('number')
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', str(r.get('date', ''))): errs.append('date')
    if not str(r.get('url', '')).startswith('https://'): errs.append('official https url')
    if not r.get('source'): errs.append('source (the clerk or agency)')
    if r.get('tie') not in TIES: errs.append('tie to the parcel (parcel-id or legal-description)')
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', str(r.get('verifiedAt', ''))): errs.append('verifiedAt')
    if r.get('confirmsDeath') and not r.get('personId'): errs.append('a death-confirming record needs a personId')
    return errs


def check(matches, sources):
    errs = []
    for key, recs in (matches.get('records') or {}).items():
        if not re.match(r'^[A-Z]{2}\|[^|]+\|[A-Z0-9]+$', key): errs.append('%s: key must be STATE|County|PARCELID' % key)
        for r in recs:
            errs += ['%s: %s' % (key, e) for e in check_record(r)]
    for k, c in (sources.get('counties') or {}).items():
        if not str(c.get('url', '')).startswith('https://') or c.get('kind') not in ('case-search', 'general'): errs.append('%s: sources entry' % k)
    return errs


if __name__ == '__main__':
    e = check(json.load(open(os.path.join(STATES, 'probate-matches.json'))), json.load(open(os.path.join(STATES, 'probate-sources.json'))))
    print('\n'.join(e) or 'ok'); sys.exit(1 if e else 0)
