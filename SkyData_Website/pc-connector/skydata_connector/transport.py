"""Network-only transport. This module never accesses Blender data."""
import json
import urllib.request
import urllib.error

# 1.5 moved from ChatGPT Sites (skydata-ai.skyrease123.chatgpt.site) to the Netlify SkyData; pair again there.
SITE = 'https://845-nbny-v36.netlify.app'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class ConnectionError(Exception):
    def __init__(self, message, revoked=False, obsolete=False):
        super().__init__(message)
        self.revoked = revoked
        self.obsolete = obsolete

def send(action, data, token=None):
    if action not in ('pair', 'heartbeat', 'result'):
        raise ValueError('Unsupported action')
    headers = {'Content-Type': 'application/json', 'User-Agent': 'SkyData-Blender/1.5'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(SITE + '/api/blender/' + action,
        data=json.dumps(data).encode(), headers=headers, method='POST')
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=10) as response:
            raw = response.read(262145)
            if len(raw) > 262144: raise ValueError('Response too large')
            result = json.loads(raw)
        if action == 'pair' and (not isinstance(result.get('token'), str) or
                len(result['token']) != 64 or any(c not in '0123456789abcdef' for c in result['token'])):
            raise ValueError('Invalid response')
        if action == 'heartbeat' and result.get('connected') is not True:
            raise ValueError('Invalid response')
        if action == 'result' and result.get('accepted') is not True:
            raise ValueError('Invalid response')
        return result
    except urllib.error.HTTPError as error:
        if error.code == 401:
            if action == 'pair':
                raise ConnectionError('Pairing code expired or was already used. Generate a new code.') from None
            raise ConnectionError('Connection revoked. Generate a new pairing code.', True) from None
        if action == 'result' and error.code == 409:
            raise ConnectionError('The request is no longer active. Check its status in SkyData.', obsolete=True) from None
        if action == 'pair' and error.code in (400, 403, 404, 409, 410):
            raise ConnectionError('Pairing failed. Generate a fresh code and try again.') from None
        raise ConnectionError('SkyData could not accept the request. Try again shortly.') from None
    except (OSError, ValueError, urllib.error.URLError):
        raise ConnectionError('Cannot reach SkyData. Check your internet connection.') from None
