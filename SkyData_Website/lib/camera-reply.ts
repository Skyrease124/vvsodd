// Remove exact provider repetition in prose camera answers, without rewriting facts.
// Code and Markdown lists are deliberately excluded.
export function cleanCameraReply(text:string):string{
 if(/```|^\s*(?:[-*]|\d+\.)\s/m.test(text))return text;
 const paragraphs=text.trim().split(/\n\s*\n/);const kept:string[]=[];
 const normalized=(value:string)=>value.replace(/\s+/g,' ').trim();
 for(const paragraph of paragraphs){if(normalized(paragraph)!==normalized(kept.at(-1)||''))kept.push(paragraph);}
 let result=kept.join('\n\n');
 // A repeated complete answer may contain several paragraphs.
 for(let n=1;n<=3;n++){
  const words=result.split(/\s+/);if(words.length<12||words.length%2)break;
  const half=words.length/2;if(words.slice(0,half).join(' ')!==words.slice(half).join(' '))break;
  const pattern=words.slice(0,half).map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
  result=result.match(new RegExp('^'+pattern))?.[0]||result;
 }
 return result.trim();
}
