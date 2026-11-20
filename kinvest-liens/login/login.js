(function () {
  const $ = id => document.getElementById(id), API = '/.netlify/functions/account';
  const fields = window.ppaAuthFields;
  const current = new URLSearchParams(location.search).get('next') || '';
  const next = /^\/(?!\/)[A-Za-z0-9/_\-?=&.%]*$/.test(current) ? current : '/account/';
  fetch(API).then(r => r.json()).then(d => { if (d.user) location.replace(next); }).catch(() => {});
  $('auth-back').addEventListener('click', e => {
    if (!document.referrer || history.length < 2 || new URL(document.referrer).origin !== location.origin) return;
    e.preventDefault(); history.back();
  });
  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const button = $('go');
    if (button.disabled || !fields.validate(false)) return;
    fields.pending(button,true,false);
    try {
      const response = await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        action:'login',email:$('email').value,password:$('pw').value,remember:$('remember').checked
      })});
      const data = await response.json();
      if (response.ok) { location.href = next; return; }
      fields.status(data.error || 'Could not sign in. Try again.');
    } catch (e) { fields.status('Could not reach the server. Try again.'); }
    fields.pending(button,false,false);
  });
})();
