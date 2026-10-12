'use client';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export const ChatMarkdown=memo(function ChatMarkdown({content}:{content:string}){
 return <div className="chat-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
  a:({children,href})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  table:({children})=><div className="chat-table-scroll" role="region" aria-label="Reply table" tabIndex={0}><table>{children}</table></div>,
  pre:({children})=><pre tabIndex={0}>{children}</pre>
 }}>{content}</ReactMarkdown></div>;
});
