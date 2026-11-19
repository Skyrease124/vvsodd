/* PricePocket Live room. LiveKit Cloud carries the video; this page is entirely PricePocketAsset.
   The browser never sees the LiveKit secret: it asks /.netlify/functions/live for a short-lived token for ITS OWN signed-in identity. */
(function () {
  'use strict';
  var API = '/.netlify/functions/live';
  var LK = window.LivekitClient;
  var $ = function (id) { return document.getElementById(id); };
  var mk = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  var sid = (new URLSearchParams(location.search).get('s') || '').replace(/[^a-f0-9]/g, '');
  var room = null, info = null, me = null, role = 'guest', ended = false, leaving = false, poll = null, tiles = {}, facing = 'user', bannerT = null;
  var initials = function (n) { return (String(n || '?').replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 2).map(function (x) { return x[0]; }).join('') || '?').toUpperCase(); };
  var state = function (s) { $('lv').dataset.state = s; };

  function banner(text, ms) { var b = $('banner'); b.textContent = text; b.classList.add('on'); clearTimeout(bannerT); if (ms) bannerT = setTimeout(function () { b.classList.remove('on'); }, ms); }
  function hideBanner() { $('banner').classList.remove('on'); }
  function screen(card) { var s = $('screen'), c = $('screenCard'); c.textContent = ''; c.className = 'lv-card' + (card.two ? ' two' : ''); if (card.spin) c.appendChild(mk('div', 'lv-spin')); c.appendChild(mk('h2', '', card.title)); if (card.text) c.appendChild(mk('p', '', card.text)); var row = mk('div', 'row');
    (card.buttons || []).forEach(function (b) { var e = mk(b.href ? 'a' : 'button', 'b ' + (b.cls || ''), b.label); if (b.href) e.href = b.href; else { e.type = 'button'; e.onclick = b.fn; } row.appendChild(e); }); if (row.children.length) c.appendChild(row); s.hidden = false; }
  function closeScreen() { $('screen').hidden = true; }
  async function api(path, opt) { try { var r = await fetch(API + path, Object.assign({ credentials: 'same-origin' }, opt || {})); var j = await r.json().catch(function () { return {}; }); return { s: r.status, j: j }; } catch (e) { return { s: 0, j: { error: 'Could not reach PricePocketAsset. Check your connection.' } }; } }
  var post = function (o) { return api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }); };

  function endedScreen(text) {
    ended = true; stopPoll(); try { if (room) room.disconnect(); } catch (e) {} $('bar').hidden = true; $('panel').hidden = true; $('liveBadge').hidden = true; state('ended');
    screen({ title: 'This live has ended.', text: text || 'Thanks for watching.', buttons: [{ label: 'Back to PricePocketAsset', cls: 'gold', href: info && info.host ? '/community/profile/?u=' + encodeURIComponent(info.host.username) : '/community/' }] });
  }
  function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }

  // ---- tiles ----
  function nameOf(p) { try { var m = JSON.parse(p.metadata || '{}'); return m.name || p.name || 'Member'; } catch (e) { return p.name || 'Member'; } }
  function roleOf(p) { try { return JSON.parse(p.metadata || '{}').role; } catch (e) { return ''; } }
  function ensureTile(p) {
    var t = tiles[p.identity]; if (t) return t;
    var el = mk('div', 'lv-tile'), off = mk('div', 'off'), nm = mk('div', 'nm');
    off.appendChild(mk('b', '', initials(nameOf(p)))); var label = mk('span', '', ''); nm.appendChild(label);
    var mm = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); mm.setAttribute('viewBox', '0 0 24 24'); mm.setAttribute('class', 'mm'); mm.setAttribute('hidden', ''); mm.innerHTML = '<path d="M3 3l18 18M9 9v2a3 3 0 0 0 5 2M5 11a7 7 0 0 0 11 5.700M12 18v3"/>'; nm.appendChild(mm);
    el.append(off, nm); $('stage').appendChild(el); t = tiles[p.identity] = { el: el, off: off, label: label, mm: mm, nm: nm, video: null, audio: null, p: p }; return t;
  }
  function syncTiles() {
    if (!room) return;
    var all = [room.localParticipant].concat(Array.from(room.remoteParticipants.values()));
    var present = {}; all.forEach(function (p) { present[p.identity] = 1; });
    Object.keys(tiles).forEach(function (id) { if (!present[id]) { tiles[id].el.remove(); delete tiles[id]; } });
    // host first, then you, then everyone else
    all.sort(function (a, b) { return (roleOf(b) === 'host') - (roleOf(a) === 'host') || (b.isLocal - a.isLocal); });
    all.forEach(function (p) {
      var t = ensureTile(p); t.p = p; var host = roleOf(p) === 'host';
      t.el.classList.toggle('host', host); t.el.classList.toggle('speaking', !!p.isSpeaking);
      t.label.textContent = nameOf(p) + (p.isLocal ? ' (you)' : '');
      if (host && !t.nm.querySelector('.tag')) t.nm.insertBefore(mk('span', 'tag', 'Host'), t.nm.firstChild);
      var cam = p.getTrackPublication(LK.Track.Source.Camera), vt = cam && cam.track && !cam.isMuted ? cam.track : null;
      if (vt) { if (!t.video) { t.video = vt.attach(); t.video.setAttribute('playsinline', ''); t.video.muted = true; t.el.insertBefore(t.video, t.off); } t.video.classList.toggle('mirror', p.isLocal && facing === 'user'); t.off.hidden = true; }
      else { if (t.video) { try { cam && cam.track && cam.track.detach(t.video); } catch (e) {} t.video.remove(); t.video = null; } t.off.hidden = false; }
      var mic = p.getTrackPublication(LK.Track.Source.Microphone);
      t.mm.toggleAttribute('hidden', !!(mic && mic.track && !mic.isMuted));
      if (!p.isLocal) { if (mic && mic.track && !t.audio) { t.audio = mic.track.attach(); t.audio.hidden = true; document.body.appendChild(t.audio); } else if ((!mic || !mic.track) && t.audio) { t.audio.remove(); t.audio = null; } }
    });
    $('stage').dataset.n = String(all.length);
    var guests = all.filter(function (p) { return roleOf(p) !== 'host'; }).length;
    var c = $('count'); c.hidden = false; c.textContent = guests + (guests === 1 ? ' watching' : ' watching');
    paintPeople(); paintButtons();
  }
  function paintButtons() {
    if (!room) return; var lp = room.localParticipant;
    $('mic').setAttribute('aria-pressed', String(!!lp.isMicrophoneEnabled)); $('mic').querySelector('.tx').textContent = lp.isMicrophoneEnabled ? 'Mic on' : 'Mic off';
    $('cam').setAttribute('aria-pressed', String(!!lp.isCameraEnabled)); $('cam').querySelector('.tx').textContent = lp.isCameraEnabled ? 'Cam on' : 'Cam off';
    $('flip').hidden = !(lp.isCameraEnabled && canFlip);
  }
  function paintPeople() {
    var ul = $('people'); if ($('panel').hidden) return; ul.textContent = '';
    var all = [room.localParticipant].concat(Array.from(room.remoteParticipants.values()));
    all.forEach(function (p) { var li = mk('li'), n = mk('div', 'n'); n.append(mk('b', '', nameOf(p) + (p.isLocal ? ' (you)' : '')), mk('span', '', roleOf(p) === 'host' ? 'Host' : (p.isMicrophoneEnabled ? 'Mic on' : 'Mic off') + (p.isCameraEnabled ? ' · Camera on' : ' · Camera off'))); li.appendChild(n);
      if (role === 'host' && !p.isLocal) { var b = mk('button', 'lv-act', 'Remove'); b.type = 'button'; b.onclick = function () { confirmRemove(p); }; li.appendChild(b); } ul.appendChild(li); });
  }
  function confirmRemove(p) {
    screen({ two: true, title: 'Remove ' + nameOf(p) + '?', text: 'They are disconnected from this live and cannot rejoin it.', buttons: [{ label: 'Cancel', fn: closeScreen }, { label: 'Remove', cls: 'red', fn: async function () { closeScreen(); var r = await post({ action: 'remove', id: sid, identity: p.identity }); banner(r.s === 200 ? nameOf(p) + ' was removed.' : (r.j.error || 'Could not remove them.'), 3500); } }] });
  }

  // ---- media ----
  var canFlip = false;
  async function detectFlip() { try { var d = await navigator.mediaDevices.enumerateDevices(); canFlip = d.filter(function (x) { return x.kind === 'videoinput'; }).length > 1 || /iPhone|iPad|Android/i.test(navigator.userAgent); } catch (e) { canFlip = false; } }
  function mediaError(e, what) {
    var n = e && e.name, perm = n === 'NotAllowedError' || n === 'SecurityError';
    return perm ? (what === 'mic' ? 'Microphone access is blocked. Open your browser settings and allow the microphone for PricePocketAsset.' : 'Camera access is blocked. Open your browser settings and allow the camera for PricePocketAsset.')
      : (n === 'NotFoundError' ? 'No ' + (what === 'mic' ? 'microphone' : 'camera') + ' was found on this device.' : (what === 'mic' ? 'Your microphone is unavailable right now.' : 'Your camera is unavailable right now.'));
  }
  async function enable(kind, on) {
    var lp = room.localParticipant;
    try { if (kind === 'cam') await lp.setCameraEnabled(on, on ? { facingMode: facing, resolution: { width: 1280, height: 720, frameRate: 30 } } : undefined); else await lp.setMicrophoneEnabled(on); return true; }
    catch (e) { banner(mediaError(e, kind), 6000); return false; } finally { syncTiles(); }
  }
  async function startMedia() {
    var cam = await enable('cam', true), mic = await enable('mic', true);
    if (!cam && !mic && role === 'host') screen({ title: 'Camera access is required to go live.', text: 'Open your browser settings and allow camera and microphone access for PricePocketAsset, then try again.', buttons: [{ label: 'Try again', cls: 'gold', fn: function () { closeScreen(); startMedia(); } }, { label: 'Leave', fn: leave }] });
  }

  // ---- connect ----
  async function connect() {
    if (!sid) { screen({ title: 'Live not found', text: 'This link does not point to a live.', buttons: [{ label: 'Back to Community', href: '/community/', cls: 'gold' }] }); return; }
    if (!LK) { screen({ title: 'Could not load video', text: 'The video library did not load. Check your connection and try again.', buttons: [{ label: 'Try again', cls: 'gold', fn: function () { location.reload(); } }] }); return; }
    state('connecting'); screen({ spin: true, title: 'Connecting to PricePocket Live…' });
    var t = await api('?token=' + sid);
    if (t.s === 401) { location.href = '/login/?next=' + encodeURIComponent(location.pathname + location.search); return; }
    if (t.j.ended || t.s === 410) { info = (await api('?s=' + sid)).j.session || null; return endedScreen(); }
    if (t.j.setup) return screen({ title: 'PricePocket Live is not switched on yet', text: 'The site owner still needs to finish setup. Please check back soon.', buttons: [{ label: 'Back', href: '/community/', cls: 'gold' }] });
    if (t.s !== 200 || !t.j.token) return screen({ title: 'You cannot join this live', text: t.j.error || 'Something went wrong. Please try again.', buttons: [{ label: 'Back to Community', href: '/community/', cls: 'gold' }, { label: 'Try again', fn: function () { location.reload(); } }] });
    info = t.j.session; me = t.j.me; role = t.j.role; paintHeader();
    room = new LK.Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { facingMode: facing, resolution: LK.VideoPresets ? LK.VideoPresets.h720.resolution : undefined } });
    var rs = LK.RoomEvent, sync = function () { syncTiles(); };
    [rs.ParticipantConnected, rs.ParticipantDisconnected, rs.TrackSubscribed, rs.TrackUnsubscribed, rs.TrackMuted, rs.TrackUnmuted, rs.LocalTrackPublished, rs.LocalTrackUnpublished, rs.ActiveSpeakersChanged, rs.ParticipantMetadataChanged].forEach(function (ev) { if (ev) room.on(ev, sync); });
    room.on(rs.Reconnecting, function () { state('reconnecting'); banner('Reconnecting…'); });
    room.on(rs.Reconnected, function () { state('connected'); banner('Back online.', 2500); syncTiles(); });
    room.on(rs.MediaDevicesError, function (e) { banner(mediaError(e, 'cam'), 6000); });
    room.on(rs.AudioPlaybackStatusChanged, function () { if (!room.canPlaybackAudio) banner('Tap anywhere to turn the sound on.'); else hideBanner(); });
    room.on(rs.Disconnected, function (reason) {
      if (leaving || ended) return; var D = LK.DisconnectReason || {};
      if (reason === D.PARTICIPANT_REMOVED) { ended = true; stopPoll(); $('bar').hidden = true; return screen({ title: 'You were removed from this live.', text: 'The host removed you.', buttons: [{ label: 'Back to Community', href: '/community/', cls: 'gold' }] }); }
      if (reason === D.ROOM_DELETED) return endedScreen();
      state('disconnected'); $('bar').hidden = true; screen({ title: 'Connection lost', text: 'Your connection dropped. You can rejoin the live.', buttons: [{ label: 'Rejoin', cls: 'gold', fn: function () { closeScreen(); rejoin(); } }, { label: 'Leave', fn: leave }] });
    });
    try { await room.connect(t.j.url, t.j.token); }
    catch (e) { return screen({ title: 'Could not connect', text: 'We could not reach the live video service. Check your connection and try again.', buttons: [{ label: 'Try again', cls: 'gold', fn: function () { location.reload(); } }, { label: 'Back', href: '/community/' }] }); }
    closeScreen(); state('connected'); $('bar').hidden = false; $('liveBadge').hidden = false; $('endLive').hidden = role !== 'host'; await detectFlip(); syncTiles();
    startMedia(); startPoll();
  }
  async function rejoin() { try { if (room) { room.removeAllListeners(); } } catch (e) {} room = null; tiles = {}; $('stage').textContent = ''; connect(); }
  function paintHeader() {
    var h = info && info.host; $('hostName').textContent = h ? h.name : 'PricePocket Live'; var hb = document.querySelector('.lv-host'); if (hb && h && h.username && role !== 'host') { hb.style.cursor = 'pointer'; hb.setAttribute('role', 'link'); hb.setAttribute('tabindex', '0'); hb.title = 'Open profile (Follow, Message)'; hb.onclick = function () { window.open('/community/profile/?u=' + encodeURIComponent(h.username), '_blank', 'noopener'); }; } $('liveTitle').textContent = info ? info.title : '';
    var a = $('hostAva'); a.textContent = ''; if (h && h.founder) a.classList.add('f'); else a.textContent = initials(h && h.name); document.title = (info ? info.title + ' | ' : '') + 'PricePocket Live';
  }
  function startPoll() { stopPoll(); poll = setInterval(async function () { var r = await api('?s=' + sid); if (r.s === 200 && r.j.session && !r.j.session.is_live) endedScreen(); }, 8000); }

  // ---- controls ----
  async function leave() { leaving = true; stopPoll(); try { if (room) await room.disconnect(); } catch (e) {} location.href = info && info.host ? '/community/profile/?u=' + encodeURIComponent(info.host.username) : '/community/'; }
  $('leave').onclick = function () { if (role === 'host') screen({ two: true, title: 'Leave without ending?', text: 'Your live keeps running and people can still watch. Use End live to finish it.', buttons: [{ label: 'Stay', fn: closeScreen }, { label: 'Leave', fn: leave }] }); else leave(); };
  $('endLive').onclick = function () { screen({ two: true, title: 'End this live session?', text: 'Everyone is disconnected and your profile stops showing LIVE.', buttons: [{ label: 'Cancel', fn: closeScreen }, { label: 'End live', cls: 'red', fn: async function () { closeScreen(); var r = await post({ action: 'end', id: sid }); if (r.s === 200) { leaving = true; try { await room.disconnect(); } catch (e) {} location.href = '/community/profile/?u=' + encodeURIComponent(info.host.username); } else banner(r.j.error || 'Could not end the live. Try again.', 4000); } }] }); };
  $('mic').onclick = function () { enable('mic', !room.localParticipant.isMicrophoneEnabled); };
  $('cam').onclick = function () { enable('cam', !room.localParticipant.isCameraEnabled); };
  $('flip').onclick = async function () {
    var pub = room.localParticipant.getTrackPublication(LK.Track.Source.Camera); if (!pub || !pub.track) return; var next = facing === 'user' ? 'environment' : 'user';
    try { await pub.track.restartTrack({ facingMode: next }); facing = next; banner(next === 'user' ? 'Front camera' : 'Back camera', 1500); } catch (e) { banner('Could not switch cameras on this device.', 4000); } syncTiles();
  };
  $('ppl').onclick = function () { $('panel').hidden = !$('panel').hidden; paintPeople(); };
  $('closePanel').onclick = function () { $('panel').hidden = true; };
  document.addEventListener('click', function () { if (room && !room.canPlaybackAudio) room.startAudio().catch(function () {}); }, { passive: true });
  window.addEventListener('pagehide', function () { stopPoll(); });
  connect();
})();
