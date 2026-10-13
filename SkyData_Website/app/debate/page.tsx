'use client';
import {useNaturalWriting} from '../../hooks/use-natural-writing';
import {NaturalWritingToggle} from '../../components/natural-writing-toggle';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { DebateScore } from '../../lib/debate-score';
import { isPaidModel, MODELS } from '../../lib/models';
import { readChatResponse } from '../../lib/read-chat-response';
import { createReplyReveal } from '../../lib/reply-reveal';
import { createLiveDebateSpeech } from '../../lib/live-debate-speech';
import { DebateAudio } from '../../components/debate-audio';
import { ChatMarkdown } from '../../components/chat-markdown';
type Check={round:number;content:string;sources?:{title:string;url:string}[];error?:string;checkedAt?:string};
type Turn={side:number;content:string};
const availableModels=MODELS.filter(m=>m.available);
export default function Debate(){const [naturalWriting,setNaturalWriting]=useNaturalWriting();
 const [topic,setTopic]=useState(''),[models,setModels]=useState<string[]>([availableModels[0].id,availableModels[1].id]),[turns,setTurns]=useState<Turn[]>([]),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const [score,setScore]=useState<DebateScore|null>(null),[scoring,setScoring]=useState(false),[scoreError,setScoreError]=useState(''),[lunaReady,setLunaReady]=useState(false),[isOwner,setIsOwner]=useState(false);
 const available=availableModels.filter(m=>isOwner||!isPaidModel(m.id));
 const scoringRequest=useRef<AbortController|null>(null);
 function resetScore(){scoringRequest.current?.abort();scoringRequest.current=null;setScoring(false);setScore(null);setScoreError('');}
 useEffect(()=>{let alive=true;void fetch('/api/status').then(r=>r.json() as Promise<{debateScoringConfigured?:boolean;isOwner?:boolean}>).then(d=>{if(alive){setLunaReady(d.debateScoringConfigured===true);setIsOwner(d.isOwner===true);}}).catch(()=>{});return()=>{alive=false;scoringRequest.current?.abort();};},[]);
 async function scoreDebate(){
  if(busy||scoring||turns.length<2)return;
  const controller=new AbortController();scoringRequest.current=controller;setScoring(true);setScoreError('');
  try{const response=await fetch('/api/debate-score',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic,models,turns}),signal:controller.signal});
   const result=await response.json() as DebateScore & {error?:string;setup_required?:boolean};
   if(controller.signal.aborted)return;
   if(!response.ok){if(result.setup_required)setLunaReady(false);throw Error(result.error||'Luna scoring is unavailable.');}
   setScore(result);
  }catch(e){if(!controller.signal.aborted)setScoreError(e instanceof Error?e.message:'Could not score this debate.');}
  finally{if(scoringRequest.current===controller){setScoring(false);scoringRequest.current=null;}}
 }
 const [factCheck,setFactCheck]=useState(true),[webReady,setWebReady]=useState<boolean|null>(null),[checks,setChecks]=useState<Check[]>([]);
 useEffect(()=>{let alive=true;void fetch('/api/status').then(r=>r.json() as Promise<{webConfigured?:boolean}>).then(data=>{if(alive){setWebReady(data.webConfigured===true);if(!data.webConfigured)setFactCheck(false);}}).catch(()=>{if(alive){setWebReady(false);setFactCheck(false);}});return()=>{alive=false;};},[]);
 const [voices,setVoices]=useState(['Aria','Jason']),[voiceReady,setVoiceReady]=useState(false),[audioTurn,setAudioTurn]=useState<number|null>(null);
 useEffect(()=>{let alive=true;void fetch('/api/status').then(r=>r.json() as Promise<{voiceConfigured?:boolean}>).then(data=>{if(alive)setVoiceReady(data.voiceConfigured===true);}).catch(()=>{});return()=>{alive=false;};},[]);
 const [liveSpeech,setLiveSpeech]=useState(true),[speechStatus,setSpeechStatus]=useState(''),[paused,setPaused]=useState(false);
 const audioContext=useRef<AudioContext|null>(null),completedTurns=useRef<Turn[]>([]);
 function stopDebate(){changeFollow(false);active.current?.abort();setAudioTurn(null);setSpeechStatus('');setStatus('Debate stopped · your arguments are kept.');setPaused(true);}
 const active=useRef<AbortController|null>(null),scroller=useRef<HTMLDivElement>(null),frame=useRef<number|null>(null);
 const [followLatest,setFollowLatest]=useState(true);
 const follow=useRef(true);
 function changeFollow(value:boolean){follow.current=value;setFollowLatest(value);if(!value&&frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}}
 useEffect(()=>()=>{active.current?.abort();void audioContext.current?.close();},[]);
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
 useEffect(()=>{
  if(!followLatest||!turns.length||frame.current!==null)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let previous=0;
  const tick=(time:number)=>{
   const el=scroller.current;if(!el||!follow.current){frame.current=null;return;}
   const target=Math.max(0,el.scrollHeight-el.clientHeight),distance=target-el.scrollTop;
   if(Math.abs(distance)<1||reduced){el.scrollTop=target;frame.current=null;return;}
   const elapsed=previous?Math.min(64,time-previous):16;previous=time;
   el.scrollTop+=distance*(1-Math.exp(-elapsed/100));
   frame.current=requestAnimationFrame(tick);
  };
  frame.current=requestAnimationFrame(tick);
 },[turns,checks,followLatest]);
 async function start(e:React.FormEvent){
  e.preventDefault();if(busy||active.current)return;resetScore();
  const resume=paused&&completedTurns.current.length<6;
  const transcript:Turn[]=resume?[...completedTurns.current]:[];
  if(liveSpeech&&voiceReady){try{const Audio=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;audioContext.current??=new Audio();void audioContext.current.resume();}catch{setError('Live audio could not start. Turn off live voices to debate with text.');return;}}
  const controller=new AbortController();active.current=controller;setAudioTurn(null);setBusy(true);setPaused(false);setError('');if(!resume){resetScore();setTurns([]);setChecks([]);completedTurns.current=[];}
  try{for(let i=transcript.length;i<6;i++){
   controller.signal.throwIfAborted();const side=i%2,name=available.find(m=>m.id===models[side])!.label,stage=['Opening','Rebuttal','Closing'][Math.floor(i/2)];setStatus(`${stage} · ${name} is thinking…`);
   const paint=(content:string)=>{if(!controller.signal.aborted)setTurns([...transcript,{side,content}]);};
   const speech=liveSpeech&&voiceReady&&audioContext.current?createLiveDebateSpeech(audioContext.current,voices[side],controller.signal,value=>{if(!controller.signal.aborted)setSpeechStatus(name+' · '+value);}):null;
   const reveal=createReplyReveal(paint,controller.signal,matchMedia('(prefers-reduced-motion: reduce)').matches);
   try{const response=await fetch('/api/debate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic,models,naturalWriting,turns:transcript}),signal:controller.signal});
    const result=await readChatResponse(response,content=>{if(!controller.signal.aborted){setStatus(`${stage} · ${name}`);reveal.push(content);speech?.push(content);}});
    if(result.error||!result.content)throw Error(result.error||'The model returned no argument.');
    await Promise.all([reveal.finish(result.content),speech?.finish(result.content).catch(error=>{if(controller.signal.aborted)throw error;setSpeechStatus('Voice unavailable; continuing the debate in text.');})]);controller.signal.throwIfAborted();transcript.push({side,content:result.content});completedTurns.current=[...transcript];setTurns([...transcript]);setSpeechStatus('');
   }finally{reveal.dispose();speech?.stop();}
   if(factCheck&&i%2===1){
    const round=Math.floor(i/2);setStatus('Checking round '+(round+1)+' against live web sources…');
    const update=(patch:Partial<Check>)=>{if(!controller.signal.aborted)setChecks(old=>{const existing=old.find(c=>c.round===round);return [...old.filter(c=>c.round!==round),{round,content:'',...existing,...patch}].sort((a,b)=>a.round-b.round);});};
    update({content:''});const reveal=createReplyReveal(content=>update({content}),controller.signal,matchMedia('(prefers-reduced-motion: reduce)').matches);
    try{const response=await fetch('/api/debate-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic,arguments:transcript.slice(-2).map(t=>t.content)}),signal:controller.signal});
     const result=await readChatResponse(response,content=>reveal.push(content));if(result.error||!result.content)throw Error(result.error||'No fact-check was returned.');
     await reveal.finish(result.content);controller.signal.throwIfAborted();update({content:result.content,sources:result.sources,checkedAt:new Date().toISOString()});
    }catch(e){if(controller.signal.aborted)throw e;update({error:e instanceof Error?e.message:'Live fact-check unavailable.'});}finally{reveal.dispose();}
   }
  }setStatus('Debate complete · compare their arguments and decide for yourself.');
  }catch(e){setStatus(controller.signal.aborted?'Debate stopped · your arguments are kept.':'Debate paused · your arguments are kept.');setPaused(true);if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not complete this debate.');}
  finally{setBusy(false);setSpeechStatus('');active.current=null;}
 }
 return <main className="debate-page"><header><a className="brand" href="/">skydata<span>✦</span></a><a className="invite-inbox-link" href="/">Back to chat</a></header><section className="debate-workspace"><div className="debate-heading"><span className="eyebrow">TWO MODELS. TWO SIDES.</span><h1>Let them debate.</h1><p>Choose a pair and a topic. Three rounds: opening, rebuttal, and closing.</p></div><form className="debate-setup" onSubmit={start}><NaturalWritingToggle enabled={naturalWriting} onChange={setNaturalWriting} disabled={busy}/><div className="debate-pair">{[0,1].map(side=><label key={side}><span className={'debate-side side-'+side}>{side===0?'FOR':'AGAINST'}</span><select aria-label={side===0?'Model arguing for':'Model arguing against'} value={models[side]} disabled={busy} onChange={e=>{const next=[...models];next[side]=e.target.value;setModels(next);completedTurns.current=[];setPaused(false);setAudioTurn(null);resetScore();setTurns([]);setChecks([]);setStatus('');}}>{available.map(m=><option key={m.id} value={m.id} disabled={m.id===models[1-side]}>{m.label}</option>)}</select></label>)}</div><label htmlFor="debate-topic">What should they debate?</label><textarea id="debate-topic" value={topic} onChange={e=>{setTopic(e.target.value);completedTurns.current=[];setPaused(false);setAudioTurn(null);resetScore();setTurns([]);setChecks([]);setStatus('');}} disabled={busy} maxLength={500} required rows={3} placeholder="Example: Should AI be used in schools?"/>{!voiceReady&&<a className="debate-voice-connect" href="/connect-voice">Connect voice to hear the arguments</a>}<div className="debate-fact-option"><label><input type="checkbox" checked={liveSpeech} disabled={busy||!voiceReady} onChange={e=>setLiveSpeech(e.target.checked)}/>Live voices</label><span>Models speak in turn as their arguments arrive.</span></div><div className="debate-fact-option"><label><input type="checkbox" checked={factCheck} disabled={busy||webReady!==true} onChange={e=>setFactCheck(e.target.checked)}/>Live fact-check</label><span>Neutral review with source links after each round.</span>{webReady===false&&<a href="/connect-web">Connect web search to enable</a>}</div><div className="debate-controls"><span>AI arguments and fact-checks can contain mistakes.</span>{busy?<button type="button" onClick={stopDebate}>Stop debate</button>:<button type="submit" disabled={!topic.trim()||models[0]===models[1]}>{paused&&completedTurns.current.length<6?'Resume debate':turns.length?'Start again':'Start debate'}</button>}</div></form>{!busy&&turns.length>0&&<button className="debate-reset" type="button" onClick={()=>{resetScore();setTurns([]);setChecks([]);completedTurns.current=[];setPaused(false);setAudioTurn(null);setStatus('');setError('');}}>Clear debate</button>}<p className="debate-speech-status" role="status">{speechStatus}</p>{status&&<p className="debate-status" role="status">{status}</p>}{error&&<p className="error" role="alert">{error}</p>}{(busy||turns.length>0)&&<div className="debate-reading-controls"><label><input type="checkbox" checked={followLatest} onChange={e=>changeFollow(e.target.checked)}/>Follow latest</label><span>{followLatest?'New text stays in view':'Reading mode · scroll at your own pace'}</span>{!followLatest&&<button type="button" onClick={()=>changeFollow(true)}>Back to latest</button>}</div>}<div className="debate-transcript" ref={scroller} role="region" aria-label="Debate arguments" tabIndex={0} onWheel={e=>{if(e.deltaY<0)changeFollow(false);}} onTouchStart={()=>changeFollow(false)} onKeyDown={e=>{if(['ArrowUp','PageUp','Home'].includes(e.key))changeFollow(false);}}>{turns.map((turn,i)=><Fragment key={i}><article className={'debate-turn side-'+turn.side}><div className="debate-turn-label"><span>{available.find(m=>m.id===models[turn.side])?.label}</span><span>{['Opening','Rebuttal','Closing'][Math.floor(i/2)]} · {turn.side===0?'For':'Against'}</span></div><ChatMarkdown content={turn.content}/>{voiceReady&&!busy&&<div className="debate-audio-controls">{audioTurn===i?<><button type="button" onClick={()=>setAudioTurn(null)}>Stop audio</button><DebateAudio key={i} text={turn.content} voice={voices[turn.side]} onDone={()=>setAudioTurn(null)}/></>:<button type="button" onClick={()=>setAudioTurn(i)}>Listen</button>}</div>}</article>{i%2===1&&checks.filter(c=>c.round===Math.floor(i/2)).map(check=><aside className="debate-fact-card" key={check.round} aria-label={'Fact-check for round '+(check.round+1)}><div className="debate-turn-label"><strong>Live fact-check · Round {check.round+1}</strong>{check.checkedAt&&<span>{new Date(check.checkedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</span>}</div>{check.error?<p className="error" role="alert">Verification unavailable: {check.error}</p>:check.content?<ChatMarkdown content={check.content}/>:<p>Looking up evidence…</p>}{check.sources?.length?<div className="source-links" aria-label="Fact-check sources">{check.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>)}</div>:null}</aside>)}</Fragment>)}</div>{turns.length>=2&&<section hidden={!isOwner} className="debate-score-card" aria-label="Luna debate scorecard"><h2>Luna scorecard</h2><p>Compare clarity, reasoning, and evidence on a 0–4 scale. AI assessment of the arguments, not a factual verdict.</p>{!score&&<>{lunaReady?<button type="button" disabled={busy||scoring} onClick={scoreDebate}>{scoring?'Luna is scoring…':'Score with Luna'}</button>:<p>{isOwner?<a href="/connect-openrouter">Connect OpenRouter to enable scoring</a>:'Luna scoring is not connected yet.'}</p>}<p className="score-note">Optional paid request using your OpenRouter account. Score after stopping or finishing the debate.</p></>}{scoreError&&<p className="error" role="alert">{scoreError}</p>}{score&&<><p className="score-note">{score.partial?'Partial debate assessment':'Complete debate assessment'}</p><div className="score-table-wrap"><table><thead><tr><th scope="col">Quality</th>{models.map((model,i)=><th scope="col" key={model}>{available.find(m=>m.id===model)?.label}<small>{i===0?'For':'Against'}</small></th>)}</tr></thead><tbody>{(['clarity','reasoning','evidence'] as const).map(metric=><tr key={metric}><th scope="row">{metric[0].toUpperCase()+metric.slice(1)}</th>{score.scores.map((side,i)=><td key={i}>{side[metric].toFixed(1)}<small> / 4</small></td>)}</tr>)}</tbody></table></div>{score.cost!==undefined&&<p className="score-note">Reported scoring cost: ${score.cost.toFixed(6)}</p>}<p className="score-note">Evidence scores assess support presented. Use the live fact-check sources to review factual claims.</p></>}</section>}</section></main>;
}
