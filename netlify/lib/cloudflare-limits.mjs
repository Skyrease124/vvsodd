// One shared allowance for every Cloudflare Workers AI request (free allowance only). The owner's saved caps apply, never
// above the reviewed ceiling below, which only changes here, in reviewed code. Same shape as gemini-limits.mjs.
export const CF_DAILY_KEY = 'owner-cloudflare-daily';
export const CF_MINUTE_KEY = 'owner-cloudflare-minute';
export const CF_CEILING = Object.freeze({daily: 10, minute: 1});
const DAY = 86400000, MINUTE = 60000;

export function cloudflareCaps(settings) {
  const s = {cloudflareEnabled: true, cloudflareDailyCap: CF_CEILING.daily, ...(settings || {})};
  const daily = Math.min(CF_CEILING.daily, Math.max(0, Math.floor(Number(s.cloudflareDailyCap)) || 0));
  return {enabled: s.cloudflareEnabled !== false && daily > 0, daily, minute: CF_CEILING.minute};
}

// Per-minute first, so a refused request never uses up the daily allowance. A failed request still counts.
export async function reserveCloudflare(RL, caps) {
  if (!(await RL.hit(CF_MINUTE_KEY, caps.minute, MINUTE)).ok) return {ok: false, error: 'Cloudflare per-minute limit reached. Wait before another request.'};
  if (!(await RL.hit(CF_DAILY_KEY, caps.daily, DAY)).ok) return {ok: false, error: 'Cloudflare daily limit reached (' + caps.daily + ' per day).'};
  return {ok: true};
}

export async function cloudflareUsedToday(RL, caps) {
  return (await RL.peek(CF_DAILY_KEY, caps.daily, DAY)).used ?? 0;
}
