/* ============================== recipes, shuffle, export ============================== */
const KEEP = ["W","H","seed","fmt","c0","c1","c2","animate","guides","setsize"];
const FORM_BASE = {};
for(const k in DEFAULTS) if(KEEP.indexOf(k)<0) FORM_BASE[k] = DEFAULTS[k];

let activeRecipe = 0;
RECIPES.forEach((r,i)=>{
  const b = el("button","chip",recipeBar);
  b.type="button"; b.textContent=r.name;
  b.addEventListener("click", ()=>{
    Object.assign(P, FORM_BASE, r.p);
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
  if(t && (t.tagName==="INPUT" || t.tagName==="SELECT" || t.isContentEditable)) return;
  if(e.key==="r" || e.key==="R"){ e.preventDefault(); shuffle(); }
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
document.getElementById("export").addEventListener("click", async ()=>{
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
});

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
if(!VIDEO){
  recBtn.disabled = true;
  recBtn.title = "This browser can't record canvas video";
  recNote.textContent = "Recording needs a browser with MediaRecorder — Chrome, Edge, or Safari 17+.";
}
recBtn.addEventListener("click", async ()=>{
  if(!draw || !VIDEO || exporting) return;
  const dur = Math.max(P.looplen, 1);
  exporting = true; recording = true;
  busy.textContent = "recording loop…";
  busy.classList.add("on");
  let chunks = [], rec = null;
  try{
    draw(P, P.W, P.H, 1, 0);
    const stream = canvas.captureStream();
    rec = new MediaRecorder(stream, {
      mimeType: VIDEO.mime,
      videoBitsPerSecond: Math.min(24e6, Math.round(10*8e6/dur))
    });
    rec.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(r => { rec.onstop = r; });
    rec.start();
    const t0 = performance.now();
    await new Promise(res=>{
      function step(now){
        const el = now - t0;
        draw(P, P.W, P.H, 1, (el/(dur*1000))*Math.PI*2);
        if(el >= dur*1000){ res(); return; }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
    rec.stop();
    await stopped;
    stream.getTracks().forEach(t=>t.stop());
    const blob = new Blob(chunks, {type: VIDEO.mime});
    if(!blob.size){ msg("recording came back empty"); }
    else if(blob.size > LIMIT){ msg("loop is "+(blob.size/1048576).toFixed(1)+" MB — shorten it or drop the resolution"); }
    else await saveBlob(blob, "emulsion_loop_"+P.W+"x"+P.H+"_"+Math.round(P.seed*10000)+"."+VIDEO.ext);
  } catch(err){
    console.error(err);
    msg("recording failed · "+(err && err.message ? err.message : "unknown error"));
  } finally {
    busy.classList.remove("on");
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
