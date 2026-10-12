export const ENGINEERING_WORKFLOWS = [
 {id:'planning',label:'Planning',skill:'writing-plans'},
 {id:'debugging',label:'Systematic debugging',skill:'systematic-debugging'},
 {id:'review',label:'Code review',skill:'requesting-code-review'},
 {id:'testing',label:'Test design',skill:'test-driven-development'},
 {id:'performance',label:'Performance investigation',skill:'systematic-debugging'},
] as const;
export type EngineeringMode='research'|'development';
