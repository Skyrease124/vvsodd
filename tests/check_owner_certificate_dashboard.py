#!/usr/bin/env python3
"""Regression checks for owner-only certificate review and explicitly authorized research releases."""
from pathlib import Path

api=Path('netlify/functions/certificate-review.mjs').read_text()
page=Path('kinvest-liens/owner/certificates/index.html').read_text()
owner_menu=Path('kinvest-liens/owner/dashboard.js').read_text()
checks={
  'owner-only API check':"if(!me.owner)return reply(403" in api,
  'existing session authentication':"auth.userFromCookie(req.headers.get('cookie'))" in api,
  'server-side decision validation':"validateDecision(b,r)" in api,
  'no purchase availability':"availableForPurchase:false" in api and "record.availableForPurchase!==false" in Path('netlify/lib/auto-research-release.mjs').read_text(),
  'research publication needs explicit owner consent':"b.publishApprovedResearch!==true" in api,
  'approved research auto-publishes only on server':"syncReviewedCertificate({" in api,
  'snapshot race check':"snapshotSha256!==snap.hash" in api,
  'snapshot hash sent to UI':"snapshotSha256:snap.hash" in api,
  'same-origin POST requirement':"origin!==host" in api,
  'owner dashboard menu':"'/owner/certificates/'" in owner_menu,
  'owner dashboard navigation':"href=\"/owner/\"" in page,
  'no unsafe client-side publication':'/data/reviewed-certificates.json' not in page,
  'source approval consent visible': 'id="publishApprovedResearch"' in page,
  'audit receipt generated':"cert-audit-" in api,
  'audit receipt user visible':"Audit receipt" in page,
}
for name,passed in checks.items():
  print(('PASS' if passed else 'FAIL')+': '+name)
if not all(checks.values()):
  raise SystemExit('Owner certificate dashboard security regression failed')
