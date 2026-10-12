export type ChatResult={error?:string;retryable?:boolean;content:string;model?:string;sources?:{title:string;url:string}[]};
export async function readChatResponse(response:Response,onPartial:(content:string)=>void):Promise<ChatResult>{
 if(!response.ok||!response.headers.get('content-type')?.includes('application/x-ndjson'))return response.json();
 const reader=response.body?.getReader();if(!reader)throw Error('The reply could not be read.');
 const decoder=new TextDecoder();let buffer='',result:ChatResult|undefined;
 const consume=(line:string)=>{if(!line.trim())return;const event=JSON.parse(line);if(event.error)throw Object.assign(new Error(event.error),{retryable:event.retryable===true});if(typeof event.content==='string')onPartial(event.content);if(event.done)result=event;};
 try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let end;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+1);}if(done)break;}if(buffer.trim())consume(buffer);if(!result)throw Error('The reply was interrupted. Please try again.');return result;}
 finally{await reader.cancel().catch(()=>{});}
}
