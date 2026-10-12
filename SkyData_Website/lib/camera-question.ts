// Only explicit requests to look through the camera may open it automatically.
export function asksToSeeCamera(text:string):boolean{
 return /\b(?:what\s+(?:do|can)\s+you\s+see|what(?:'s| is)\s+(?:in front of|on)\s+(?:my|the)\s+camera|look\s+(?:through|at)\s+(?:my|the)\s+camera|can\s+you\s+see\s+(?:me|this)|what\s+am\s+i\s+(?:holding|showing))\b/i.test(text);
}
