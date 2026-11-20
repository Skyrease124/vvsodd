window.ppaAccount.then(user => {
  const status = document.getElementById('owner-status');
  if (!user?.owner) { status.textContent = 'Owner access is required.'; return; }
  document.getElementById('owner-badge').hidden = false;
  status.textContent = 'Manage members, data and site operations.';
  const list = document.getElementById('owner-tools');
  const tools = [
    ['Members','Manage access and membership','/members/','profile'],
    ['Imports & review','Review incoming county data','/admin/imports/','layers'],
    ['Retail Alerts','Manage alert settings','/owner/retail/','search'],
    ['API keys','Manage service credentials','/owner/keys/','lock'],
    ['Read a county PDF','Extract county records','/owner/ocr/','file'],
    ['Usage','Review AI activity and limits','/usage/','chart'],
    ['Billing setup','Manage billing configuration','/billing/','file']
  ];
  tools.forEach(([name, note, url, icon]) => {
    const link = document.createElement('a'); link.className = 'app-card'; link.href = url;
    const label = document.createElement('b'); label.textContent = name;
    const caption = document.createElement('small'); caption.textContent = note;
    link.innerHTML = window.ppaIcon(icon);
    link.append(label,caption); list.appendChild(link);
  });
  list.hidden = false;
});
