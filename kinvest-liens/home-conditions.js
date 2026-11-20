(function () {
  const host = document.getElementById('homewx');
  const location = window.ppaLocation;
  if (!host || !location) return;
  const make = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text || '' });
  let request, previous;
  const link = (text, href) => Object.assign(make('a', '', text), { href });
  const render = async (area, force = false) => {
    const key = [area?.lat, area?.lng, area?.label].join('|');
    if (key === previous && !force) return;
    previous = key;
    request?.abort();
    const job = new AbortController(); request = job;
    const user = await window.ppaAccount;
    if (job.signal.aborted) return;
    const card = make('section', 'app-weather');
    if (!user?.paid && !user?.owner) {
      const copy = make('div', 'app-weather-copy');
      copy.append(make('b', '', 'Local Weather'), make('small', '', area?.label || 'Forecast by map area'));
      const pro = link('Pro', '/plans/?src=Local%20weather'); pro.className = 'app-badge'; pro.setAttribute('aria-label', 'Local weather is a Pro feature');
      card.append(make('span', 'app-weather-symbol', '☁'), copy, pro); host.replaceChildren(card); return;
    }
    if (!location.coordinates(area?.lat, area?.lng)) {
      card.append(make('span', 'app-weather-symbol', '☁'), make('div', 'app-weather-copy', area?.label ? 'Choose a county for local weather in ' + area.label + '.' : 'Choose a map area for local weather.'));
      host.replaceChildren(card); return;
    }
    card.append(make('div', 'app-weather-copy', 'Checking weather near ' + (area.label || 'the map area') + '…')); host.replaceChildren(card);
    try {
      const query = new URLSearchParams({ mode:'me', lat:area.lat.toFixed(3), lng:area.lng.toFixed(3) });
      const res = await fetch('/.netlify/functions/wxnow?' + query, {signal:job.signal});
      const data = await res.json();
      if (!res.ok || !data.ok || !data.now) throw new Error('unavailable');
      if (job.signal.aborted) return;
      const details = make('details', 'app-weather');
      const summary = make('summary', 'app-weather-now');
      const image = Object.assign(make('img', 'app-weather-icon'), {src:data.now.icon,alt:'',width:34,height:34});
      const copy = make('div','app-weather-copy');
      const label = [data.place?.name, area.state || data.place?.region].filter(Boolean).join(', ');
      copy.append(make('b','',label || area.label), make('small','',data.now.text));
      const today = data.days?.[0];
      const temp = make('div','app-weather-temp'); temp.append(make('strong','',data.now.f + '°'), make('small','',today ? 'H ' + today.hi + '°  L ' + today.lo + '°' : ''));
      summary.append(image,copy,temp); details.append(summary);
      const extras = make('div','app-weather-extra');
      (data.alerts || []).forEach(a => {
        if (/^https:\/\//i.test(a.link || '')) extras.append(link(a.event, a.link));
      });
      if (data.air?.label) extras.append(make('p','','Air quality · ' + data.air.label));
      const forecast = make('ul', '');
      (data.days || []).forEach((day,i) => forecast.append(make('li','', (i === 0 ? 'Today' : new Date(day.date + 'T12:00').toLocaleDateString('en-US',{weekday:'short'})) + ' · ' + day.hi + '° / ' + day.lo + '° · ' + day.text)));
      extras.append(forecast); details.append(extras); host.replaceChildren(details);
    } catch(e) {
      if (!job.signal.aborted) card.replaceChildren(make('div','app-weather-copy','Weather unavailable for ' + (area.label || 'this area') + '.'));
    }
  };
  location.subscribe(area => render(area));
  location.ready().then(area => render(area));
  setInterval(() => { if (!document.hidden) render(location.get(),true); }, 3 * 3600e3);
})();
