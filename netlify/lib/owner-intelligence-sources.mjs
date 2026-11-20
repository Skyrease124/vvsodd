// Strict, static source registry. No user-supplied URLs are fetched.
export const SOURCE_REGISTRY=Object.freeze([
 {id:'wakulla-tax',label:'Wakulla Tax Collector',county:'Wakulla',category:'Tax certificates / county notices',url:'https://wakullatax.com/'},
 {id:'palm-beach-tax',label:'Palm Beach Tax Collector',county:'Palm Beach',category:'Certificates / tax sales',url:'https://www.pbctax.gov/'},
 {id:'st-johns-tax',label:'St. Johns Tax Collector',county:'St. Johns',category:'Tax certificates / county notices',url:'https://sjctax.us/'}
]);
export const sourceById=id=>SOURCE_REGISTRY.find(s=>s.id===id)||null;
export const researchKey=id=>'owner-research-source-v1-'+id;
export function safeScrapeExcerpt(value){
 const plain=String(value||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
   .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
   .replace(/<[^>]+>/g,' ').replace(/[ \t\r\n]+/g,' ').trim();
 return plain.slice(0,14000);
}
export function compareSource(previous,next){
 if(!next||!next.hash||!next.excerpt)throw Error('Empty response cannot be compared');
 const changed=!!previous?.hash&&previous.hash!==next.hash;
 return {changed,firstScan:!previous?.hash,status:changed?'needs-review':previous?.hash?'unchanged':'baseline',
   // A change is a research signal; it is never tax-sale or redemption proof.
   reviewRequired:changed,publicationAuthorized:false,availableForPurchase:false};
}
export function validateMark(value){
 if(!['needs-review','inspected','dismissed'].includes(value))throw Error('Unknown private triage mark');
 return value;
}
