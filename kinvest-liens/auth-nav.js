// Turns the "Account" link in the top menu into "Sign in" (signed out) or "My account" (signed in).
(function () {
  const links = [...document.querySelectorAll('a[href$="account/"]')].filter(a => /^\s*(Account|Sign in)\s*$/i.test(a.textContent));
  if (!links.length) return;
  fetch('/.netlify/functions/account').then(r => r.ok ? r.json() : null).then(d => {
    links.forEach(a => {
      if (d && d.user) { a.textContent = 'My account'; }
      else { a.textContent = 'Sign in'; a.href = '/login/?next=' + encodeURIComponent(location.pathname + location.search); a.classList.add('signin-link'); }
    });
  }).catch(() => {});
})();
