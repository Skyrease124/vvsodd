// One shared allowance for every Groq request: the owner's connection test and Groq triage count against the
// same daily and per-minute counters. The owner's saved caps (API Keys, AI Research Controls) apply, never above the
// ceiling below. The ceiling is deliberately small (free tier) and only changes here, in reviewed code.
export const GROQ_DAILY_KEY = 'owner-groq-daily';
export const GROQ_MINUTE_KEY = 'owner-groq-minute';
export const GROQ_CEILING = Object.freeze({daily: 100, minute: 2}); // daily raised from 10 by the owner; free tier
const DAY = 86400000, MINUTE = 60000;

export function groqCaps(settings) {
  const s = {groqEnabled: true, groqDailyCap: 800, groqMinuteCap: 20, ...(settings || {})};
  const daily = Math.min(GROQ_CEILING.daily, Math.max(0, Math.floor(Number(s.groqDailyCap)) || 0));
  const minute = Math.min(GROQ_CEILING.minute, Math.max(1, Math.floor(Number(s.groqMinuteCap)) || 1));
  return {enabled: s.groqEnabled !== false && daily > 0, daily, minute};
}

// Counts one request against both counters, daily first. Returns {ok, error?}.
export async function reserveGroq(RL, caps) {
  if (!(await RL.hit(GROQ_DAILY_KEY, caps.daily, DAY)).ok) return {ok: false, error: 'Groq daily limit reached (' + caps.daily + ' per day).'};
  if (!(await RL.hit(GROQ_MINUTE_KEY, caps.minute, MINUTE)).ok) return {ok: false, error: 'Groq per-minute limit reached. Wait before another request.'};
  return {ok: true};
}

// Looks without counting.
export async function groqUsedToday(RL, caps) {
  return (await RL.peek(GROQ_DAILY_KEY, caps.daily, DAY)).used ?? 0;
}
