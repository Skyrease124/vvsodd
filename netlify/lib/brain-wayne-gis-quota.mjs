// One UTC budget for the Brain's official Wayne/Detroit GIS requests.
// Ticket reservations are monotonic: do not refund after a timeout or interruption.
export const WAYNE_DAILY_LIMIT = 30;

const activationKey = 'brain-wayne-gis-quota-activation-v1';
const dayKey = day => 'brain-wayne-gis-quota-v1-' + day;
const utcDay = date => date.toISOString().slice(0, 10);

export async function readWayneQuota(storage, now = new Date()) {
  const day = utcDay(now);
  const activation = await storage.read(activationKey);
  const active = /^\d{4}-\d{2}-\d{2}$/.test(activation?.data?.day) && activation.data.day < day;
  const saved = active ? await storage.read(dayKey(day)) : null;
  const start=active||!activation?.data?.day?null:new Date(activation.data.day+'T00:00:00Z');
  if(start&&Number.isFinite(start.getTime()))start.setUTCDate(start.getUTCDate()+1);
  return { active, count: saved?.data?.count ?? 0,
    resumeAt:start&&Number.isFinite(start.getTime())?start.toISOString():null };
}

export async function reserveWayneRequest(storage, now = () => new Date()) {
  const day = utcDay(now());
  let activation = await storage.read(activationKey);
  if (!activation) {
    const created = await storage.write(activationKey, { day }, null);
    activation = created ? { data: { day } } : await storage.read(activationKey);
  }
  // Older paths had no reconstructible total. Wait for a clean UTC day
  // rather than allowing a fresh budget on top of uncounted dispatches.
  const activationDay = activation?.data?.day;
  if (typeof activationDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(activationDay) || activationDay >= day) {
    throw Object.assign(Error('Shared GIS quota opens after the cutover UTC day'), { code: 'QUOTA', quotaState: 'quota_cutover' });
  }

  const key = dayKey(day);
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await storage.read(key);
    const count = current ? current.data?.count : 0;
    if (!Number.isInteger(count) || count < 0) throw Error('Invalid saved GIS quota');
    if (count >= WAYNE_DAILY_LIMIT) {
      throw Object.assign(Error('Daily GIS request limit reached'), { code: 'QUOTA' });
    }
    if (await storage.write(key, { count: count + 1 }, current ? current.etag : null)) {
      if (utcDay(now()) !== day) {
        throw Object.assign(Error('UTC day changed before GIS dispatch'), { code: 'QUOTA', quotaState: 'quota_unavailable' });
      }
      return count + 1;
    }
  }
  throw Object.assign(Error('GIS budget busy; try again later'), { code: 'QUOTA', quotaState: 'quota_unavailable' });
}
