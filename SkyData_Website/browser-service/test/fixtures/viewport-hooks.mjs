// MOCKED: test-only module hooks that replace Stagehand, Playwright and the Chrome control check for worker.mjs.
const mocks={'@browserbasehq/stagehand':'./mock-stagehand.mjs','playwright-core':'./mock-playwright.mjs'};
export async function resolve(specifier,context,next){
 if(mocks[specifier])return {url:new URL(mocks[specifier],import.meta.url).href,shortCircuit:true};
 if(specifier==='./browser-control.mjs'&&context.parentURL?.endsWith('/worker.mjs'))return {url:new URL('./mock-browser-control.mjs',import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}
