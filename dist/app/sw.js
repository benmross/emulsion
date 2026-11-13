const CACHE="emulsion-app-f51429be25a70fd7";
const SHELL=["/app/","/manifest.webmanifest","/icon.svg","/icon-192.png","/icon-512.png","/apple-touch-icon.png","/fonts/archivo.woff2"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
});
// Updates wait for the old app to close, preserving any active editing session.
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("emulsion-app-")&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==self.location.origin) return;
  const appDocument=url.pathname==="/app/"||url.pathname==="/app/index.html";
  if(event.request.mode==="navigate" && appDocument){
    event.respondWith((async()=>{
      try { return await fetch(event.request); }
      catch(e){ return (await caches.open(CACHE)).match("/app/"); }
    })());
  } else if(SHELL.includes(url.pathname)){
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));
  }
});
