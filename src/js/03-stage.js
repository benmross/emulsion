/* ============================== boot ============================== */
const canvas = document.getElementById("gl");
const frame  = document.getElementById("frame");
const plate  = document.querySelector(".plate");
const rail   = document.getElementById("rail");
const busy   = document.getElementById("busy");
const stMsg  = document.getElementById("stMsg");

let draw = null, drawThumb = null, thumbCanvas = null;
try { draw = makeRenderer(canvas); } catch(e){ console.error(e); }

if(!draw){
  frame.remove();
  const n = document.createElement("p");
  n.className = "nogl";
  n.textContent = "This browser can't run WebGL2, which the plate needs to draw grain. Try a current Chrome, Firefox, or Safari — or enable hardware acceleration.";
  plate.appendChild(n);
} else {
  thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = 96; thumbCanvas.height = 128;
  try { drawThumb = makeRenderer(thumbCanvas); } catch(e){ drawThumb = null; }
}

const binders = [];
const syncAll = () => binders.forEach(fn => fn());

let previewScale = 1, rafId = 0, rw = 2, rh = 2;
let phase = 0, animRAF = 0, animT0 = 0, recording = false, fpsEma = 0, lastFrame = 0;
function schedule(){
  if(!draw || rafId) return;
  rafId = requestAnimationFrame(()=>{ rafId = 0; render(); });
}
function paint(){ if(draw && !recording) draw(P, rw, rh, previewScale, phase); }
const COARSE = !!(window.matchMedia && window.matchMedia("(pointer:coarse)").matches);
const MOBILE = window.matchMedia("(max-width:980px)");
function render(){
  if(!draw || recording) return;
  const asp = P.W / P.H;
  const immersive = document.body.classList.contains("immersive") || MOBILE.matches;
  let dispW, dispH;
  if(immersive){
    // fill crops to the screen (how a wallpaper actually sits); fit shows the whole plate
    const vw = window.innerWidth, vh = window.innerHeight;
    dispW = P.fill ? Math.max(vw, vh*asp) : Math.min(vw, vh*asp);
    dispH = dispW / asp;
  } else {
    const box = plate.getBoundingClientRect();
    const pad = COARSE ? 22 : 52;
    const availW = Math.max(120, box.width  - pad);
    const availH = Math.max(120, box.height - pad);
    dispW = Math.min(availW, availH*asp);
    dispH = dispW / asp;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  rw = Math.round(dispW*dpr); rh = Math.round(dispH*dpr);
  const cap = COARSE ? (P.blur > 0.02 ? 0.8e6 : 1.7e6)
                     : (P.blur > 0.02 ? 1.3e6 : 2.6e6);
  if(rw*rh > cap){ const k = Math.sqrt(cap/(rw*rh)); rw = Math.round(rw*k); rh = Math.round(rh*k); }
  if(rw > P.W){ rw = P.W; rh = P.H; }
  previewScale = rw / P.W;
  canvas.style.width  = Math.round(dispW)+"px";
  canvas.style.height = Math.round(dispH)+"px";
  rw = Math.max(rw,2); rh = Math.max(rh,2);
  paint();
  updateStatus();
}
function updateStatus(){
  document.getElementById("stOut").textContent  = P.W+" × "+P.H;
  document.getElementById("stMp").textContent   = (P.W*P.H/1e6).toFixed(1);
  document.getElementById("stPrev").textContent = Math.round(previewScale*100)+"%";
  document.getElementById("stSeed").textContent = P.seed.toFixed(4);
}
function setAnimating(on){
  P.animate = on;
  if(on){
    animT0 = performance.now(); lastFrame = animT0; fpsEma = 0;
    if(!animRAF) animRAF = requestAnimationFrame(tick);
  } else {
    if(animRAF) cancelAnimationFrame(animRAF);
    animRAF = 0; phase = 0;
    document.getElementById("stFps").textContent = "still";
    schedule();
  }
}
function tick(now){
  if(!P.animate){
    animRAF = 0; phase = 0;
    document.getElementById("stFps").textContent = "still";
    schedule();
    return;
  }
  animRAF = requestAnimationFrame(tick);
  if(recording) return;
  const loopMs = Math.max(P.looplen,0.5)*1000;
  phase = (((now - animT0) % loopMs)/loopMs)*Math.PI*2;
  paint();
  const dt = now - lastFrame; lastFrame = now;
  if(dt > 0) fpsEma = fpsEma ? fpsEma*0.9 + (1000/dt)*0.1 : 1000/dt;
  document.getElementById("stFps").textContent = Math.round(fpsEma)+" fps";
}

let msgTimer = 0;
function msg(text){
  stMsg.textContent = text;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(()=>{ stMsg.textContent=""; }, 5000);
}

/* Every picker is a contact sheet rendered in the user's own palette, so the
   shapes preview the current plate and the plates preview the current colours. */
let thumbTimer = 0, plateSig = "";
const TW = 96, TH = 128;
function refreshThumbs(){
  if(!drawThumb) return;
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(()=>{
    const ps = TW / P.W;
    document.querySelectorAll(".shapes img").forEach((img,i)=>{
      drawThumb(Object.assign({}, P, {shape:i}), TW, TH, ps, 0);
      img.src = thumbCanvas.toDataURL("image/png");
    });
    // plate tiles only depend on colour and grain, so skip the work when neither moved
    const sig = [P.c0,P.c1,P.c2,P.mid,P.chroma,P.grain,P.gsize,P.gdens,P.gresp,P.W,P.H].join("|");
    if(sig === plateSig) return;
    plateSig = sig;
    RECIPES.forEach((r,i)=>{
      const q = Object.assign({}, P);
      for(const k of LOOK) q[k] = (k in r.p) ? r.p[k] : DEFAULTS[k];
      drawThumb(q, TW, TH, ps, 0);
      const src = thumbCanvas.toDataURL("image/png");
      document.querySelectorAll('[data-plate="'+i+'"] img').forEach(img => { img.src = src; });
    });
  }, 200);
}
