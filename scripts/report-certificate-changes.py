#!/usr/bin/env python3
"""Write safe, actionable GitHub Actions certificate review summaries.

The report contains *potential* changes only; no record is assumed purchasable,
and disappearance alone is not proof of redemption.
"""
import argparse
import json
import os
from pathlib import Path

COUNTS = ('added', 'missingFromLatest', 'statusChanged', 'amountChanged')
LABELS = {
    'added': 'New in source report',
    'missingFromLatest': 'Missing from latest (reason unknown)',
    'statusChanged': 'Status or tax-deed evidence changed',
    'amountChanged': 'Amount changed',
}

def render(report, county, max_rows=20):
    if report.get('mode') not in ('initial-baseline', 'comparison'):
        raise ValueError('Unexpected comparison report mode')
    summary = report.get('summary')
    if not isinstance(summary, dict):
        raise ValueError('Missing comparison summary')
    values = {}
    for field in COUNTS:
        number = summary.get(field, 0)
        if not isinstance(number, int) or isinstance(number, bool) or number < 0:
            raise ValueError('Invalid change count')
        values[field] = number
    total = sum(values.values())
    lines = [
        f'### {county} tax-certificate change review',
        '',
        f'**Comparison:** {report["mode"]}',
        '',
        '| Category | Records |',
        '|---|---:|'
    ]
    lines.extend(f'| {LABELS[field]} | {values[field]} |' for field in COUNTS)
    lines += ['', '**These are review alerts, not investment availability confirmations.**']
    if report['mode'] == 'initial-baseline':
        lines += ['', 'Initial baseline only. No changes inferred.']
    elif total:
        lines += ['', f'**Review required:** {total} change event(s) detected.',
                  'A record missing from the county report is NOT proof of redemption.']
        changes = report.get('changes', [])
        if not isinstance(changes, list):
            raise ValueError('Invalid changes array')
        lines += ['', '#### First detected changes', '',
                  '| Type | Certificate key |', '|---|---|']
        for change in changes[:max_rows]:
            kind = str(change.get('type', 'unknown')).replace('|', '\\|')[:60]
            key = str(change.get('certificateKey', 'unknown')).replace('|', '\\|')[:160]
            lines.append(f'| {kind} | `{key}` |')
        if len(changes) > max_rows:
            lines.append(f'\nShowing {max_rows} of {len(changes)} events. Download the full JSON artifact.')
    else:
        lines += ['', 'No changes found against the previous staging snapshot.']
    return '\n'.join(lines) + '\n', total

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', required=True)
    parser.add_argument('--county', required=True)
    parser.add_argument('--summary-file', default=os.getenv('GITHUB_STEP_SUMMARY'))
    args = parser.parse_args()
    report = json.loads(Path(args.report).read_text(encoding='utf-8'))
    body, count = render(report, args.county)
    if args.summary_file:
        with Path(args.summary_file).open('a', encoding='utf-8') as stream:
            stream.write(body)
    print(f'{args.county}: {count} potential change events; {args.report}')
    if count:
        # Visible notice in Actions without marking healthy imports as failures.
        print(f'::warning title={args.county} certificate changes::'
              f'{count} potential status/listing/amount changes need human review; '
              f'open the Actions job summary and download the JSON artifact.')
if __name__ == '__main__':
    main()
