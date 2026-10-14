// One-time invite links for the Netlify build. On ChatGPT Sites a new member proves they own their approved email
// by signing in with ChatGPT before creating a password; Netlify has no such sign-in, so the owner sends each
// approved member a private link instead. Opening it lets that member (and only them) set a password.
// The link works once, for 7 days, and only while the email is still approved. Only its SHA-256 is stored.
import type { SecretEnv } from './secret-store';
import { OWNER_EMAIL, type Member, accessPage, authLimit, escape, hex, memberForm, newSession, passwordHash, sha } from './access';
import { issueCsrf } from './connection-page';

export const INVITE_LINKS = Boolean(import.meta.env.VITE_SKYDATA_NETLIFY);
const INVITE_DAYS = 7;
const tokenFrom = (value: string | null) => (value && /^[a-f0-9]{64}$/.test(value) ? value : null);

/** A new link for an approved member, replacing any earlier one. Also resets the password of an existing member. */
export async function createInvite(env: SecretEnv, request: Request, email: string) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB!.prepare('INSERT INTO member_invites (email, token_hash, created, expires) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET token_hash = excluded.token_hash, created = excluded.created, expires = excluded.expires')
    .bind(email, await sha(token), Date.now(), Date.now() + INVITE_DAYS * 86400000)
    .run();
  return new URL('/invite?t=' + token, request.url).href;
}

/** Revoked or banned members lose any unused link. */
export const dropInvite = (env: SecretEnv, email: string) => env.DB!.prepare('DELETE FROM member_invites WHERE email = ?').bind(email);

/** The owner's ready-to-send email with the link inside. */
export function inviteEmail(email: string, link: string, login: string) {
  return 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Your SkyData invitation') + '&body=' + encodeURIComponent(`You have been invited to SkyData.\n\nOpen this private link to create your password (it works once, for ${INVITE_DAYS} days):\n${link}\n\nAfter that, sign in at ${login} with ${email} and your password.\n\nPlease don't share this link: anyone who opens it first can set the password.`);
}

async function findInvite(env: SecretEnv, token: string) {
  const row = await env.DB!.prepare("SELECT member_invites.token_hash, members.* FROM member_invites JOIN members ON members.email = member_invites.email WHERE member_invites.token_hash = ? AND member_invites.expires > ? AND members.status = 'approved'")
    .bind(await sha(token), Date.now())
    .first<Member & { token_hash: string }>();
  return row && row.email !== OWNER_EMAIL ? row : null;
}

const invalid = () => accessPage('Invite link not valid', '<section class="panel narrow"><p>This invite link has expired, was already used, or was replaced by a newer one.</p><p>Ask the SkyData owner to send you a new link. If you already created your password, <a href="/login">sign in</a>.</p></section>', 410);

function invitePage(member: Member, token: string, csrf: string, message = '', status = 200) {
  const reset = Boolean(member.password_hash);
  return accessPage(reset ? 'Choose a new password' : 'Join SkyData', `<section class="panel narrow"><h2>${reset ? 'Reset your password' : 'Create your SkyData password'}</h2><p>Your approved email:</p><p class="email"><strong>${escape(member.email)}</strong></p>${message ? `<p class="error" role="alert">${escape(message)}</p>` : ''}<form action="/invite" method="post"><input type="hidden" name="csrf" value="${escape(csrf)}"><input type="hidden" name="t" value="${escape(token)}"><input type="email" name="email" value="${escape(member.email)}" autocomplete="username" readonly hidden><label for="password">Password</label><input id="password" name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password"><label for="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" required minlength="12" maxlength="256" autocomplete="new-password"><button>${reset ? 'Save password and sign in' : 'Create account and sign in'}</button></form><p class="muted">At least 12 characters. Choose a password you do not use elsewhere. This link works only once.</p></section>`, status);
}

/** /invite?t=… (GET) shows the form; POST sets the password, uses up the link and signs the member in. */
export async function handleInvite(request: Request, env: SecretEnv) {
  if (request.method === 'GET') {
    const token = tokenFrom(new URL(request.url).searchParams.get('t'));
    const member = token && (await findInvite(env, token));
    return member ? invitePage(member, token, await issueCsrf(request, env)) : invalid();
  }
  if (request.method !== 'POST') return new Response('Use GET or POST', { status: 405 });
  let form: URLSearchParams;
  try {
    form = await memberForm(request, env);
  } catch (e) {
    return accessPage('Invite link', `<section class="panel narrow"><p class="error" role="alert">${escape(e instanceof Error ? e.message : 'Reload this page and try again.')}</p></section>`, 400);
  }
  const token = tokenFrom(form.get('t'));
  const member = token && (await findInvite(env, token));
  if (!member) return invalid();
  const csrf = await issueCsrf(request, env);
  const password = form.get('password') || '';
  if (password.length < 12 || password.length > 256 || password !== form.get('confirm')) return invitePage(member, token, csrf, 'Use 12–256 characters and enter the same password twice.', 400);
  if (!(await authLimit(request, env, member.email))) return invitePage(member, token, csrf, 'Too many attempts. Try again in 10 minutes.', 429);
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await passwordHash(password, salt);
  const userId = member.user_id || 'member-' + hex(crypto.getRandomValues(new Uint8Array(16)));
  // Deleting the invite first, by its exact hash, makes the link single-use even if it is submitted twice at once.
  const used = await env.DB!.prepare('DELETE FROM member_invites WHERE email = ? AND token_hash = ? RETURNING email').bind(member.email, member.token_hash).first<{ email: string }>();
  if (!used) return invalid();
  await env.DB!.batch([
    env.DB!.prepare("UPDATE members SET user_id = COALESCE(user_id, ?), password_hash = ?, password_salt = ? WHERE email = ? AND status = 'approved'").bind(userId, hash, salt, member.email),
    env.DB!.prepare('DELETE FROM member_sessions WHERE email = ?').bind(member.email),
  ]);
  return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': await newSession(env, member.email), 'Cache-Control': 'no-store' } });
}
