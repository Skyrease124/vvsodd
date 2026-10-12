// Bound the snapshot and allow only scene metadata, never arbitrary executable commands.
export type SceneObject={name:string;type:string;location:number[];rotation:number[];scale:number[];selected:boolean};
export type SceneSnapshot={name:string;totalObjects:number;selectedObjects:number;activeObject:string|null;frame:number;objects:SceneObject[];truncated:boolean};
const label=(value:unknown,max=128)=>{if(typeof value!=='string'||value.length>max||/[\x00-\x1f]/.test(value))throw Error('Invalid label');return value;};
const count=(value:unknown)=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw Error('Invalid count');return value;};
const vector=(value:unknown)=>{if(!Array.isArray(value)||value.length!==3||value.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e15))throw Error('Invalid vector');return value as number[];};
export function validateScene(value:unknown):SceneSnapshot{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid scene');const v=value as Record<string,unknown>;
 if(!Array.isArray(v.objects)||v.objects.length>100||typeof v.truncated!=='boolean'||typeof v.frame!=='number'||!Number.isSafeInteger(v.frame))throw Error('Invalid scene');
 const totalObjects=count(v.totalObjects),selectedObjects=count(v.selectedObjects);
 if(totalObjects<v.objects.length||selectedObjects>totalObjects||v.truncated!==(totalObjects>v.objects.length))throw Error('Invalid counts');
 return {name:label(v.name),totalObjects,selectedObjects,activeObject:v.activeObject===null?null:label(v.activeObject),frame:v.frame,truncated:v.truncated,
  objects:v.objects.map((item:unknown)=>{if(!item||typeof item!=='object')throw Error('Invalid object');const o=item as Record<string,unknown>;if(typeof o.selected!=='boolean')throw Error('Invalid selection');return {name:label(o.name),type:label(o.type,32),location:vector(o.location),rotation:vector(o.rotation),scale:vector(o.scale),selected:o.selected};})};
}
