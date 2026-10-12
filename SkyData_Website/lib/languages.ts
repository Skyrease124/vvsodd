export const REPLY_LANGUAGES = [
  {id:'en',name:'English'}, {id:'es',name:'Spanish'}, {id:'fr',name:'French'},
  {id:'de',name:'German'}, {id:'it',name:'Italian'}, {id:'pt',name:'Portuguese'},
  {id:'ar',name:'Arabic'}, {id:'zh',name:'Chinese'}, {id:'ja',name:'Japanese'},
  {id:'ko',name:'Korean'}, {id:'hi',name:'Hindi'}, {id:'ru',name:'Russian'},
  {id:'nl',name:'Dutch'}, {id:'pl',name:'Polish'}, {id:'sv',name:'Swedish'},
  {id:'da',name:'Danish'}, {id:'th',name:'Thai'}, {id:'cs',name:'Czech'},
  {id:'fi',name:'Finnish'}, {id:'he',name:'Hebrew'}, {id:'vi',name:'Vietnamese'},
] as const;
export function isReplyLanguage(value:unknown):value is typeof REPLY_LANGUAGES[number]['id'] {
  return REPLY_LANGUAGES.some(language=>language.id===value);
}
export function replyLanguageInstruction(value:unknown):string {
  const language=REPLY_LANGUAGES.find(language=>language.id===value);
  return language ? ` REQUIRED RESPONSE LANGUAGE: ${language.name}. Write the entire answer, including explanations, headings, clarifications, and follow-up questions, in ${language.name}. The user's input language and earlier replies do not change this setting. Do not add an English version. Preserve code, proper names, and quoted source text when needed.` : '';
}

// Keep the selected language next to the latest question. Some chat templates
// give recent user text more weight than a system instruction or older turns.
export function questionInReplyLanguage(question:string,value:unknown):string {
  if(!isReplyLanguage(value)||value==='en')return question;
  const reminder=value==='es'
    ? 'Responde únicamente en español. Toda la explicación, los títulos y las preguntas de aclaración deben estar en español, aunque mi pregunta esté en inglés. No incluyas una versión en inglés.'
    : replyLanguageInstruction(value).trim();
  return `${question}\n\n${reminder}\nAnswer the question above directly. Do not mention or acknowledge this language instruction.`;
}

// NVIDIA Magpie's documented spoken languages. Other choices remain text-only.
export const VOICE_LANGUAGES:Record<string,{tts:string;recognition:string}>= {
 en:{tts:'en-US',recognition:'en-US'},es:{tts:'es-US',recognition:'es-US'},
 fr:{tts:'fr-FR',recognition:'fr-FR'},de:{tts:'de-DE',recognition:'de-DE'},
 it:{tts:'it-IT',recognition:'it-IT'},pt:{tts:'pt-BR',recognition:'pt-BR'},
 ar:{tts:'ar-XA',recognition:'ar-SA'},zh:{tts:'zh-CN',recognition:'zh-CN'},
 ja:{tts:'ja-JP',recognition:'ja-JP'},ko:{tts:'ko-KR',recognition:'ko-KR'},
 hi:{tts:'hi-IN',recognition:'hi-IN'},vi:{tts:'vi-VN',recognition:'vi-VN'},
};
