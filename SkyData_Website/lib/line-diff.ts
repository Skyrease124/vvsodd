// Line-based Myers diff for reviewing proposed replacements. Pure and dependency-free.
export type DiffLine={type:'same'|'add'|'del';text:string;a?:number;b?:number};
export type DiffResult={lines:DiffLine[];added:number;removed:number;exact:boolean;newlineAtEndChanged:boolean};
const MAX_EDIT=3000; // band storage is O(D^2); beyond this the diff is shown as a full replacement, labelled not exact
export function splitLines(text:string){if(!text)return [];const lines=text.split('\n');if(lines.at(-1)==='')lines.pop();return lines;}
export function diffLines(original:string,proposed:string):DiffResult{
 const a=splitLines(original),b=splitLines(proposed);let start=0;while(start<a.length&&start<b.length&&a[start]===b[start])start++;
 let endA=a.length,endB=b.length;while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){endA--;endB--;}
 const x=a.slice(start,endA),y=b.slice(start,endB),n=x.length,m=y.length,max=n+m,offset=max+1,trace:Int32Array[]=[],v=new Int32Array(2*max+3);let found=-1;
 const middle:DiffLine[]=[];let exact=true;
 if(n===0||m===0)found=0;
 else for(let d=0;d<=Math.min(max,MAX_EDIT);d++){
  trace.push(v.slice(offset-d-1,offset+d+2));
  for(let k=-d;k<=d;k+=2){let i=k===-d||k!==d&&v[offset+k-1]<v[offset+k+1]?v[offset+k+1]:v[offset+k-1]+1,j=i-k;while(i<n&&j<m&&x[i]===y[j]){i++;j++;}v[offset+k]=i;if(i>=n&&j>=m){found=d;break;}}
  if(found>=0)break;
 }
 if(n===0||m===0){for(let i=0;i<n;i++)middle.push({type:'del',text:x[i],a:start+i+1});for(let j=0;j<m;j++)middle.push({type:'add',text:y[j],b:start+j+1});}
 else if(found<0){exact=false;for(let i=0;i<n;i++)middle.push({type:'del',text:x[i],a:start+i+1});for(let j=0;j<m;j++)middle.push({type:'add',text:y[j],b:start+j+1});}
 else{
  let i=n,j=m;const rev:DiffLine[]=[];
  for(let d=found;d>0;d--){const band=trace[d],at=(q:number)=>band[q+d+1],k=i-j;const prevK=k===-d||k!==d&&at(k-1)<at(k+1)?k+1:k-1,pi=at(prevK),pj=pi-prevK;
   while(i>pi&&j>pj){rev.push({type:'same',text:x[i-1],a:start+i,b:start+j});i--;j--;}
   if(i===pi)rev.push({type:'add',text:y[j-1],b:start+j});else rev.push({type:'del',text:x[i-1],a:start+i});i=pi;j=pj;}
  while(i>0&&j>0){rev.push({type:'same',text:x[i-1],a:start+i,b:start+j});i--;j--;}
  middle.push(...rev.reverse());
 }
 const lines:DiffLine[]=[...a.slice(0,start).map((text,i)=>({type:'same' as const,text,a:i+1,b:i+1})),...middle,...a.slice(endA).map((text,i)=>({type:'same' as const,text,a:endA+i+1,b:endB+i+1}))];
 return {lines,added:lines.filter(l=>l.type==='add').length,removed:lines.filter(l=>l.type==='del').length,exact,newlineAtEndChanged:original.endsWith('\n')!==proposed.endsWith('\n')};
}
// Collapses unchanged runs to context around each change for display.
export function hunks(lines:DiffLine[],context=3){
 const keep=new Uint8Array(lines.length);lines.forEach((l,i)=>{if(l.type!=='same')for(let j=Math.max(0,i-context);j<=Math.min(lines.length-1,i+context);j++)keep[j]=1;});
 const out:({kind:'line';line:DiffLine}|{kind:'skip';count:number})[]=[];let skip=0;
 lines.forEach((line,i)=>{if(keep[i]){if(skip)out.push({kind:'skip',count:skip});skip=0;out.push({kind:'line',line});}else skip++;});if(skip)out.push({kind:'skip',count:skip});return out;
}
export function applyDiff(lines:DiffLine[]){return lines.filter(l=>l.type!=='del').map(l=>l.text);}
