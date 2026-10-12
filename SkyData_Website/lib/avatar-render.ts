// Local portrait deformation driven by playback amplitude; not phoneme lip sync.
export const AVATAR_DURATION=3.2;
export function assemblyProgress(seconds:number,index:number,reduced=false){
 if(reduced)return 1;
 const delay=((index*17)%41)/41*.8;
 const p=Math.max(0,Math.min(1,(seconds-delay)/2.4));return p*p*(3-2*p);
}
type Point={x:number;y:number};
export function lipDisplacement(x:number,y:number,level:number){
 if(level<=0)return 0;
 const nx=(x-.5)/.105,ny=(y-.579)/.075;
 const r=nx*nx+ny*ny;if(r>=1)return 0;
 const envelope=(1-r)**3;
 return Math.min(1,Math.max(0,level))*.026*Math.tanh((y-.579)/.007)*envelope;
}
function warpPatch(ctx:CanvasRenderingContext2D,img:HTMLImageElement,size:number,box:number[],deform:(x:number,y:number)=>number){
 const [left,top,width,height]=box,cols=12,rows=8;
 function triangle(a:Point,b:Point,c:Point){
  const source=[a,b,c].map(p=>({x:p.x*size,y:p.y*size}));
  const dest=[a,b,c].map(p=>({x:p.x*size,y:(p.y+deform(p.x,p.y))*size}));
  const [s0,s1,s2]=source,[d0,d1,d2]=dest;
  const ax=s1.x-s0.x,ay=s1.y-s0.y,bx=s2.x-s0.x,by=s2.y-s0.y,det=ax*by-ay*bx;
  const ux=d1.x-d0.x,uy=d1.y-d0.y,vx=d2.x-d0.x,vy=d2.y-d0.y;
  const m11=(ux*by-vx*ay)/det,m21=(vx*ax-ux*bx)/det;
  const m12=(uy*by-vy*ay)/det,m22=(vy*ax-uy*bx)/det;
  ctx.save();ctx.beginPath();ctx.moveTo(d0.x,d0.y);ctx.lineTo(d1.x,d1.y);ctx.lineTo(d2.x,d2.y);ctx.closePath();ctx.clip();
  ctx.transform(m11,m12,m21,m22,d0.x-m11*s0.x-m21*s0.y,d0.y-m12*s0.x-m22*s0.y);
  ctx.drawImage(img,0,0,size,size);ctx.restore();
 }
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const x=left+width*col/cols,y=top+height*row/rows,dx=width/cols,dy=height/rows;
  const a={x,y},b={x:x+dx,y},c={x,y:y+dy},d={x:x+dx,y:y+dy};triangle(a,b,c);triangle(b,d,c);
 }
}
export function drawPortrait(ctx:CanvasRenderingContext2D,img:HTMLImageElement,size:number,time:number,level:number,reduced:boolean){
 const iw=img.naturalWidth,ih=img.naturalHeight;
 const speech=Math.min(1,Math.max(0,level));
 // Always retain a complete base face. Only a bounded lip patch moves.
 ctx.drawImage(img,0,0,size,size);
 if(speech>.015){
  warpPatch(ctx,img,size,[.395,.504,.21,.15],(x,y)=>lipDisplacement(x,y,speech));
  // Mouth interior is bounded strictly between the lips, never across the face.
  ctx.save();ctx.fillStyle='#202126';ctx.beginPath();ctx.ellipse(size*.5,size*.579,size*(.063-.008*speech),size*.011*speech,0,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 if(!reduced&&speech>.015){
  const emphasis=speech*(.6+.4*Math.sin(time*.004));
  warpPatch(ctx,img,size,[.305,.278,.39,.07],(x,y)=>{
   const ey=(y-.313)/.035;const ex=Math.min(Math.abs(x-.398),Math.abs(x-.606))/.093;
   const r=ex*ex+ey*ey;return r<1?-.0035*emphasis*(1-r)**3:0;
  });
 }
 if(reduced)return;
 const blinkPhase=time%5700;const blink=blinkPhase>5480?Math.max(.04,Math.abs(blinkPhase-5590)/110):1;
 for(const x of [.398,.606]){
  const y=.366,w=.047,h=.018;
  ctx.save();ctx.beginPath();ctx.ellipse(x*size,y*size,w*size,h*size,0,0,Math.PI*2);ctx.clip();
  ctx.drawImage(img,(x-w)*iw,(y-h)*ih,2*w*iw,2*h*ih,(x-w)*size+Math.sin(time*.0004)*size*.0015,(y-h)*size,2*w*size,2*h*size);
  if(blink<.99){const gradient=ctx.createLinearGradient(0,(y-h)*size,0,(y+h)*size);gradient.addColorStop(0,'#a0a9b0');gradient.addColorStop(.5,'#d5d9dc');gradient.addColorStop(1,'#8f979f');ctx.fillStyle=gradient;const cover=h*size*(1-blink);ctx.fillRect((x-w)*size,(y-h)*size,2*w*size,cover);ctx.fillRect((x-w)*size,y*size+h*size-cover,2*w*size,cover);}
  ctx.restore();
 }
}
