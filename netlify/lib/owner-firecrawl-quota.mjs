// Owner-only scan quotas. Successful extractions count toward the 3/day, 25/month
// allowance; failed calls are separately throttled to protect the Firecrawl account.
// v2 intentionally does not inherit historical v1 counters that included failed calls.
export const SUCCESS_DAILY_MAX=3;
export const SUCCESS_MONTHLY_MAX=25;
export const ATTEMPT_DAILY_MAX=8;
export const MIN_RETRY_MS=60_000;
export const periodKeys=(now=new Date())=>({
 day:now.toISOString().slice(0,10),month:now.toISOString().slice(0,7)
});
export const successKey=month=>'owner-intel-firecrawl-success-v2-'+month;
export const attemptKey=day=>'owner-intel-firecrawl-attempt-v2-'+day;
export function quotaDecision(success,attempt,now=new Date()){
 const {day}=periodKeys(now);
 const successfulDay=Number(success?.days?.[day]||0);
 const successfulMonth=Number(success?.total||0);
 const attempts=Number(attempt?.count||0);
 const last=Date.parse(attempt?.lastAttemptAt||'');
 if(successfulMonth>=SUCCESS_MONTHLY_MAX||successfulDay>=SUCCESS_DAILY_MAX)
  return {allowed:false,reason:'Successful Firecrawl scan quota reached (3/day, 25/month).'};
 if(attempts>=ATTEMPT_DAILY_MAX)
  return {allowed:false,reason:'Firecrawl retry safety limit reached today. This protects your API credits.'};
 if(Number.isFinite(last)&&now.getTime()-last<MIN_RETRY_MS)
  return {allowed:false,reason:'Try again in one minute to prevent repeated Firecrawl requests.'};
 return {allowed:true};
}
export function recordAttempt(attempt,now=new Date()){
 return {count:Math.max(0,Number(attempt?.count||0))+1,lastAttemptAt:now.toISOString()};
}
export function recordSuccess(success,now=new Date()){
 const {day}=periodKeys(now);
 return {total:Math.max(0,Number(success?.total||0))+1,
  days:{...(success?.days||{}),[day]:Math.max(0,Number(success?.days?.[day]||0))+1}};
}
export function sourceCooldown(previous,provider,now=new Date()){
 return previous?.provider===provider&&Number.isFinite(Date.parse(previous?.checkedAt||''))&&
  now.getTime()-Date.parse(previous.checkedAt)<6*60*60*1000;
}
