process.env.NVIDIA_API_KEY = 'nvapi-SECRETKEYENDINGWITHwxyz';
const { call } = await import('./harness.mjs'); const r = await call('setup', { method: 'GET', ip: '8.8.8.8' }); console.log(r.status, r.text); process.exit(0);
