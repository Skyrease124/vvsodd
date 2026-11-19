// Passive "natural hazard news" line. Shows a few major recent events (NASA EONET via /hazards?major=1), one at a time.
// Not clickable on purpose. Hidden when there is nothing recent to report or the source is unavailable (never claims "no hazards").
(function () {
  'use strict';
  var host = document.getElementById('pmTop') ? { el: document.getElementById('pmTop'), cls: ' hz-map' } : (document.querySelector('.dwrap .rhead') ? { el: document.querySelector('.dwrap .rhead'), cls: ' hz-home', before: true } : null);
  if (!host) return;
  var ICON = { wildfires: '🔥', floods: '🌊', severeStorms: '🌀', volcanoes: '🌋', landslides: '⛰️' };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  fetch('/.netlify/functions/hazards?major=1').then(function (r) { return r.json(); }).then(function (d) {
    if (!d || d.ok !== true || !d.major || !d.major.length) return;
    var list = d.major.slice(); for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; }
    var box = document.createElement('div'); box.className = 'hztick' + host.cls; box.setAttribute('role', 'note'); box.setAttribute('aria-label', 'Recent natural hazard reports');
    var ic = document.createElement('span'), tx = document.createElement('span'); ic.className = 'hz-ic'; tx.className = 'hz-tx'; box.appendChild(ic); box.appendChild(tx);
    host.el.parentNode.insertBefore(box, host.before ? host.el : host.el.nextSibling);
    var n = 0;
    function line(e) {
      var when = ''; try { when = new Date(e.date).toLocaleDateString([], { month: 'short', day: 'numeric' }); } catch (x) {}
      var size = (e.cat === 'wildfires' && e.unit === 'acres' && e.mag) ? ' · ' + Math.round(e.mag).toLocaleString() + ' acres' : '';
      return (e.catTitle || 'Event') + ' reported: ' + e.name + size + (when ? ' · ' + when : '');
    }
    function show() { var e = list[n % list.length]; n++; ic.textContent = ICON[e.cat] || '⚠️'; tx.textContent = line(e); box.classList.add('on'); }
    function tick() { if (reduced) { show(); return; } box.classList.remove('on'); setTimeout(show, 450); }
    show(); if (list.length > 1) setInterval(tick, 7000);
  }).catch(function () {});
})();
