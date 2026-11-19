/* Membership plans page: shows Free vs PricePocketPro BEFORE sign-up or checkout, then continues into the existing account and Stripe flow.
   It changes nothing about billing: the subscribe terms, consent record and Stripe Checkout stay on the account page / billing function. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var safe = function (p) { return /^\/(?!\/)[\w\-./?=&%#:+~]*$/.test(p || '') ? p : ''; };
  var from = safe(q.get('from')), src = String(q.get('src') || '').replace(/[<>]/g, '').slice(0, 60);
  var nextQ = from ? '&next=' + encodeURIComponent(from) : '';
  var nextOnly = from ? '?next=' + encodeURIComponent(from) : '';
  var set = function (el, o) { Object.keys(o).forEach(function (k) { if (k === 'text') el.textContent = o.text; else if (k === 'html') el.innerHTML = o.html; else el.setAttribute(k, o[k]); }); };

  // what the visitor was trying to do, and a way back
  if (src) {
    var c = $('ctx'); c.hidden = false; c.textContent = src + ' is part of PricePocketPro. Compare the plans below. Nothing is charged until you confirm on the next steps.';
    if (from) { var b = document.createElement('a'); b.href = from; b.textContent = ' Go back'; c.appendChild(b); }
  }

  // signed-out defaults are already in the HTML. Links carry where the visitor came from.
  $('freeBtn').href = '/account/?mode=up' + nextQ;
  $('proBtn').href = '/account/?mode=up&plan=pro' + nextQ;
  $('signinLink').href = '/account/?plan=pro' + nextQ;

  var today = new Date().toISOString().slice(0, 10);
  Promise.all([
    fetch('/.netlify/functions/account', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
    fetch('/.netlify/functions/billing', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return null; })
  ]).then(function (res) {
    var u = res[0] && res[0].user, bill = res[1];
    var pro = !!(u && (u.owner || u.paid || u.family || (u.paidThrough && u.paidThrough >= today)));
    var subEnds = u && u.sub && u.sub.cancelAtPeriodEnd && u.sub.periodEnd ? u.sub.periodEnd : '';
    var freeBtn = $('freeBtn'), proBtn = $('proBtn');

    if (!u) return;   // signed out: nothing to change

    if (!pro) {
      // existing free member: no second account; Free is the current plan; Pro goes straight to the subscribe step
      $('freeCur').hidden = false; set(freeBtn, { text: from ? 'Back to what you were doing' : 'Back to PricePocketAsset' }); freeBtn.href = from || '/';
      $('signinRow').hidden = true;
      proBtn.href = '/account/?plan=pro' + nextQ;
    } else {
      // Pro (or owner / family): Pro is the current plan; no upgrade button, no downgrade nudge
      $('signinRow').hidden = true; $('freeCur').hidden = true;
      var cur = document.createElement('span'); cur.className = 'pp-cur'; cur.textContent = 'Current plan'; var badge = $('proBadge'); badge.replaceWith(cur);
      set(proBtn, { html: '' }); proBtn.className = 'pp-btn pp-btn-current'; proBtn.href = '/account/'; proBtn.textContent = u.owner ? 'Owner: every Pro feature is on' : (u.family ? 'Family access: every Pro feature is on' : 'Manage membership');
      if (u.owner || u.family) { proBtn.setAttribute('aria-disabled', 'true'); proBtn.removeAttribute('href'); }
      $('proNote').textContent = subEnds ? 'Your membership ends on ' + subEnds + '. You keep access until then.' : (u.owner || u.family ? '' : 'Update your card, see invoices or cancel anytime.');
      freeBtn.hidden = true; var fn = $('freeNote'); fn.hidden = false; fn.textContent = 'Everything in Free is included in your plan.';
    }
    // checkout not available: say so instead of sending the member into an error
    if (!pro && bill && bill.configured === false) { proBtn.setAttribute('aria-disabled', 'true'); proBtn.textContent = 'Membership checkout opens soon'; proBtn.removeAttribute('href'); }
  });
})();
