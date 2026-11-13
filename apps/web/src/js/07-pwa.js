/* Cache only public application files. Artwork and history stay on this device. */
if("serviceWorker" in navigator && location.protocol!=="file:"){
  navigator.serviceWorker.register("/app/sw.js",{scope:"/app/",updateViaCache:"none"}).then(reg=>{
    document.addEventListener("visibilitychange",()=>{ if(!document.hidden) reg.update().catch(()=>{}); });
  }).catch(()=>{ /* Browser-only editing still works when installation is unavailable. */ });
}
let installPrompt=null;
window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault(); installPrompt=event;
  if(!matchMedia("(display-mode: standalone)").matches) installBtn.hidden=false;
});
installBtn.addEventListener("click",async()=>{
  if(!installPrompt) return;
  const prompt=installPrompt; installPrompt=null; installBtn.hidden=true;
  await prompt.prompt(); await prompt.userChoice;
});
function installed(){ installBtn.hidden=true; installHint.hidden=true; installPrompt=null; }
window.addEventListener("appinstalled",installed);
if(matchMedia("(display-mode: standalone)").matches) installed();
/* Old bookmarks carried looks in the root fragment. The landing page forwards them. */
window.addEventListener("hashchange",()=>{
  const match=/(?:^#|&)p=([A-Za-z0-9_-]+)/.exec(location.hash);
  if(!match) return;
  commitEdit();
  if(decodeState(match[1])){ activeRecipe=-1; syncAll(); schedule(); refreshThumbs(); commitEdit(); }
});
