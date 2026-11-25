// In-page confirmation for owner actions. The browser's own confirm() pop-up is blocked or auto-dismissed in some
// phone browsers, which made buttons look dead. This shows the same question inside the page and returns a Promise<boolean>.
(function () {
  if (window.ppaConfirm) return;
  window.ppaConfirm = function (message) {
    return new Promise(function (resolve) {
      var shade = document.createElement('div');
      shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true');
      shade.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.66);display:flex;align-items:center;justify-content:center;padding:18px';
      var box = document.createElement('div');
      box.style.cssText = 'max-width:420px;width:100%;background:#16212e;color:#f3f7fb;border:1px solid rgba(232,190,90,.5);border-radius:18px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.6);font:15px/1.45 system-ui,-apple-system,sans-serif';
      var p = document.createElement('p'); p.textContent = String(message); p.style.cssText = 'margin:0 0 16px;white-space:pre-wrap';
      var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';
      function done(v) { document.removeEventListener('keydown', key); shade.remove(); resolve(v); }
      function key(e) { if (e.key === 'Escape') done(false); }
      function btn(label, primary, v) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'min-height:44px;padding:0 18px;border-radius:12px;font:700 15px system-ui;cursor:pointer;border:1px solid ' + (primary ? '#37d69a' : 'rgba(255,255,255,.25)') + ';background:' + (primary ? '#15835b' : 'transparent') + ';color:#fff'; b.addEventListener('click', function () { done(v); }); return b; }
      var no = btn('Cancel', false, false), yes = btn('Confirm', true, true);
      row.append(no, yes); box.append(p, row); shade.append(box); document.body.append(shade);
      document.addEventListener('keydown', key); yes.focus();
    });
  };
})();
