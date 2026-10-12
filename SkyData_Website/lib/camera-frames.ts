// Rolling camera evidence is ephemeral: never written to chat history or storage.
export type CameraFrame={image:string;ageMs:number};
export const CAMERA_FRAME_LIMIT=4;
export function validCameraFrames(value:unknown):value is CameraFrame[]{
 return Array.isArray(value)&&value.length>0&&value.length<=CAMERA_FRAME_LIMIT&&value.every((frame,i)=>frame&&typeof frame.image==='string'&&frame.image.length<=400000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(frame.image)&&Number.isFinite(frame.ageMs)&&frame.ageMs>=0&&frame.ageMs<=4000&&(i===0||frame.ageMs<=value[i-1].ageMs));
}
export function recentCameraFrames(frames:{image:string;at:number}[],now:number):CameraFrame[]{
 return frames.filter(frame=>now-frame.at>=0&&now-frame.at<=3000).slice(-CAMERA_FRAME_LIMIT).map(frame=>({image:frame.image,ageMs:Math.round(now-frame.at)}));
}
