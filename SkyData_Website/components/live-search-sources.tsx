import type {LiveGrounding} from '../lib/live-grounding';
export function LiveSearchSources({grounding}:{grounding:LiveGrounding|null}){
 if(!grounding||(!grounding.sources.length&&!grounding.suggestions))return null;
 return <details className="live-search-sources"><summary>Google Search sources</summary><div className="source-links">{grounding.sources.map(s=><a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>)}</div>{grounding.suggestions&&<iframe title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={'<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src https: data:; base-uri &#39;none&#39;; form-action &#39;none&#39;">'+grounding.suggestions} style={{width:'100%',height:160,border:0}}/>}</details>;
}
