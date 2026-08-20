/* ============================== recipes, shuffle, export ============================== */
/* Move only the keys a plate owns; anything it does not name goes back to its
   default, and everything outside LOOK is left exactly as the user set it. */
function applyRecipe(r){
  for(const k of LOOK) P[k] = (k in r.p) ? r.p[k] : DEFAULTS[k];
}

let activeRecipe = 0;
RECIPES.forEach((r,i)=>{
  const b = el("button","chip",recipeBar);
  b.type="button"; b.textContent=r.name;
  b.addEventListener("click", ()=>{
    applyRecipe(r);
    activeRecipe = i;
    syncRecipes(); syncAll(); schedule(); refreshThumbs();
  });
});
function syncRecipes(){
  recipeBar.querySelectorAll(".chip").forEach((b,i)=> b.setAttribute("aria-pressed", i===activeRecipe?"true":"false"));
  const name = activeRecipe>=0 ? RECIPES[activeRecipe].name : SHAPES[P.shape].name+" · shuffled";
  document.getElementById("nowName").innerHTML = "<i>plate</i> <b>"+name+"</b>";
}
binders.push(syncRecipes);
syncRecipes();

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

/* a tap on the plate opens it full-bleed on touch devices, and hides the HUD once there */
canvas.addEventListener("click", ()=>{
  if(document.body.classList.contains("immersive")) document.body.classList.toggle("hud-off");
  else if(COARSE) enterImmersive();
});

function syncHud(){
  const fill = hud.querySelector('[data-act="fill"]');
  const play = hud.querySelector('[data-act="animate"]');
  fill.textContent = P.fill ? "Fill" : "Fit";
  fill.classList.toggle("on", !!P.fill);
  play.textContent = P.animate ? "Pause" : "Play";
  play.classList.toggle("on", !!P.animate);
}
binders.push(syncHud);
hud.addEventListener("click", e=>{
  const b = e.target.closest("[data-act]");
  if(!b) return;
  e.stopPropagation();
  const act = b.dataset.act;
  if(act === "close")   exitImmersive();
  if(act === "fill"){   P.fill = !P.fill; syncHud(); render(); }
  if(act === "animate"){ setAnimating(!P.animate); syncAll(); }
  if(act === "shuffle") shuffle();
  if(act === "export")  exportStill();
});

const MIME = {png:"image/png", webp:"image/webp", jpeg:"image/jpeg"};
const QUAL = {png:undefined, webp:0.95, jpeg:0.94};
const LIMIT = 16*1024*1024;

function toBlob(type, quality){
  return new Promise(res => canvas.toBlob(b => res(b), type, quality));
}
async function saveBlob(blob, filename){
  let dl = null;
  try { if(window.claude && typeof claude.use === "function") dl = await claude.use("downloads"); } catch(e){ dl = null; }
  if(dl){
    for(let attempt=0; attempt<2; attempt++){
      try { await dl.save({filename, data:blob}); msg("saved · "+filename); return "saved"; }
      catch(err){
        const code = err && err.code;
        if(code==="rate_limited" && attempt===0){ await new Promise(r=>setTimeout(r,1500)); continue; }
        if(code==="declined"){ msg("export canceled"); return "declined"; }
        if(code==="too_large") msg("file over 16 MB — try WebP or a smaller size");
        else msg("save failed" + (err && err.message ? " · "+err.message : ""));
        return "failed";
      }
    }
    return "failed";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 8000);
  msg("saved · "+filename);
  return "saved";
}
let exporting = false;
document.getElementById("export").addEventListener("click", exportStill);
async function exportStill(){
  if(!draw || exporting) return;
  exporting = true; recording = true;
  busy.textContent = "rendering full size…";
  busy.classList.add("on");
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  try{
    draw(P, P.W, P.H, 1, phase);
    let fmt = P.fmt;
    let blob = await toBlob(MIME[fmt], QUAL[fmt]);
    if(blob && blob.size > LIMIT && fmt === "png"){
      fmt = "webp";
      const alt = await toBlob(MIME.webp, QUAL.webp);
      if(alt && alt.size < blob.size){ blob = alt; msg("PNG exceeded 16 MB — exported as WebP"); }
    }
    if(!blob){ msg("export failed — try another format"); }
    else {
      const name = "emulsion_"+SHAPES[P.shape].name.toLowerCase()+"_"+P.W+"x"+P.H+"_"+Math.round(P.seed*10000)+"."+(fmt==="jpeg"?"jpg":fmt);
      await saveBlob(blob, name);
    }
  } catch(err){
    console.error(err);
    msg("export failed · "+(err && err.message ? err.message : "unknown error"));
  } finally {
    busy.classList.remove("on");
    exporting = false; recording = false;
    render();
  }
}

/* ---------- a set of stills, for Photo Shuffle ---------- */
setBtn.addEventListener("click", async ()=>{
  if(!draw || exporting) return;
  const n = P.setsize, keepSeed = P.seed;
  exporting = true; recording = true;
  busy.textContent = "rendering set…";
  busy.classList.add("on");
  try{
    for(let i=0;i<n;i++){
      P.seed = Math.round(Math.random()*9999)/10000;
      msg("frame "+(i+1)+" of "+n+"…");
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      draw(P, P.W, P.H, 1, phase);
      let fmt = P.fmt;
      let blob = await toBlob(MIME[fmt], QUAL[fmt]);
      if(blob && blob.size > LIMIT && fmt === "png"){
        const alt = await toBlob(MIME.webp, QUAL.webp);
        if(alt && alt.size < blob.size){ blob = alt; fmt = "webp"; }
      }
      if(!blob){ msg("export failed — try another format"); break; }
      const name = "emulsion_"+SHAPES[P.shape].name.toLowerCase()+"_"+(i+1)+"_"+Math.round(P.seed*10000)+"."+(fmt==="jpeg"?"jpg":fmt);
      const status = await saveBlob(blob, name);
      if(status === "declined"){ msg("set canceled at "+(i+1)+" of "+n); break; }
      if(status === "failed") break;
      if(i < n-1) await new Promise(r=>setTimeout(r,500));
    }
  } finally {
    P.seed = keepSeed; syncAll();
    busy.classList.remove("on");
    exporting = false; recording = false;
    render();
  }
});

/* ---------- record one seamless loop ---------- */
const VIDEO_TYPES = [
  {mime:"video/mp4;codecs=avc1.4d0028", ext:"mp4"},
  {mime:"video/mp4;codecs=avc1.42E01E", ext:"mp4"},
  {mime:"video/mp4", ext:"mp4"},
  {mime:"video/webm;codecs=vp9", ext:"webm"},
  {mime:"video/webm", ext:"webm"}
];
function pickVideo(){
  if(typeof MediaRecorder === "undefined" || !canvas.captureStream) return null;
  for(const t of VIDEO_TYPES){
    try { if(MediaRecorder.isTypeSupported(t.mime)) return t; } catch(e){}
  }
  return null;
}
const VIDEO = pickVideo();
if(!VIDEO && !canEncodeVideo()){
  recBtn.disabled = true;
  recBtn.title = "This browser can't encode video";
  recNote.textContent = "Recording needs WebCodecs or MediaRecorder — Chrome, Edge, or a current Firefox or Safari.";
}

/* How fast can this machine actually paint a frame at full size? Only the
   realtime fallback cares — the WebCodecs path is immune to it. */
function measureFps(w, h, frames){
  return new Promise(res=>{
    let i = 0; const t0 = performance.now();
    (function step(){
      draw(P, w, h, 1, (i/frames)*Math.PI*2);
      if(++i >= frames){ res(frames / ((performance.now() - t0)/1000)); return; }
      requestAnimationFrame(step);
    })();
  });
}

/* Fallback: capture the canvas in real time. Frame timing comes from the wall
   clock here, so the render has to keep up — shrink it until it can. */
async function recordRealtime(dur){
  const measured = await measureFps(P.W, P.H, 6);
  let scale = Math.min(1, Math.sqrt(Math.max(measured,1) / 26));
  scale = Math.max(0.4, Math.round(scale*20)/20);
  const w = Math.max(2, Math.round(P.W*scale/2)*2);
  const h = Math.max(2, Math.round(P.H*scale/2)*2);

  draw(P, w, h, 1, 0);
  const stream = canvas.captureStream();
  const chunks = [];
  const rec = new MediaRecorder(stream, {
    mimeType: VIDEO.mime,
    videoBitsPerSecond: Math.max(2e6, Math.min(24e6, Math.round(w*h*26*0.22), Math.round(9*8e6/dur)))
  });
  rec.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start();
  const t0 = performance.now();
  await new Promise(done=>{
    (function step(){
      const el = performance.now() - t0;
      draw(P, w, h, 1, (el/(dur*1000))*Math.PI*2);
      busy.textContent = "recording " + (el/1000).toFixed(1) + " / " + dur.toFixed(1) + " s";
      if(el >= dur*1000){ done(); return; }
      requestAnimationFrame(step);
    })();
  });
  rec.stop();
  await stopped;
  stream.getTracks().forEach(t => t.stop());
  return {
    blob: new Blob(chunks, {type: VIDEO.mime}),
    ext: VIDEO.ext,
    note: scale < 1 ? " · captured at " + Math.round(scale*100) + "% size to hold frame rate" : ""
  };
}

recBtn.addEventListener("click", async ()=>{
  if(!draw || exporting) return;
  const dur = Math.max(P.looplen, 1);
  exporting = true; recording = true;
  busy.textContent = "preparing…";
  busy.classList.add("on");
  try{
    let blob = null, ext = "mp4", note = "";
    if(canEncodeVideo()){
      try {
        blob = await encodeLoopMP4(P, {
          fps: P.fps, seconds: dur,
          onProgress: (i,n)=>{ busy.textContent = "frame " + i + " / " + n; }
        });
      } catch(err){ console.warn("WebCodecs encode failed, falling back", err); blob = null; }
    }
    if(!blob && VIDEO){
      const r = await recordRealtime(dur);
      blob = r.blob; ext = r.ext; note = r.note;
    }
    if(!blob){ msg("this browser could not encode the loop"); }
    else if(blob.size > LIMIT){
      msg("loop is " + (blob.size/1048576).toFixed(1) + " MB — shorten it or drop the resolution");
    } else {
      const name = "emulsion_loop_"+P.W+"x"+P.H+"_"+Math.round(P.seed*10000)+"."+ext;
      const status = await saveBlob(blob, name);
      if(status === "saved" && note) msg("saved · " + name + note);
    }
  } catch(err){
    console.error(err);
    msg("recording failed · " + (err && err.message ? err.message : "unknown error"));
  } finally {
    busy.classList.remove("on");
    busy.textContent = "rendering full size…";
    exporting = false; recording = false;
    if(P.animate) animT0 = performance.now();
    render();
  }
});

/* ============================== go ============================== */
if(draw){
  let rt = 0;
  new ResizeObserver(()=>{ clearTimeout(rt); rt = setTimeout(render, 80); }).observe(plate);
  window.addEventListener("resize", ()=>{ clearTimeout(rt); rt = setTimeout(render, 80); });
  render();
  refreshThumbs();
}
