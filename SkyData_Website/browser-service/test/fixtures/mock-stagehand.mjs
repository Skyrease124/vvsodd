// MOCKED Stagehand page. MOCK_VIEWPORT: slow (390px RPC times out, Chrome applies it 1.5 s later), never (never applies), error (non-timeout failure),
// shot (the 1440px screenshot hits the extension's own TimeoutError, as on the HP with cinejoy.pk),
// relay (observe calls the worker's model callback, whose relay is unreachable here), observeerror (observe fails for another reason).
const state=globalThis.__viewportMock??={width:1280};const mode=process.env.MOCK_VIEWPORT;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class RPCResponseTimeoutError extends Error{constructor(method){super('RPC response timed out after 10000ms: '+method);this.name='RPCResponseTimeoutError';}}
const png=Buffer.from([137,80,78,71,13,10,26,10]);
const page={
 goto:async()=>({status:()=>200}),url:async()=>'https://example.com/',
 evaluate:async fn=>String(fn).includes('scrollWidth')?false:{title:'Example Domain',links:[],headings:[],metadata:[],players:[],performance:[],accessibility:{}},
 setViewportSize:async width=>{
  if(width===390&&mode==='error')throw Error('Target closed');
  if(width===390&&(mode==='slow'||mode==='never')){if(mode==='slow')setTimeout(()=>{state.width=390;},1500);await sleep(20);throw new RPCResponseTimeoutError('page.set_viewport_size');}
  state.width=width;
 },
 screenshot:async()=>{if(mode==='shot'&&state.width===1440&&!state.shotFailed){state.shotFailed=true;const e=Error('screenshot timed out after 20000ms');e.name='TimeoutError';throw e;}return png;},
};
export const localBrowser={launch:async()=>({context:{pages:async()=>[page]},close:async()=>{}})};
export const Stagehand={create:async options=>({observe:async()=>{process.stderr.write('OBSERVE_CALLED\n');if(mode==='relay')await options.model.generate({messages:[{role:'user',content:'x'}]});if(mode==='observeerror')throw Error('Stagehand snapshot failed');return {data:[]};},act:async()=>({}),close:async()=>{}})};
