/* Live Cams page: states -> cities -> a big viewer plus a grid. Uses the site's /cameras service (Pro only, enforced on the server). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var mk = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  var HLS = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js';
  // Only places where an official feed is built in. (state, then cities)
  var STATES = [
    { a: 'FL', n: 'Florida', cities: [['Tampa', 27.9506, -82.4572], ['Orlando', 28.5383, -81.3792], ['Miami', 25.7617, -80.1918], ['Jacksonville', 30.3322, -81.6557], ['West Palm Beach', 26.7153, -80.0534], ['Fort Myers Beach', 26.452, -81.9495], ['Tallahassee', 30.4383, -84.2807], ['Pensacola', 30.4213, -87.2169]] },
    { a: 'CA', n: 'California', cities: [['Los Angeles', 34.0522, -118.2437], ['San Diego', 32.7157, -117.1611], ['San Francisco', 37.7749, -122.4194], ['Sacramento', 38.5816, -121.4944], ['San Jose', 37.3382, -121.8863]] },
    { a: 'TX', n: 'Texas', cities: [['Austin', 30.2672, -97.7431]] }
  ];
  var q = new URLSearchParams(location.search), st = 1, ci = 0, cams = [], cur = -1, timer = null, hls = null, token = 0;
  var s0 = STATES.findIndex(function (s) { return s.a === (q.get('s') || '').toUpperCase(); }); if (s0 >= 0) st = s0;
  var c0 = parseInt(q.get('c'), 10); if (c0 >= 0 && c0 < STATES[st].cities.length) ci = c0;

  function stop() { if (timer) { clearInterval(timer); timer = null; } if (hls) { try { hls.destroy(); } catch (e) {} hls = null; } var v = $('view').querySelector('video'); if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} } }
  function paintSelectors() {
    var s = $('states'); s.textContent = '';
    STATES.forEach(function (x, i) { var b = mk('button', '', x.n); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(i === st)); b.onclick = function () { st = i; ci = 0; paintSelectors(); load(); }; s.appendChild(b); });
    var c = $('cities'); c.textContent = '';
    STATES[st].cities.forEach(function (x, i) { var b = mk('button', 'lc-chip', x[0]); b.type = 'button'; b.setAttribute('aria-pressed', String(i === ci)); b.onclick = function () { ci = i; paintSelectors(); load(); }; c.appendChild(b); });
  }
  function gate(text, link) { $('msg').textContent = ''; var p = mk('span'); p.append(document.createTextNode(text + ' ')); if (link) { var a = mk('a', '', link[0]); a.href = link[1]; p.appendChild(a); } $('msg').appendChild(p); }
  async function load() {
    var my = ++token; stop(); $('stage').hidden = true; $('grid').textContent = ''; $('msg').textContent = 'Finding cameras…'; cams = []; cur = -1;
    var p = STATES[st].cities[ci]; history.replaceState(null, '', '?s=' + STATES[st].a + '&c=' + ci);
    $('onmap').href = '/map/?cams=1&lat=' + p[1] + '&lng=' + p[2];
    var r, d; try { r = await fetch('/.netlify/functions/cameras?' + new URLSearchParams({ lat: p[1], lng: p[2], radius: 15, limit: 20, video: Number(STATES[st].a === 'CA') }), { credentials: 'same-origin' }); d = await r.json(); } catch (e) { if (my === token) $('msg').textContent = 'Cameras are temporarily unavailable. Please try again in a moment.'; return; }
    if (my !== token) return;
    if (r.status === 401 || r.status === 402) { gate('Live Cams are for Pro members.', ['See the Pro plan', '/plans/?from=' + encodeURIComponent(location.pathname + location.search) + '&src=' + encodeURIComponent('Live cameras')]); return; }
    if (!r.ok || !d.ok) { $('msg').textContent = 'Cameras are temporarily unavailable. Please try again in a moment.'; return; }
    var bad = (d.providers || []).filter(function (x) { return x.status === 'unavailable'; });
    cams = d.cameras.filter(function (c) { return c.image || c.video; });
    if (!cams.length) { $('msg').textContent = bad.length ? 'The camera feed for ' + p[0] + ' is not answering right now. That does not mean there are no cameras. Try again soon.' : 'No public cameras with a picture were found near ' + p[0] + '.'; return; }
    $('msg').textContent = cams.length + ' camera' + (cams.length === 1 ? '' : 's') + ' near ' + p[0] + '. Pictures refresh about every minute.';
    var g = $('grid');
    cams.forEach(function (c, i) {
      var b = mk('button', 'lc-card'); b.type = 'button'; b.setAttribute('aria-label', 'Watch ' + c.name);
      var im = mk('img'); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.referrerPolicy = 'no-referrer'; im.src = bust(c.image || ''); im.onerror = function () { b.classList.add('off'); };
      var cap = mk('span', 'cap'); cap.append(mk('b', '', c.name), mk('i', '', (c.miles < 0.1 ? '<0.1' : c.miles.toFixed(1)) + ' mi' + (c.kind === 'video' ? ' · live video' : '')));
      b.append(im, cap); b.onclick = function () { pick(i, true); }; g.appendChild(b);
    });
    pick(0, false);
  }
  var bust = function (u) { return u ? u + (u.indexOf('?') >= 0 ? '&' : '?') + 't=' + Math.floor(Date.now() / 30000) : ''; };
  function pick(i, scroll) {
    if (!cams.length) return; cur = (i + cams.length) % cams.length; stop(); var c = cams[cur];
    $('stage').hidden = false; $('cname').textContent = c.name; $('cinfo').textContent = [c.road, c.direction, c.operator].filter(Boolean).join(' · ');
    document.querySelectorAll('.lc-card').forEach(function (b, k) { b.classList.toggle('on', k === cur); });
    var v = $('view'); v.textContent = ''; var upd = $('upd'); upd.textContent = '';
    var snap = function (note) {
      v.textContent = ''; var im = mk('img'); im.alt = 'Latest picture from ' + c.name; im.referrerPolicy = 'no-referrer'; im.decoding = 'async';
      var load = function () { im.src = bust(c.image); upd.textContent = (note || 'Picture refreshes about every minute.') + ' Last loaded ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + '.'; };
      im.onerror = function () { v.textContent = ''; v.appendChild(mk('p', 'lc-bad', 'This camera is not answering right now. Try the next one.')); upd.textContent = ''; };
      load(); v.appendChild(im); timer = setInterval(function () { if (!document.hidden) load(); }, 30000);
    };
    if (c.kind === 'video' && c.video) {
      var vid = mk('video'); vid.muted = true; vid.defaultMuted = true; vid.playsInline = true; vid.setAttribute('playsinline', ''); vid.controls = true; vid.autoplay = true; if (c.image) vid.poster = bust(c.image); vid.setAttribute('aria-label', 'Live video from ' + c.name); v.appendChild(vid);
      upd.textContent = 'Live video from the official stream.';
      var failed = false, fail = function () { if (failed || !vid.isConnected) return; failed = true; stop(); snap('Live video did not play here, showing the latest picture.'); };
      var go = function () { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () { /* the viewer's own play button stays available */ }); };
      vid.addEventListener('error', fail); vid.addEventListener('loadedmetadata', go); vid.addEventListener('canplay', go);
      setTimeout(function () { if (!failed && vid.readyState < 2) fail(); }, 12000);
      if (vid.canPlayType('application/vnd.apple.mpegurl')) { vid.src = c.video; go(); }
      else new Promise(function (ok, no) { if (window.Hls) return ok(); var s = document.createElement('script'); s.src = HLS; s.onload = ok; s.onerror = no; document.head.appendChild(s); }).then(function () { if (!window.Hls || !Hls.isSupported()) return fail(); var h = new Hls(); hls = h; h.on(Hls.Events.ERROR, function (e, x) { if (x && x.fatal) fail(); }); h.on(Hls.Events.MANIFEST_PARSED, go); h.loadSource(c.video); h.attachMedia(vid); }).catch(fail);
    } else if (c.kind === 'viewer' || !c.image) {
      var a = mk('a', 'lc-btn wide', 'Open the official camera'); a.href = c.viewer; a.target = '_blank'; a.rel = 'noopener noreferrer'; v.appendChild(mk('p', 'lc-bad', 'This camera plays on the operator’s own page.')); v.appendChild(a);
    } else snap();
    if (scroll) $('stage').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  $('prev').onclick = function () { pick(cur - 1, false); }; $('next').onclick = function () { pick(cur + 1, false); };
  document.addEventListener('keydown', function (e) { if (e.target.closest && e.target.closest('input,select,textarea')) return; if (e.key === 'ArrowLeft') pick(cur - 1, false); if (e.key === 'ArrowRight') pick(cur + 1, false); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && cams.length && cur >= 0 && !$('view').querySelector('video')) pick(cur, false); });
  paintSelectors(); load();
})();
