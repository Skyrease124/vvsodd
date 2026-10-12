// Safari can report overlapping or repeated recognition segments.
// Preserve repetition inside a segment; reconcile overlap only at result boundaries.
export function joinRecognitionResults(results:ArrayLike<{[index:number]:{transcript:string}}>):string{
 let words:string[]=[];
 const same=(a:string,b:string)=>a.toLowerCase().replace(/[.,!?]+$/,'')===b.toLowerCase().replace(/[.,!?]+$/,'');
 for(const result of Array.from(results)){
  const next=(result[0]?.transcript||'').trim().split(/\s+/).filter(Boolean);if(!next.length)continue;
  let overlap=0;for(let n=Math.min(words.length,next.length);n>=2;n--){if(words.slice(-n).every((word,i)=>same(word,next[i]))){overlap=n;break;}}
  words.push(...next.slice(overlap));
 }
 return words.join(' ');
}
