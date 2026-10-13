// MOCKED Playwright CDP connection; the observed page reports the width Chrome has applied.
const state=globalThis.__viewportMock??={width:1280};
const observed={on(){},evaluate:async()=>state.width,locator:()=>({first:()=>({})})};
const context={route:async()=>{},routeWebSocket:async()=>{},unroute:async()=>{},on(){},pages:()=>[observed]};
export const chromium={connectOverCDP:async()=>({contexts:()=>[context],close:async()=>{}})};
