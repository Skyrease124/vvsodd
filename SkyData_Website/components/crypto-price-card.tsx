const footer='\n\nData provided by [CoinGecko](https://www.coingecko.com). Quotes may be cached for 60 seconds.';
export function parsePriceCards(content:string,sources?:{url:string}[]){
 if(!sources?.some(s=>s.url==='https://www.coingecko.com')||!content.endsWith(footer))return null;
 // Match only the verified quote format; other replies retain normal Markdown.
 const quotes=content.slice(0,-footer.length).split('\n\n').map(row=>{
  const match=row.match(/^\*\*([^\n*]+): (\$[\d,.]+) USD\*\*(?: · 24h: ([+-]?[\d.]+)%)?\nUpdated: (\d{4}-\d{2}-\d{2}T[\d:.]+Z)(\nThis quote is more than five minutes old\.)?$/);
  if(!match||!Number.isFinite(Date.parse(match[4])))return null;
  return {name:match[1],price:match[2],change:match[3],updated:match[4],stale:Boolean(match[5])};
 });
 return quotes.length&&quotes.every(q=>q!==null)?quotes:null;
}
export function CryptoPriceCard({content,sources}:{content:string;sources?:{url:string}[]}){
 const quotes=parsePriceCards(content,sources);if(!quotes)return null;
 return <div className="crypto-quotes"><div className="quote-grid">{quotes.map(q=><section className="crypto-quote" key={q.name} aria-label={q.name+' price'}><div className="quote-top"><strong>{q.name}</strong><span>USD</span></div><div className="quote-value">{q.price}</div>{q.change&&<div className={'quote-change '+(Number(q.change)<0?'down':'up')}>{q.change}% <span>past 24h</span></div>}<time dateTime={q.updated} title={q.updated}>Updated {new Date(q.updated).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC'})} UTC</time>{q.stale&&<p className="quote-stale">Quote is more than 5 minutes old.</p>}</section>)}</div><p className="quote-attribution">Data by <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer">CoinGecko</a> · Cached up to 60s</p></div>;
}
