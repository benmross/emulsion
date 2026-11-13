/* ============================== recipes, shuffle, export ============================== */
/* Move only the keys a plate owns; anything it does not name goes back to its
   default, and everything outside LOOK is left exactly as the user set it. */
function applyRecipe(r){
  for(const k of LOOK) P[k] = (k in r.p) ? r.p[k] : DEFAULTS[k];
}

let activeRecipe = 0;
const peekPlates = document.getElementById("peekplates");
const caption = document.getElementById("caption");

RECIPES.forEach((r,i)=>{
  [platesEl, peekPlates].forEach(host=>{
    const b = el("button",null,host);
    b.type = "button"; b.dataset.plate = i; b.title = r.name;
    const img = el("img",null,b);
    img.alt = r.name; img.decoding = "async";
    el("span",null,b).textContent = r.name;
    b.addEventListener("click", ()=> selectRecipe(i));
  });
});

function selectRecipe(i){
  applyRecipe(RECIPES[i]);
  activeRecipe = i;
  syncRecipes(); syncAll(); schedule(); refreshThumbs();
  flashCaption(RECIPES[i].name);
}
function syncRecipes(){
  document.querySelectorAll("[data-plate]").forEach(b=>{
    b.setAttribute("aria-pressed", (+b.dataset.plate) === activeRecipe ? "true" : "false");
  });
  const name = activeRecipe >= 0 ? RECIPES[activeRecipe].name : SHAPES[P.shape].name+" · shuffled";
  document.getElementById("nowName").innerHTML = "<i>plate</i> <b>"+name+"</b>";
  const tile = peekPlates.hidden ? null : peekPlates.querySelector('[aria-pressed="true"]');
  if(tile && tile.scrollIntoView) tile.scrollIntoView({block:"nearest", inline:"center", behavior:"smooth"});
}
binders.push(syncRecipes);
syncRecipes();

/* ---------- the plate name, shown while cycling and after a pick ---------- */
let capTimer = 0;
function flashCaption(name){
  caption.querySelector("b").textContent = name;
  document.body.classList.add("captioning");
  clearTimeout(capTimer);
  capTimer = setTimeout(()=> document.body.classList.remove("captioning"), 1400);
}

const rnd = (a,b)=> a + Math.random()*(b-a);
document.getElementById("shuffle").addEventListener("click", shuffle);
function shuffle(){
  P.seed   = Math.round(Math.random()*9999)/10000;
  P.angle  = Math.round(rnd(-180,180));
  P.scale  = +rnd(0.7,2.2).toFixed(2);
  P.soft   = +rnd(0.15,0.6).toFixed(3);
  P.warp   = +rnd(0.1,1.1).toFixed(2);
  P.detail = +rnd(2.5,5).toFixed(2);
  P.mottle = +rnd(0.1,0.6).toFixed(2);
  P.posx   = +rnd(-0.5,0.5).toFixed(2);
  P.posy   = +rnd(-0.4,0.4).toFixed(2);
  P.bands  = +rnd(1.2,4.5).toFixed(2);
  if(Math.random()<0.5){ P.blur = +rnd(0.05,0.5).toFixed(2); P.streak = +rnd(0,0.9).toFixed(2); P.streakang = Math.round(rnd(-180,180)); }
  else { P.blur = +rnd(0,0.12).toFixed(2); P.streak = 0; }
  activeRecipe = -1;
  syncRecipes(); syncAll(); schedule(); refreshThumbs();
}

document.addEventListener("keydown", e=>{
  const t = e.target;
  if(e.key==="Escape" && document.body.classList.contains("immersive")){ exitImmersive(); return; }
  if(t && (t.tagName==="INPUT" || t.tagName==="SELECT" || t.isContentEditable)) return;
  if(e.key==="r" || e.key==="R"){ e.preventDefault(); shuffle(); }
  if(e.key==="f" || e.key==="F"){ e.preventDefault(); toggleImmersive(); }
});

/* ---------- fullscreen preview ----------
   Real fullscreen where the browser allows it; otherwise the same thing done
   with CSS, which is the only route on iPhone (Safari refuses requestFullscreen
   on anything but a <video>) and inside a sandboxed frame. */
const hud = document.getElementById("hud");
const immerseBtn = document.getElementById("immerse");
if(!draw){ immerseBtn.disabled=true; immerseBtn.title="Fullscreen needs WebGL2"; }
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;

function enterImmersive(){
  if(document.body.classList.contains("immersive")) return;
  document.body.classList.add("immersive");
  document.body.classList.remove("hud-off");
  const req = frame.requestFullscreen || frame.webkitRequestFullscreen;
  if(req){
    try {
      const r = req.call(frame, {navigationUI:"hide"});
      if(r && r.catch) r.catch(()=>{});
    } catch(e){ /* CSS mode carries it */ }
  }
  syncHud(); render();
}
function exitImmersive(){
  if(!document.body.classList.contains("immersive")) return;
  document.body.classList.remove("immersive","hud-off");
  if(fsEl()){
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if(exit){ try { const r = exit.call(document); if(r && r.catch) r.catch(()=>{}); } catch(e){} }
  }
  render();
}
function toggleImmersive(){
  document.body.classList.contains("immersive") ? exitImmersive() : enterImmersive();
}
immerseBtn.addEventListener("click", toggleImmersive);
document.addEventListener("fullscreenchange", ()=>{ if(!fsEl()) exitImmersive(); else render(); });

/* a tap on the plate clears the interface off it, and brings it back */
canvas.addEventListener("click", ()=>{
  if(document.body.classList.contains("immersive")){ document.body.classList.toggle("hud-off"); return; }
  if(MOBILE.matches) setBare(!document.body.classList.contains("ui-off"));
});

function syncHud(){
  if(!hud) return;
  const fill = hud.querySelector('[data-act="fill"]');
  fill.textContent = P.fill ? "Fill" : "Fit";
  fill.classList.toggle("on", !!P.fill);
}
binders.push(syncHud);
if(hud) hud.addEventListener("click", e=>{
  const b = e.target.closest("[data-act]");
  if(!b) return;
  e.stopPropagation();
  const act = b.dataset.act;
  if(act === "close")   exitImmersive();
  if(act === "fill"){   P.fill = !P.fill; syncHud(); render(); }
  if(act === "shuffle") shuffle();
  if(act === "export")  exportStill();
});

const MIME = {png:"image/png", webp:"image/webp", jpeg:"image/jpeg"};
const QUAL = {png:undefined, webp:0.95, jpeg:0.94};
const LIMIT = 16*1024*1024;

function canvasBlob(target, type, quality){
  return new Promise((res,rej)=>{
    try { target.toBlob(b=>b?res(b):rej(new Error("the browser could not allocate the requested image")),type,quality); }
    catch(e){ rej(e); }
  });
}
async function saveBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 8000);
  msg("saved · "+filename);
  return "saved";
}
let exporting = false;
document.getElementById("export").addEventListener("click", exportStill);
function setExportBusy(on,text){
  if(text) busy.textContent=text;
  busy.classList.toggle("on",on);
  document.querySelectorAll(".app button,.app input,.app select").forEach(b=>{
    if(on){ b.dataset.wasDisabled=b.disabled?"1":"0"; b.disabled=true; }
    else if(b.dataset.wasDisabled!==undefined){ b.disabled=b.dataset.wasDisabled==="1"; delete b.dataset.wasDisabled; }
  });
  document.querySelector(".app").setAttribute("aria-busy",on?"true":"false");
  [document.getElementById("export"),document.getElementById("mSave"),
   document.getElementById("mShare"),setBtn].forEach(b=>{ if(b) b.disabled=on; });
}

function stillName(fmt){
  return "emulsion_"+SHAPES[P.shape].name.toLowerCase()+"_"+P.W+"x"+P.H
       + "_"+Math.round(P.seed*10000)+"."+(fmt==="jpeg" ? "jpg" : fmt);
}
async function makeStill(){
  const surface=makeExportSurface(P.W,P.H);
  try{
    surface.draw(P,P.W,P.H,1);
    let fmt=P.fmt, blob=await canvasBlob(surface.canvas,MIME[fmt],QUAL[fmt]);
    if(blob.type !== MIME[fmt]) throw new Error("This browser cannot export "+fmt.toUpperCase()+". Choose PNG or JPEG.");
    if(blob.size>LIMIT && fmt==="png"){
      const alt=await canvasBlob(surface.canvas,MIME.webp,QUAL.webp);
      if(alt.size<blob.size){ blob=alt; fmt="webp"; msg("PNG exceeded 16 MB — exported as WebP"); }
    }
    return {blob,fmt};
  } finally { surface.dispose(); }
}

/* Hand the image to the OS share sheet where there is one — on iOS that is the
   only route into Photos that does not go through the Files app. */
async function sharePlate(){
  if(!draw || exporting) return;
  const signature=encodeState()+"|"+P.fmt;
  if(preparedShare && preparedShare.signature===signature){
    const prepared=preparedShare; preparedShare=null; syncShareButton();
    try { await navigator.share({files:[prepared.file],title:"Emulsion"}); msg("shared"); }
    catch(err){ if(err && err.name==="AbortError") msg("share canceled"); else { console.error(err); msg("share failed"); } }
    return;
  }
  exporting = true; recording = true;
  setExportBusy(true,"preparing image…");
  try{
    const {blob, fmt} = await makeStill();
    if(!blob){ msg("could not render the image"); return; }
    const name = stillName(fmt);
    const file = typeof File !== "undefined" ? new File([blob], name, {type: MIME[fmt]}) : null;
    if(file && navigator.canShare && navigator.canShare({files:[file]})){
      preparedShare={signature,file}; syncShareButton();
      msg("image ready — tap Share again");
    } else {
      await saveBlob(blob, name);
    }
  } catch(err){
    console.error(err);
    msg("share failed · "+(err && err.message ? err.message : "unknown error"));
  } finally {
    setExportBusy(false);
    exporting = false; recording = false;
    syncHistory(); render();
  }
}

let preparedShare=null;
const mobileShareBtn=document.getElementById("mShare");
function syncShareButton(){
  mobileShareBtn.setAttribute("aria-label",preparedShare?"Share prepared image":"Prepare image to share");
  mobileShareBtn.title=preparedShare?"Share prepared image":"Prepare image to share";
}
function invalidatePreparedShare(){
  if(!preparedShare) return;
  preparedShare=null; syncShareButton();
}
syncShareButton();

async function exportStill(){
  if(!draw || exporting) return;
  exporting = true; recording = true;
  setExportBusy(true,"rendering full size…");
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  try{
    const {blob, fmt} = await makeStill();
    if(!blob){ msg("export failed — try another format"); }
    else { await saveBlob(blob, stillName(fmt)); showResult("Your wallpaper is ready",[{blob,seed:P.seed}]); }
  } catch(err){
    console.error(err);
    msg("export failed · "+(err && err.message ? err.message : "unknown error"));
  } finally {
    setExportBusy(false);
    exporting = false; recording = false;
    syncHistory(); render();
  }
}

/* ---------- a set of stills, for Photo Shuffle ---------- */
linkBtn.addEventListener("click", copyLink);

setBtn.addEventListener("click", async ()=>{
  if(!draw || exporting) return;
  const n = P.setsize, keepSeed = P.seed;
  exporting = true; recording = true;
  setExportBusy(true,"rendering set…");
  const files=[];
  try{
    for(let i=0;i<n;i++){
      P.seed = Math.round(Math.random()*9999)/10000;
      msg("frame "+(i+1)+" of "+n+"…");
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const made=await makeStill(); let {blob,fmt}=made;
      const name = "emulsion_"+SHAPES[P.shape].name.toLowerCase()+"_"+(i+1)+"_"+Math.round(P.seed*10000)+"."+(fmt==="jpeg"?"jpg":fmt);
      files.push({name,blob,seed:P.seed});
    }
    if(files.length){
      busy.textContent="packing set…";
      await saveBlob(await makeZip(files),"emulsion_set_"+P.W+"x"+P.H+".zip");
      showResult(files.length+" variations ready",files);
    }
  } catch(err) {
    console.error(err); msg("export set failed · "+err.message);
  } finally {
    P.seed = keepSeed; syncAll();
    setExportBusy(false);
    exporting = false; recording = false;
    syncHistory(); render();
  }
});

/* Store-only ZIP: image formats are already compressed, and one archive keeps
   browsers from blocking a burst of downloads after the initiating gesture. */
const crcTable=(()=>{ const t=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=(c&1)?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; } return t; })();
function crc32(bytes){ let c=0xFFFFFFFF; for(const b of bytes) c=crcTable[(c^b)&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
const le16=n=>[n&255,(n>>>8)&255], le32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
async function makeZip(files){
  const local=[],central=[]; let offset=0;
  for(const {name,blob} of files){
    const nameBytes=new TextEncoder().encode(name), data=new Uint8Array(await blob.arrayBuffer());
    const crc=crc32(data), size=data.byteLength;
    const head=new Uint8Array([
      ...le32(0x04034b50),...le16(20),...le16(0),...le16(0),...le16(0),...le16(0),
      ...le32(crc),...le32(size),...le32(size),...le16(nameBytes.length),...le16(0),...nameBytes
    ]);
    local.push(head,data);
    central.push(new Uint8Array([
      ...le32(0x02014b50),...le16(20),...le16(20),...le16(0),...le16(0),...le16(0),...le16(0),
      ...le32(crc),...le32(size),...le32(size),...le16(nameBytes.length),...le16(0),...le16(0),
      ...le16(0),...le16(0),...le32(0),...le32(offset),...nameBytes
    ]));
    offset+=head.byteLength+size;
  }
  const centralSize=central.reduce((n,p)=>n+p.byteLength,0);
  const end=new Uint8Array([
    ...le32(0x06054b50),...le16(0),...le16(0),...le16(files.length),...le16(files.length),
    ...le32(centralSize),...le32(offset),...le16(0)
  ]);
  return new Blob([...local,...central,end],{type:"application/zip"});
}

/* ============================== sheet + link ============================== */
/* Drag the handle down to clear the controls off the screen, up to bring them
   back; a plain tap does the same thing. */
let dragFrom = null, dragDy = 0, swallowClick = false;
grabEl.addEventListener("pointerdown", e=>{
  if(!MOBILE.matches) return;
  dragFrom = e.clientY; dragDy = 0;
  if(grabEl.setPointerCapture) grabEl.setPointerCapture(e.pointerId);
});
grabEl.addEventListener("pointermove", e=>{
  if(dragFrom === null) return;
  dragDy = e.clientY - dragFrom;
});
function endDrag(){
  if(dragFrom === null) return;
  dragFrom = null;
  if(Math.abs(dragDy) < 30) return;
  setMin(dragDy > 0);
  swallowClick = true;
}
grabEl.addEventListener("pointerup", endDrag);
grabEl.addEventListener("pointercancel", endDrag);
grabEl.addEventListener("click", ()=>{
  if(swallowClick){ swallowClick = false; return; }
  setMin(!document.body.classList.contains("sheet-min"));
});

document.getElementById("mShuffle").addEventListener("click", ()=>{ shuffle(); });
document.getElementById("mSave").addEventListener("click", exportStill);
document.getElementById("mShare").addEventListener("click", sharePlate);

/* Tapping the plate hides everything over it; the plate takes the whole screen. */
function setBare(bare){
  document.body.classList.toggle("ui-off", bare);
  measureSheet();
  render();
  if(bare) msg("tap the wallpaper to bring the controls back");
}

/* The sheet's height is the plate's floor — hand it to the layout. */
function measureSheet(){
  const gone = !MOBILE.matches || document.body.classList.contains("ui-off");
  document.documentElement.style.setProperty("--sheet-h", gone ? "0px" : Math.ceil(window.innerHeight-rail.getBoundingClientRect().top+8)+"px");
}

/* A link that carries the whole look, so a plate can be sent to someone. */
const SHARE_KEYS = LOOK.concat(["mid","chroma","W","H","seed"]);   /* the ramp rides in LOOK */
const STATE_RANGE = {
  shape:[0,SHAPES.length-1,1], scale:[.25,4], angle:[-180,180], soft:[.03,1], warp:[0,1.5],
  detail:[1,6], mottle:[0,1], posx:[-1.5,1.5], posy:[-1.5,1.5], bands:[.4,8],
  blur:[0,1], streak:[0,1], streakang:[-180,180], exposure:[-2,2], contrast:[.3,3],
  black:[0,.6], gamma:[.4,2.4], vignette:[0,1], gloss:[0,1], grain:[0,.6],
  gsize:[.5,8], gdens:[.02,1], gresp:[0,1], tex:[0,4,1], texamt:[0,1],
  texscale:[.2,3], mid:[.1,.9], W:[64,8192,1], H:[64,8192,1], seed:[0,.9999]
};
function encodeState(){
  const arr = SHARE_KEYS.map(k=>{
    const v = P[k];
    if(typeof v === "number") return Math.round(v*10000)/10000;
    if(typeof v === "boolean") return v ? 1 : 0;
    return v;
  });
  return btoa(JSON.stringify(arr)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function decodeState(str){
  try{
    const arr = JSON.parse(atob(str.replace(/-/g,"+").replace(/_/g,"/")));
    if(!Array.isArray(arr) || arr.length !== SHARE_KEYS.length) return false;
    SHARE_KEYS.forEach((k,i)=>{
      const def = DEFAULTS[k], v = arr[i];
      if(typeof def === "boolean") P[k] = !!v;
      else if(typeof def === "number"){
        const range=STATE_RANGE[k], n=Number.isFinite(+v)?+v:def;
        if(!range) P[k]=def;
        else { const bounded=Math.max(range[0],Math.min(range[1],n)); P[k]=range[2]?Math.round(bounded):bounded; }
      }
      else P[k] = /^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : def;
    });
    return true;
  } catch(e){ return false; }
}
async function copyLink(){
  const url = location.origin + location.pathname + "#p=" + encodeState();
  try {
    await navigator.clipboard.writeText(url);
    msg("link copied — it carries this exact look");
  } catch(e){
    location.hash = "p=" + encodeState();
    msg("link is in the address bar — copy it from there");
  }
}

/* iOS paints the strip behind the clock with the page's theme colour, so sample
   the top of the plate and hand it over — the band stops reading as a black bar.
   Launched from the Home Screen the plate goes under the clock outright. */
const themeMeta = document.querySelector('meta[name="theme-color"]');
const sampler = document.createElement("canvas");
sampler.width = 1; sampler.height = 1;
const sctx = sampler.getContext("2d", {willReadFrequently:true});
let themeTimer = 0;
function updateThemeColor(){
  if(!themeMeta || !draw) return;
  clearTimeout(themeTimer);
  themeTimer = setTimeout(()=>{
    try{
      const strip = Math.max(1, Math.round(canvas.height * 0.05));
      sctx.drawImage(canvas, 0, 0, canvas.width, strip, 0, 0, 1, 1);
      const d = sctx.getImageData(0,0,1,1).data;
      const hex = "#" + [d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,"0")).join("");
      themeMeta.setAttribute("content", hex);
    } catch(e){ /* tainted or unavailable — leave the default */ }
  }, 240);
}

/* ============================== go ============================== */
if(draw){
  let rt = 0;
  new ResizeObserver(()=>{ clearTimeout(rt); rt = setTimeout(render, 80); }).observe(plate);
  window.addEventListener("resize", ()=>{ clearTimeout(rt); rt = setTimeout(render, 80); });

  const link = /[#&]p=([A-Za-z0-9_\-]+)/.exec(location.hash);
  restoreSession();
  const fromLink = link && decodeState(link[1]);
  if(fromLink){ activeRecipe = -1; flashCaption("Shared look"); }

  sessionReady = true;
  if(fromLink){ history = [snapshot()]; cursor = 0; }
  setTab(currentCategory);
  syncHistory();
  setMin(false);
  measureSheet();
  new ResizeObserver(measureSheet).observe(rail);
  MOBILE.addEventListener("change", ()=>{ measureSheet(); render(); });
  syncAll();
  render();
  refreshThumbs();
  persistSession();
} else {
  document.querySelectorAll(".app button,.app input,.app select").forEach(b=>b.disabled=true);
  document.getElementById("sessionStatus").textContent="WebGL2 unavailable";
}

/* Edits settle into one undo step; closing mid-drag still saves the current look. */
for(const event of ["input","change","click"]) document.querySelector(".app").addEventListener(event, e=>{
  if(!sessionReady || e.target.closest(".history-controls") || recording) return;
  noteEdit();
});
document.addEventListener("visibilitychange",()=>{ if(document.hidden) commitEdit(); });
window.addEventListener("pagehide",commitEdit);
document.querySelectorAll("[data-history]").forEach(b=>b.addEventListener("click",()=>stepHistory(b.dataset.history==="undo"?-1:1)));
document.addEventListener("keydown",e=>{
  if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=="z"||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  e.preventDefault(); stepHistory(e.shiftKey?1:-1);
});

document.getElementById("plateShuffle").addEventListener("click",shuffle);
document.getElementById("plateSeed").addEventListener("click",()=>{P.seed=Math.round(Math.random()*9999)/10000;syncAll();schedule();refreshThumbs();});

const resultDialog=document.getElementById("result");
let resultURLs=[];
function clearResult(){ resultURLs.forEach(url=>URL.revokeObjectURL(url)); resultURLs=[]; }
resultDialog.addEventListener("close",clearResult);
document.getElementById("resultDone").addEventListener("click",()=>resultDialog.close());
function showResult(title,files){
  clearResult(); document.getElementById("resultTitle").textContent=title;
  const grid=document.getElementById("resultGrid"); grid.replaceChildren();
  for(const file of files){
    const url=URL.createObjectURL(file.blob); resultURLs.push(url);
    const button=document.createElement("button"); button.type="button";
    button.setAttribute("aria-label","Keep editing variation, seed "+Math.round(file.seed*10000));
    const img=document.createElement("img");img.src=url;img.alt="Wallpaper variation";button.append(img);
    button.addEventListener("click",()=>{ commitEdit(); P.seed=file.seed;syncAll();schedule();refreshThumbs();commitEdit();resultDialog.close(); });
    grid.append(button);
  }
  resultDialog.showModal();
}
