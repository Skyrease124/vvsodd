import { cleanResponse } from './clean-response';
export function streamReply(response:Response,model:string,sources:{title:string;url:string}[],signal:AbortSignal,finalize?:(text:string)=>{content:string;sources:{title:string;url:string}[]}|Promise<{content:string;sources:{title:string;url:string}[]}>){
 const reader=response.body?.getReader();
 if(!reader)return Response.json({error:'The model returned no reply.'},{status:502});
 const encoder=new TextEncoder();let stopped=false;
 const body=new ReadableStream<Uint8Array>({
  async start(controller){
   const emit=(event:object)=>{if(!stopped)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'));};
   const decoder=new TextDecoder();let buffer='',answer='',complete=false;
   const consume=(line:string)=>{
    if(!line.startsWith('data:'))return;
    const data=line.slice(5).trim();if(!data)return;
    if(data==='[DONE]'){complete=true;return;}
    const event=JSON.parse(data);if(event.error)throw Error('The model could not finish the reply. Please try again.');
    const choice=event.choices?.[0];if(choice?.finish_reason)complete=true;
    // Provider reasoning_content is intentionally excluded from the conversation.
    if(typeof choice?.delta?.content==='string'){answer+=choice.delta.content;const text=cleanResponse(answer).replace(/<[^>]*$/,'');if(text&&!finalize)emit({content:text});}
   };
   try{
    emit({status:'reply_started'});
    while(!stopped&&!signal.aborted){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let end;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end).replace(/\r$/,''));buffer=buffer.slice(end+1);}if(done)break;}
    if(stopped||signal.aborted)return;
    if(buffer.trim())consume(buffer.replace(/\r$/,''));
    const content=cleanResponse(answer);if(!complete||!content)throw Error(content?'The reply was interrupted. Please try again.':'The model returned no answer. Please try again.');
    emit({done:true,model,...(finalize?await finalize(content):{content,sources})});
   }catch(error){if(!stopped&&!signal.aborted)emit({error:error instanceof Error?error.message:'The reply was interrupted.',retryable:true});}
   finally{await reader.cancel().catch(()=>{});if(!stopped){stopped=true;controller.close();}}
  },
  async cancel(){stopped=true;await reader.cancel().catch(()=>{});}
 });
 return new Response(body,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
