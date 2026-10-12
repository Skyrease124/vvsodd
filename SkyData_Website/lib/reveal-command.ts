// Match only an intentional standalone command, never quoted/retrieved content.
export function isRevealCommand(text:string){return /^reveal\s+yourself[.!?]*$/i.test(text.trim());}
