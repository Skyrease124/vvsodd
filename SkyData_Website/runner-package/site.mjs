// The SkyData website this runner pairs with and polls. Runner 2.5.0 moved from ChatGPT Sites
// (https://skydata-ai.skyrease123.chatgpt.site) to Netlify. SKYDATA_SITE_URL overrides it, for example to test
// against a local copy; only HTTPS sites (or http://localhost for local tests) are accepted.
export const DEFAULT_SITE='https://845-nbny-v36.netlify.app';
export function siteUrl(value=process.env.SKYDATA_SITE_URL){
 if(!value)return DEFAULT_SITE;
 let url;try{url=new URL(value);}catch{throw Error('SKYDATA_SITE_URL is not a valid address: '+String(value).slice(0,120));}
 const local=url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
 if(url.protocol!=='https:'&&!local||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('SKYDATA_SITE_URL must be a plain https:// site address.');
 return url.origin;
}
export const SITE=siteUrl();
