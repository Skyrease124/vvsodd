import { render } from './view.mjs';
const settings = await import('./settings.mjs');
localStorage.setItem('theme', settings.theme);
fetch('https://api.example.test/v1/products').then(r => r.json()).then(render);
fetch('/api/orders', { method: 'POST' });
