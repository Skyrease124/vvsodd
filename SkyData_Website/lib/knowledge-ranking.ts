import {terms} from './knowledge-core';
export type RankedPassage={id:string;document:string;page:number|null;content:string;section:string;semantic?:number};
export const RETRIEVAL_POLICY={semanticContext:.72,semanticWithoutTerms:.86,maxPassages:6,contextCharacters:10000,rrfConstant:60,maxSupportingContext:2};
const noise=new Set('explain using uploaded textbook textbooks documents document cite exact supporting pages compare provide separate source citations example examples code cpp cplusplus beginner introductory only based according tell know'.split(' '));
const concepts=[
 {name:'pointer',pattern:/\bpointer(?:s)?\b/i,aliases:['pointer','pointers','memory address','memory addresses','address and type','address operator','stores an address']},
 {name:'namespace',pattern:/\bnamespace(?:s)?\b|\bnamed scopes?\b/i,aliases:['namespace','namespaces','named scope','named scopes']},
 {name:'dereference',pattern:/\bdereferenc\w*|\bindirection\b/i,aliases:['dereference','dereferencing','dereferenced','indirection operator','indirection','dereference operator']},
 {name:'abstract',pattern:/\babstract\s+class(?:es)?\b|\bpure\s+virtual\b/i,aliases:['abstract class','abstract classes','pure virtual']},
 {name:'allocation',pattern:/\bdynamic\s+(?:memory|allocation)|\b(?:new|delete)\s+operator/i,aliases:['dynamic memory','dynamic allocation','new operator','delete operator','allocated dynamically']}
];
const normalized=(s:string)=>s.replace(/(\p{L})-\s*\n\s*(\p{L})/gu,'$1$2').toLowerCase().replace(/[^\p{L}\p{N}_+]+/gu,' ').trim();
const matches=(text:string,term:string)=>(' '+text+' ').includes(' '+normalized(term)+' ');
export function queryProfile(query:string){
 const selected=concepts.filter(c=>c.pattern.test(query));
 const requested=terms(query,32).filter(w=>!noise.has(w)&&!selected.some(c=>c.aliases.some(a=>a.includes(w)))).slice(0,10);
 const advanced=selected.some(c=>['abstract','allocation'].includes(c.name))||/\b(?:return(?:ing)?|static|character|char)\b/i.test(query);
 const introductory=!advanced&&selected.some(c=>c.name==='pointer')&&!selected.some(c=>c.name==='dereference');
 const keywords=[...new Set([...terms(query,32).filter(w=>!noise.has(w)),...selected.flatMap(c=>c.aliases.flatMap(a=>terms(a,8)))])].slice(0,32);
 return {selected,requested,advanced,introductory,keywords};
}
export function rankKnowledge<T extends RankedPassage>(rows:T[],query:string,hasVector:boolean,policy=RETRIEVAL_POLICY){
 const profile=queryProfile(query);
 const assessed=rows.map(r=>{
  const text=normalized(r.content),matched=profile.selected.filter(c=>c.aliases.some(a=>matches(text,a))).map(c=>c.name);
  const exact=profile.requested.filter(w=>matches(text,w)).length;
  const lexical=(matched.length*3+exact)/(profile.selected.length*3+profile.requested.length||1);
  const contents=/\bCONTENTS\b/.test(r.content)&&/\b(?:Chapter|Solutions|Exercises)\b/.test(r.content);
  const definition=/\b(?:is an? |represents? |refers? to |defined? as |stores? |address operator|indirection operator|defining pointers|defining namespaces|namespaces? (?:are|is|allow)|namespace\s+\w+\s*\{)/i.test(r.content);
  const focus=profile.introductory&&/\ba pointer is (?:an? |the )|\bpointers? (?:represent|store|hold)\b/i.test(r.content)?2:profile.selected.some(c=>c.name==='namespace')&&/avoid naming conflicts|\bnamespace is\b/i.test(r.content)?1:0;
  const allConcepts=matched.length===profile.selected.length;
  const distant=/\b(?:abstract class(?:es)?|static data members?|character pointers?|returning (?:character|pointers)|virtual functions?)\b/i.test(r.content);
  const relevant=matched.length>0||exact>0||hasVector&&(r.semantic||0)>=policy.semanticWithoutTerms;
  const direct=!contents&&relevant&&(profile.selected.length?(profile.advanced?allConcepts:profile.introductory?matched.includes('pointer')&&definition&&!distant:true):exact>0);
  const relevance: 'direct'|'context'|'unrelated'=contents||!relevant?'unrelated':direct?'direct':'context';
  return {...r,lexical,relevance,matchedConcepts:matched,definition,focus};
 });
 const semanticOrder=[...assessed].sort((a,b)=>(b.semantic||0)-(a.semantic||0));
 const lexicalOrder=[...assessed].sort((a,b)=>b.lexical-a.lexical||Number(b.definition)-Number(a.definition));
 const semRank=new Map(semanticOrder.map((r,i)=>[r.id,i+1])),lexRank=new Map(lexicalOrder.map((r,i)=>[r.id,i+1]));
 const ranked=assessed.map(r=>({...r,score:(r.lexical>0?1/(policy.rrfConstant+lexRank.get(r.id)!):0)+(hasVector?1/(policy.rrfConstant+semRank.get(r.id)!):0)+(r.relevance==='direct'?.035:0)+(profile.introductory&&r.definition?.01:0)+r.focus*.025}))
  .filter(r=>r.relevance!=='unrelated'&&(r.lexical>0||hasVector&&(r.semantic||0)>=policy.semanticContext)).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const selected:typeof ranked=[];let budget=policy.contextCharacters,context=0;
 const add=(r:typeof ranked[number])=>{
  if(selected.length>=policy.maxPassages||r.content.length>budget||selected.some(h=>h.document===r.document&&normalized(h.content)===normalized(r.content)))return;
  if(r.relevance==='context'&&context>=policy.maxSupportingContext)return;
  selected.push(r);budget-=r.content.length;if(r.relevance==='context')context++;
 };
 // Reserve direct evidence for every concept in comparisons instead of six passages on one topic.
 for(const concept of profile.selected){const r=ranked.find(r=>r.relevance==='direct'&&r.matchedConcepts.includes(concept.name));if(r)add(r);}
 for(const r of ranked)add(r);
 return {selected,ranked,profile};
}
export function documentOnlyQuestion(query:string){return /(?:only|solely|exclusively)\s+(?:from\s+|using\s+|on\s+)?(?:my\s+|the\s+)?(?:uploaded|documents?|textbooks?|books?)|(?:uploaded|documents?|textbooks?|books?)[\s\S]{0,50}\bonly\b/i.test(query);}
