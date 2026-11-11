# HTTP helpers for the Florida parcel backfill: POST/GET with retries, through the environment's proxy and CA bundle.
import json, os, ssl, time, urllib.parse, urllib.request
CA = os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None)
CTX = ssl.create_default_context(cafile=CA) if CA else ssl.create_default_context()
UA = {'User-Agent': 'PricePocketAsset parcel backfill'}

def fetch(url, params=None, post=True, timeout=60, tries=4, raw=False):
    last = None
    for a in range(tries):
        try:
            if post and params is not None:
                req = urllib.request.Request(url, data=urllib.parse.urlencode(params).encode(), headers={**UA, 'Content-Type': 'application/x-www-form-urlencoded'})
            else:
                req = urllib.request.Request(url + ('?' + urllib.parse.urlencode(params) if params else ''), headers=UA)
            with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
                body = r.read()
            if raw: return body
            d = json.loads(body)
            if isinstance(d, dict) and d.get('error'): raise RuntimeError(str(d['error'])[:200])
            return d
        except Exception as e:
            last = e; time.sleep(1.5 * (a + 1) ** 2)
    raise last
