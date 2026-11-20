(function () {
  const eye = '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
  const svg = d => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' + d + '</svg>';
  const $ = id => document.getElementById(id);
  function visibility(button, visible) {
    button.innerHTML = svg(eye + (visible ? '<path d="m3 3 18 18"/>' : ''));
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  }
  document.querySelectorAll('button[data-toggle-password]').forEach(button => {
    const input = $(button.dataset.togglePassword);
    if (!input) return;
    visibility(button, false);
    button.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      visibility(button, visible);
    });
  });
  function error(id, message) {
    const field = $(id), hint = $(id + '-error');
    if (!field || !hint) return;
    hint.textContent = message || '';
    hint.hidden = !message;
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }
  const fields = ['email','username','pw','confirmpw','acode','signupaccept'];
  fields.forEach(id => $(id)?.addEventListener('input', () => error(id, '')));
  const clear = () => { fields.forEach(id => error(id,'')); if ($('msg')) $('msg').textContent = ''; };
  function validate(signup) {
    clear();
    const email = $('email'), password = $('pw');
    const invalid = [];
    const add = (id, message) => { invalid.push(id); error(id,message); };
    if (!email.value.trim() || !email.validity.valid) add('email','Enter a valid email address.');
    if (!password.value) add('pw','Enter your password.');
    else if (signup && password.value.length < 8) add('pw','Use at least 8 characters.');
    if (signup) {
      if (!/^[a-z][a-z0-9_]{2,19}$/i.test($('username').value.trim())) add('username','Use 3–20 letters, numbers or underscores, starting with a letter.');
      if ($('confirmpw').value !== password.value) add('confirmpw','The passwords do not match.');
      if (!$('signupaccept').checked) add('signupaccept','Accept the Terms of Service and Privacy Policy to continue.');
    }
    if (!invalid.length) return true;
    const first = $('form').querySelector('[aria-invalid="true"]');
    first?.focus(); return false;
  }
  function status(message) {
    if (/username/i.test(message) && $('username') && !$('usernamewrap').hidden) error('username',message);
    else if (/access code/i.test(message) && $('acode') && !$('acodewrap').hidden) error('acode',message);
    else if (/valid email/i.test(message)) error('email',message);
    else $('msg').textContent = message;
  }
  const label = (button, text) => { const span = button.querySelector('.auth-submit-label'); if (span) span.textContent = text; else button.textContent = text; };
  function pending(button, busy, signup) {
    button.disabled = busy;
    button.closest('form')?.setAttribute('aria-busy',String(busy));
    label(button, busy ? (signup ? 'Creating account…' : 'Signing in…') : (signup ? 'Create Account' : 'Sign In'));
  }
  const resetVisibility = () => document.querySelectorAll('button[data-toggle-password]').forEach(b => {
    $(b.dataset.togglePassword).type = 'password';
    visibility(b,false);
  });
  // Use the browser's visible viewport when iOS/Android opens the keyboard.
  let keyboardTimer;
  const keepFocused = () => {
    clearTimeout(keyboardTimer);
    keyboardTimer = setTimeout(() => {
      const field = document.activeElement;
      if (!field?.matches('.app-auth-card input:not([type=checkbox])')) return;
      const vv = window.visualViewport, bounds = field.getBoundingClientRect();
      if (vv && (bounds.bottom > vv.offsetTop + vv.height - 28 || bounds.top < vv.offsetTop + 12)) {
        field.scrollIntoView({block:'center',behavior:'auto'});
      }
    },100);
  };
  window.visualViewport?.addEventListener('resize',keepFocused);
  document.addEventListener('focusin',keepFocused);
  window.ppaAuthFields = { validate, clear, status, pending, label, resetVisibility };
})();
