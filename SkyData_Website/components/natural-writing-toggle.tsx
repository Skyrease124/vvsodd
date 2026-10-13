'use client';
export function NaturalWritingToggle({enabled,onChange,disabled=false}:{enabled:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){
 return <label style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',padding:'8px 0',fontSize:14}} title="Clearer, more natural text. Facts, citations and code take priority. Saved on this browser."><input type="checkbox" checked={enabled} disabled={disabled} onChange={e=>onChange(e.target.checked)}/>Natural writing<span style={{fontSize:12,opacity:.7}}>Text replies</span></label>;
}
