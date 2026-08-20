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
  thumbCanvas.width = 90; thumbCanvas.height = 120;
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
function render(){
  if(!draw || recording) return;
  const box = plate.getBoundingClientRect();
  const availW = Math.max(120, box.width  - 52);
  const availH = Math.max(120, box.height - 52);
  const asp = P.W / P.H;
  let dispW = Math.min(availW, availH*asp);
  let dispH = dispW / asp;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  rw = Math.round(dispW*dpr); rh = Math.round(dispH*dpr);
  const cap = P.blur > 0.02 ? 1.3e6 : 2.6e6;
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

/* thumbnails reflect the current palette + grain, so the picker reads as a contact sheet */
let thumbTimer = 0;
function refreshThumbs(){
  if(!drawThumb) return;
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(()=>{
    document.querySelectorAll(".shapes img").forEach((img,i)=>{
      const q = Object.assign({}, P, {shape:i, W:90, H:120});
      drawThumb(q, 90, 120, 90/P.W);
      img.src = thumbCanvas.toDataURL("image/png");
    });
  }, 200);
}
