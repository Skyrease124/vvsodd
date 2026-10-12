export type ParticleTarget = { x:number; y:number; z:number; feature:boolean };
export const REVEAL_DURATION = 5200;
export function revealAmount(elapsed:number, reduced=false){
 if(elapsed<0||elapsed>=REVEAL_DURATION)return 0;
 if(reduced)return 1;
 const ease=(v:number)=>v*v*(3-2*v);
 return elapsed<1400?ease(elapsed/1400):elapsed<3300?1:1-ease((elapsed-3300)/1900);
}
export function registerTap(count:number,last:number,now:number){
 const next=now-last<=400?count+1:1;
 return {count:next>=3?0:next,last:now,trigger:next>=3};
}
export function faceTarget(i:number):ParticleTarget {
 // A translucent mask, with a tapered jaw and sparse facial contours.
 if(i<160){const z=1-2*(i+.5)/160,r=Math.sqrt(1-z*z),a=i*2.39996,y=z*.94,jaw=1-.25*Math.max(0,z);return {x:r*Math.cos(a)*.65*jaw,y,z:r*Math.sin(a)*.22,feature:false};}
 if(i<260){const a=(i-160)/100*Math.PI*2,y=Math.sin(a)*.94;return {x:Math.cos(a)*.65*(1-.25*Math.max(0,y)),y,z:.28,feature:true};}
 if(i<324){const j=i-260,side=j<32?-1:1,a=(j%32)/32*Math.PI*2;return {x:side*.27+Math.cos(a)*.15,y:-.18+Math.sin(a)*.065,z:.42,feature:true};}
 if(i<356){const j=i-324,side=j<16?-1:1,t=(j%16)/15;return {x:side*.27+(t-.5)*.34,y:-.34-.035*Math.sin(t*Math.PI),z:.38,feature:true};}
 if(i<388){const j=i-356,t=(j%16)/15;return j<16?{x:.025*Math.sin(t*Math.PI),y:-.12+t*.42,z:.4+.2*t,feature:true}:{x:(t-.5)*.19,y:.3+.035*Math.sin(t*Math.PI),z:.5,feature:true};}
 const t=(i-388)/31;return {x:(t-.5)*.42,y:.51+.045*Math.sin(t*Math.PI),z:.4,feature:true};
}
