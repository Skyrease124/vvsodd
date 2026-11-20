"""Conservative classification for official Florida tax certificate exports.

Never infer that a county-held or unredeemed certificate is purchasable OTC.
Unknown/contradictory fields remain flagged for county verification.
"""
import re

def value(record,*keys):
    for key in keys:
        raw=record.get(key)
        if raw is not None and str(raw).strip():
            return str(raw).strip()
    return ''

def ownership(record):
    raw=value(record,'certificateTypeRaw','countyOrIndividualRaw').lower()
    compact=re.sub(r'[^a-z0-9]','',raw)
    if not compact:
        return 'unknown'
    if compact in ('c','cc','county','countyheld','countycertificate','countycert'):
        return 'county-held'
    if compact in ('i','ci','ind','individual','individualheld','individualcertificate','investorheld','privateheld'):
        return 'individually-held'
    return 'unknown'

def is_date(raw):
    raw=str(raw or '').strip()
    return bool(raw and raw not in ('0','00/00/0000','0000-00-00','None','N/A'))

def classify(record):
    """Returns status evidence, not verified sale eligibility."""
    owner=ownership(record)
    status=value(record,'certificateStatusRaw','paidStatusRaw').lower()
    tda=value(record,'taxDeedApplicationRaw')
    redemption=value(record,'redemptionDateRaw')
    flags=[]
    if owner=='unknown':flags.append('holder-type-needs-verification')

    # A reported redemption date is stronger than a generic 'unredeemed' status label.
    redeemed_status=status in ('redeemed','paid','p','r')
    unredeemed_status=status in ('unredeemed','unpaid','u','outstanding')
    has_redemption=is_date(redemption)
    if has_redemption and unredeemed_status:
        flags.append('redemption-date-conflicts-with-status')
    redeemed=redeemed_status or has_redemption

    tdaval=tda.strip().lower()
    tda_yes=tdaval in ('yes','y','true','1','pending','filed','active')
    tda_no=tdaval in ('no','n','false','0')
    tda_unknown=not (tda_yes or tda_no)
    if tda_unknown:flags.append('tax-deed-application-needs-verification')
    if redeemed and tda_yes:flags.append('redemption-and-tda-both-reported')

    if redeemed:
        redemption_status='reported-redeemed'
    elif unredeemed_status:
        redemption_status='reported-unredeemed'
    else:
        redemption_status='unknown'
        flags.append('redemption-status-needs-verification')

    if tda_yes:
        tax_deed_status='application-reported'
    elif tda_no:
        tax_deed_status='no-application-reported'
    else:
        tax_deed_status='unknown'

    # No positive purchase-availability classification without a separate county
    # inventory confirmation.
    return {
        'holdingType':owner,
        'redemptionStatus':redemption_status,
        'taxDeedStatus':tax_deed_status,
        'statusEvidence':{
            'certificateStatusRaw':value(record,'certificateStatusRaw','paidStatusRaw') or None,
            'redemptionDateRaw':redemption or None,
            'taxDeedApplicationRaw':tda or None,
            'holderTypeRaw':value(record,'certificateTypeRaw','countyOrIndividualRaw') or None
        },
        'verificationFlags':flags,
        'status':'unverified',
        'availableForPurchase':False
    }

def classify_all(records):
    summary={'holdingType':{},'redemptionStatus':{},'taxDeedStatus':{},'flagged':0}
    for record in records:
        result=classify(record)
        record.update(result)
        for key in ('holdingType','redemptionStatus','taxDeedStatus'):
            group=summary[key]
            group[result[key]]=group.get(result[key],0)+1
        if result['verificationFlags']:summary['flagged']+=1
    return summary
