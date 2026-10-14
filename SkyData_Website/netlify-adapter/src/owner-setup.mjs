// One-time owner setup (and owner password reset) for the Netlify copy of SkyData.
// On ChatGPT Sites the owner was recognised by their ChatGPT sign-in. Here the owner proves it with a setup
// code that only they were given: the deploy holds just its SHA-256, never the code itself.
export const OWNER_SETUP_PATH = '/owner-setup';
export const OWNER_EMAIL = 'skyariasa@gmail.com'; // the same owner address SkyData's code hard-codes

const hex = (bytes) => Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, '0')).join('');
const sha = async (text) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

// Identical to SkyData's passwordHash() in lib/access.ts, so the site's normal login accepts the result.
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256));
}

function equal(a, b) {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function page(body, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owner setup · SkyData</title><style>body{margin:0;background:#080d17;color:#edf4ff;font:16px/1.6 Arial,sans-serif}main{max-width:520px;margin:0 auto;padding:40px 22px}label{display:block;margin-top:14px}input{width:100%;box-sizing:border-box;font:inherit;padding:10px;border-radius:8px;border:1px solid #2b3b57;background:#0f1726;color:#edf4ff}button{margin-top:20px;font:inherit;padding:10px 18px;border-radius:8px;border:0;background:#4c8dff;color:#fff}.error{color:#ff9b9b}.ok{color:#8ff0b0}</style></head><body><main><h1>SkyData owner setup</h1>${body}</main></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" } },
  );
}

function form(message = '', exists = false) {
  return `<p>${exists ? 'Reset the owner password.' : 'Create the owner login for this site.'} Owner email: <strong>${OWNER_EMAIL}</strong></p>${message ? `<p class="error" role="alert">${esc(message)}</p>` : ''}<form method="post"><label>Setup code<input name="code" autocomplete="off" required></label><label>New password (12+ characters)<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><label>Repeat password<input name="confirm" type="password" autocomplete="new-password" required></label><button>Save</button></form>`;
}

async function attemptsLeft(db) {
  const window = Math.floor(Date.now() / 600000);
  const row = await db
    .prepare('INSERT INTO request_limits (id, window, count) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE SET window = excluded.window, count = CASE WHEN request_limits.window = excluded.window THEN request_limits.count + 1 ELSE 1 END RETURNING count')
    .bind('owner-setup', window)
    .first();
  return (row?.count ?? 99) <= 10;
}

export async function ownerSetup(request, env, setupCodeHash) {
  const db = env.DB;
  const admin = await db.prepare("SELECT owner FROM site_admin WHERE id = 'owner'").first();
  if (!setupCodeHash) return page('<p class="error">Owner setup is not enabled for this deploy.</p>', 404);
  if (request.method === 'GET') return page(form('', Boolean(admin)));
  if (request.method !== 'POST') return new Response('Use POST', { status: 405 });
  if (request.headers.get('origin') !== new URL(request.url).origin) return page(form('Reload this page and try again.', Boolean(admin)), 403);
  if (!(await attemptsLeft(db))) return page(form('Too many attempts. Try again in 10 minutes.', Boolean(admin)), 429);
  const data = new URLSearchParams(await request.text());
  const code = (data.get('code') ?? '').trim();
  const password = data.get('password') ?? '';
  if (code.length > 200 || !equal(await sha(code), setupCodeHash)) return page(form('That setup code is not right.', Boolean(admin)), 401);
  if (password.length < 12 || password.length > 256 || password !== data.get('confirm')) return page(form('Use 12–256 characters and type the same password twice.', Boolean(admin)), 400);

  const userId = admin?.owner ?? 'owner-' + hex(crypto.getRandomValues(new Uint8Array(16)));
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await passwordHash(password, salt);
  await db.batch([
    db.prepare("INSERT INTO site_admin (id, owner) VALUES ('owner', ?) ON CONFLICT(id) DO NOTHING").bind(userId),
    db
      .prepare("INSERT INTO members (email, user_id, status, password_hash, password_salt, created) VALUES (?, ?, 'approved', ?, ?, ?) ON CONFLICT(email) DO UPDATE SET user_id = excluded.user_id, status = 'approved', password_hash = excluded.password_hash, password_salt = excluded.password_salt")
      .bind(OWNER_EMAIL, userId, hash, salt, Date.now()),
    db.prepare('DELETE FROM member_sessions WHERE email = ?').bind(OWNER_EMAIL),
  ]);
  return page(`<p class="ok">Saved. Sign in with ${OWNER_EMAIL} and your new password.</p><p><a href="/login" style="color:#9cc2ff">Go to sign-in</a></p>`);
}
