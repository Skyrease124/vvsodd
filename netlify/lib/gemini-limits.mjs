// One shared allowance for every Gemini request (free tier only). The owner's saved caps apply, never above the
// reviewed ceiling below, which only changes here, in reviewed code. Same shape as groq-limits.mjs.
export const GEMINI_DAILY_KEY = 'owner-gemini-daily';
export const GEMINI_MINUTE_KEY = 'owner-gemini-minute';
export const GEMINI_STOP_KEY = 'owner-gemini-stopped';
export const GEMINI_CEILING = Object.freeze({daily: 5, minute: 1});
const DAY = 86400000, MINUTE = 60000;

export function geminiCaps(settings) {
  const s = {geminiEnabled: true, geminiDailyCap: GEMINI_CEILING.daily, geminiMinuteCap: GEMINI_CEILING.minute, ...(settings || {})};
  const daily = Math.min(GEMINI_CEILING.daily, Math.max(0, Math.floor(Number(s.geminiDailyCap)) || 0));
  const minute = Math.min(GEMINI_CEILING.minute, Math.max(1, Math.floor(Number(s.geminiMinuteCap)) || 1));
  return {enabled: s.geminiEnabled !== false && daily > 0, daily, minute};
}

// Counts one request against both counters, per-minute first, so a refused request never uses up the daily allowance. A failed request still counts. Returns {ok, error?}.
export async function reserveGemini(RL, caps) {
  if (!(await RL.hit(GEMINI_MINUTE_KEY, caps.minute, MINUTE)).ok) return {ok: false, error: 'Gemini per-minute limit reached. Wait before another request.'};
  if (!(await RL.hit(GEMINI_DAILY_KEY, caps.daily, DAY)).ok) return {ok: false, error: 'Gemini daily limit reached (' + caps.daily + ' per day).'};
  return {ok: true};
}

export async function geminiUsedToday(RL, caps) {
  return (await RL.peek(GEMINI_DAILY_KEY, caps.daily, DAY)).used ?? 0;
}
