/* ============================== control factory ============================== */
function el(tag, cls, parent){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(parent) parent.appendChild(n);
  return n;
}
const SVG = d => '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" '
  + 'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const ICONS = {
  Recipes: SVG('<path d="M8 1.6 1.8 4.7 8 7.8l6.2-3.1L8 1.6Z"/><path d="M1.8 8 8 11.1 14.2 8"/><path d="M1.8 11.3 8 14.4l6.2-3.1"/>'),
  Form:    SVG('<path d="M9.6 1.9c2.6.7 4.2 3.2 3.9 6-.3 3.1-2.6 6.2-5.2 6.2-2.4 0-4.2-2.4-4.2-5.3 0-3.6 2.4-7.7 5.5-6.9Z"/>'),
  Optics:  SVG('<circle cx="8" cy="8" r="6.2"/><path d="M8 1.8 11.6 8M8 14.2 4.4 8M13.4 5.5 6.2 6.4M2.6 10.5l7.2-.9M13 11.2 9.4 5M3 4.8l3.6 6.2"/>'),
  Motion:  SVG('<path d="M1.8 5.4c1.6-2.4 3.1-2.4 4.7 0s3.1 2.4 4.7 0 3.1-2.4 3-.6"/><path d="M1.8 10.6c1.6-2.4 3.1-2.4 4.7 0s3.1 2.4 4.7 0 3.1-2.4 3-.6"/>'),
  Tone:    SVG('<circle cx="8" cy="8" r="6.2"/><path d="M8 1.8a6.2 6.2 0 0 1 0 12.4Z" fill="currentColor" stroke="none"/>'),
  Color:   SVG('<path d="M8 1.8s4.3 4.9 4.3 7.6A4.3 4.3 0 0 1 8 13.9a4.3 4.3 0 0 1-4.3-4.5C3.7 6.7 8 1.8 8 1.8Z"/>'),
  Grain:   SVG('<circle cx="4" cy="4.2" r=".9"/><circle cx="11.4" cy="3.6" r=".9"/><circle cx="7.6" cy="7.4" r=".9"/><circle cx="3.4" cy="11" r=".9"/><circle cx="12" cy="10.6" r=".9"/><circle cx="8.2" cy="13" r=".9"/>'),
  Surface: SVG('<path d="M1.8 9.6 9.6 1.8M5.2 13.4 13.4 5.2M1.8 14.2 3.2 12.8M12.4 2.6l1.8-1.8"/>'),
  Output:  SVG('<path d="M8 1.9v7.4m0 0 2.8-2.8M8 9.3 5.2 6.5"/><path d="M2.4 11v2.2c0 .5.4.9.9.9h9.4c.5 0 .9-.4.9-.9V11"/>')
};
const CHEVRON = SVG('<path d="M4 6.2 8 10l4-3.8"/>');

/* A picker that scrolls sideways on a phone keeps its selection in sight;
   on a desktop it does not overflow, so this is a no-op there. */
function centerIn(host){
  const on = host.querySelector('[aria-pressed="true"]');
  if(on && on.scrollIntoView && host.scrollWidth > host.clientWidth + 4)
    on.scrollIntoView({block:"nearest", inline:"center"});
}

const SECTIONS = [];
function section(title){
  const s = el("section","sec",sheetBody);
  s.dataset.sec = title;
  SECTIONS.push(s);
  const h = el("h2",null,s);
  const head = el("button","sechead",h);
  head.type = "button";
  head.setAttribute("aria-expanded","true");
  head.innerHTML = '<span class="ico">'+(ICONS[title]||"")+'</span>'
                 + '<span class="lbl">'+title+'</span>'
                 + '<span class="hr"></span>'
                 + '<span class="chev">'+CHEVRON+'</span>';
  head.addEventListener("click", ()=>{
    const collapsed = s.classList.toggle("collapsed");
    head.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });
  const stack = el("div","stack",s);
  stack.dataset.sec = title;
  return stack;
}

/* Controls that carry no label of their own get one, shown only on a phone —
   in the rail the section heading and the control itself already say enough.
   The wrapper is display:contents there, so the desktop layout is untouched. */
function named(label, node){
  const wrap = el("div","orow");
  node.parentNode.insertBefore(wrap, node);
  el("span","oplbl",wrap).textContent = label;
  wrap.appendChild(node);
  return node;
}
/* One shared touch controller serves every slider.  This preserves tap-anywhere
   tracks without installing dozens of non-passive listeners on window. */
const TOUCH_SLIDERS = new WeakMap();
let touchRange = null;
const rangeTouch = (event)=>{
  if(!touchRange) return null;
  return Array.from(event.changedTouches).find(t=>t.identifier===touchRange.id) || null;
};
const setRangeFromTouch = (touch)=>{
  const {input,min,max,step} = touchRange;
  const box=input.getBoundingClientRect();
  const f=Math.max(0,Math.min(1,(touch.clientX-box.left)/Math.max(box.width,1)));
  input.value=Math.max(min,Math.min(max,min+Math.round((min+f*(max-min)-min)/step)*step));
  input.dispatchEvent(new Event("input",{bubbles:true}));
};
window.addEventListener("touchmove",event=>{
  const t=rangeTouch(event); if(!t) return;
  const dx=t.clientX-touchRange.x, dy=t.clientY-touchRange.y;
  if(!touchRange.drag && Math.max(Math.abs(dx),Math.abs(dy))<6) return;
  if(!touchRange.drag && Math.abs(dy)>Math.abs(dx)){ touchRange=null; return; }
  touchRange.drag=true; setRangeFromTouch(t); event.preventDefault();
},{passive:false});
window.addEventListener("touchend",event=>{
  const t=rangeTouch(event); if(!t) return;
  if(!touchRange.drag) setRangeFromTouch(t); touchRange=null;
});
window.addEventListener("touchcancel",()=>{ touchRange=null; });

function slider(host, key, label, min, max, step, fmt, onAfter){
  const row = el("div","row",host);
  const top = el("div","top",row);
  const lab = el("label",null,top);
  const val = el("span","val",top);
  const inp = el("input",null,row);
  const id = "c_"+key;
  inp.type="range"; inp.min=min; inp.max=max; inp.step=step; inp.id=id;
  lab.textContent = label; lab.setAttribute("for", id);
  const sync = ()=>{ inp.value = P[key]; val.textContent = fmt(P[key]); };
  inp.addEventListener("input", ()=>{
    P[key] = parseFloat(inp.value);
    val.textContent = fmt(P[key]);
    schedule();
    if(onAfter) onAfter();
  });
  /* Some mobile browsers only begin a range interaction when the thumb itself
     is touched.  Map a touch anywhere on the track to its matching value so
     users can tap or drag directly to the setting they want. */
  TOUCH_SLIDERS.set(inp,{min,max,step});
  inp.addEventListener("touchstart",event=>{
    const t=event.changedTouches[0], cfg=TOUCH_SLIDERS.get(inp); if(!t||!cfg) return;
    touchRange={input:inp,id:t.identifier,x:t.clientX,y:t.clientY,drag:false,...cfg};
  },{passive:true});
  binders.push(sync); sync();
  return row;
}
function toggle(host, key, label, onAfter){
  const row = el("div","toggle",host);
  el("span",null,row).textContent = label;
  const b = el("button","switch",row);
  b.type="button"; b.setAttribute("aria-label",label);
  const sync = ()=> b.setAttribute("aria-pressed", P[key] ? "true":"false");
  b.addEventListener("click", ()=>{ P[key] = !P[key]; sync(); schedule(); if(onAfter) onAfter(); });
  binders.push(sync); sync();
}
function segmented(host, key, label, options, onAfter){
  const seg = el("div","seg",host);
  seg.setAttribute("role","group"); seg.setAttribute("aria-label",label);
  const btns = options.map((o,i)=>{
    const b = el("button",null,seg);
    b.type="button"; b.textContent=o;
    b.addEventListener("click", ()=>{ P[key]=i; sync(); schedule(); if(onAfter) onAfter(); });
    return b;
  });
  const sync = ()=> btns.forEach((b,i)=> b.setAttribute("aria-pressed", P[key]===i ? "true":"false"));
  binders.push(sync); sync();
  named(label, seg);
}

/* ============================== rail ============================== */
const gRecipes = section("Recipes");
const platesEl = el("div","plates",gRecipes);
platesEl.setAttribute("role","group");
platesEl.setAttribute("aria-label","Plates");

const gForm = section("Form");

const shapes = el("div","shapes",gForm);
SHAPES.forEach((s,i)=>{
  const b = el("button",null,shapes);
  b.type="button"; b.title = s.hint;
  const img = el("img",null,b); img.alt = s.name;
  el("span",null,b).textContent = s.name;
  b.addEventListener("click", ()=>{ P.shape=i; activeRecipe=-1; syncShapes(); syncRecipes(); schedule(); });
});
function syncShapes(){
  shapes.querySelectorAll("button").forEach((b,i)=> b.setAttribute("aria-pressed", P.shape===i?"true":"false"));
  centerIn(shapes);
}
binders.push(syncShapes); syncShapes();
named("Shape", shapes);

const pct = v => Math.round(v*100)+"%";
slider(gForm,"scale","Scale",0.25,4,0.01, v=>v.toFixed(2)+"×", refreshThumbs);
slider(gForm,"angle","Rotation",-180,180,1, v=>v.toFixed(0)+"°", refreshThumbs);
slider(gForm,"soft","Edge softness",0.03,1,0.005, pct, refreshThumbs);
slider(gForm,"warp","Warp",0,1.5,0.01, v=>v.toFixed(2), refreshThumbs);
slider(gForm,"detail","Detail",1,6,0.05, v=>v.toFixed(1)+" oct", refreshThumbs);
slider(gForm,"mottle","Mottle",0,1,0.01, pct, refreshThumbs);
slider(gForm,"bands","Ripples",0.4,8,0.05, v=>v.toFixed(2), refreshThumbs);
slider(gForm,"posx","Offset X",-1.5,1.5,0.01, v=>v.toFixed(2), refreshThumbs);
slider(gForm,"posy","Offset Y",-1.5,1.5,0.01, v=>v.toFixed(2), refreshThumbs);

const gOptics = section("Optics");
slider(gOptics,"blur","Blur",0,1,0.005, pct, refreshThumbs);
slider(gOptics,"streak","Streak",0,1,0.01, pct, refreshThumbs);
slider(gOptics,"streakang","Streak angle",-180,180,1, v=>v.toFixed(0)+"°", refreshThumbs);

const gMotion = section("Motion");
toggle(gMotion,"animate","Animate", ()=> setAnimating(P.animate));
slider(gMotion,"flow","Flow",0,1,0.01, pct, refreshThumbs);
slider(gMotion,"looplen","Loop length",1,12,0.5, v=>v.toFixed(1)+" s");
const fpsField = el("div","field",gMotion);
el("span",null,fpsField).textContent = "Frame rate";
const fpsSel = el("select","sel",fpsField);
fpsSel.id="fps"; fpsSel.setAttribute("aria-label","Frame rate");
[24,30,60].forEach(v=>{ const o=el("option",null,fpsSel); o.value=v; o.textContent=v+" fps"; });
fpsSel.addEventListener("change", ()=>{ P.fps = parseInt(fpsSel.value,10); });
binders.push(()=>{ fpsSel.value = P.fps; });

const recBtn = el("button","btn wide",gMotion);
recBtn.type="button"; recBtn.textContent="Record loop";
/* only ever carries the "this browser can't encode video" line */
const recNote = el("p","hint",gMotion);
recNote.hidden = true;

const gTone = section("Tone");
slider(gTone,"exposure","Exposure",-2,2,0.01, v=>(v>0?"+":"")+v.toFixed(2)+" EV", refreshThumbs);
slider(gTone,"contrast","Contrast",0.3,3,0.01, v=>v.toFixed(2), refreshThumbs);
slider(gTone,"black","Black point",0,0.6,0.005, pct, refreshThumbs);
slider(gTone,"gamma","Gamma",0.4,2.4,0.01, v=>v.toFixed(2), refreshThumbs);
slider(gTone,"gloss","Gloss",0,1,0.01, pct, refreshThumbs);
slider(gTone,"vignette","Vignette",0,1,0.01, pct, refreshThumbs);

const gColor = section("Color");
const pals = el("div","palettes",gColor);
PALETTES.forEach(p=>{
  const b = el("button","pal",pals);
  b.type="button";
  const i = el("i",null,b);
  i.style.background = "linear-gradient(90deg,"+p.c[0]+","+p.c[1]+","+p.c[2]+")";
  el("span",null,b).textContent = p.name;
  b.addEventListener("click", ()=>{ P.c0=p.c[0]; P.c1=p.c[1]; P.c2=p.c[2]; syncPals(); schedule(); refreshThumbs(); });
});
function syncPals(){
  pals.querySelectorAll(".pal").forEach((b,i)=>{
    const p = PALETTES[i];
    b.setAttribute("aria-pressed",
      (p.c[0].toLowerCase()===P.c0.toLowerCase() && p.c[1].toLowerCase()===P.c1.toLowerCase()
       && p.c[2].toLowerCase()===P.c2.toLowerCase()) ? "true":"false");
  });
  centerIn(pals);
}
named("Palette", pals);

const ramp = el("div","ramp",gColor);
[["c0","Shadow"],["c1","Mid"],["c2","Light"]].forEach(([key,tag])=>{
  const w = el("label","sw",ramp);
  const inp = el("input",null,w); inp.type="color";
  el("span","tag",w).textContent = tag;
  const sync = ()=>{ inp.value = P[key]; w.style.background = P[key]; };
  inp.addEventListener("input", ()=>{ P[key]=inp.value; w.style.background=inp.value; syncPals(); schedule(); refreshThumbs(); });
  binders.push(sync); sync();
});
binders.push(syncPals); syncPals();
named("Color stops", ramp);
slider(gColor,"mid","Mid stop",0.1,0.9,0.005, pct, refreshThumbs);
toggle(gColor,"invert","Invert tones", refreshThumbs);

const gGrain = section("Grain");
slider(gGrain,"grain","Amount",0,0.6,0.005, pct, refreshThumbs);
slider(gGrain,"gsize","Grain size",0.5,8,0.05, v=>v.toFixed(2)+" px", refreshThumbs);
slider(gGrain,"gdens","Density",0.02,1,0.005, pct, refreshThumbs);
slider(gGrain,"gresp","Midtone bias",0,1,0.01, pct, refreshThumbs);
toggle(gGrain,"chroma","Color grain", refreshThumbs);

const gTex = section("Surface");
segmented(gTex,"tex","Texture",["None","Dash","Brush","Weave","Dots"], refreshThumbs);
slider(gTex,"texamt","Depth",0,1,0.01, pct, refreshThumbs);
slider(gTex,"texscale","Texture scale",0.2,3,0.01, v=>v.toFixed(2)+"×", refreshThumbs);

const gOut = section("Output");
const sizeBox = el("div","group",gOut);
const sel = el("select","sel",sizeBox);
sel.id="output-size"; sel.setAttribute("aria-label","Output size preset");
SIZES.forEach(group=>{
  const g = el("optgroup",null,sel);
  g.label = group.group;
  group.items.forEach(item=>{
    const o = el("option",null,g);
    o.value = item.w+"x"+item.h;
    o.textContent = item.w+" × "+item.h+" — "+item.name;
  });
});
const oCustom = el("option",null,sel); oCustom.value="custom"; oCustom.textContent="Custom";
sel.addEventListener("change", ()=>{
  if(sel.value==="custom") return;
  const [w,h] = sel.value.split("x").map(Number);
  P.W=w; P.H=h; syncDims(); schedule(); refreshThumbs();
});
const dims = el("div","dims",sizeBox);
named("Size", sizeBox);
function dimField(key,label){
  const f = el("div","field",dims);
  const lab=el("label",null,f); lab.textContent = label;
  const i = el("input",null,f);
  i.id="dimension-"+key.toLowerCase(); lab.htmlFor=i.id;
  i.type="number"; i.min=64; i.max=8192; i.step=1;
  const sync = ()=> i.value = P[key];
  i.addEventListener("change", ()=>{
    let v = Math.round(parseFloat(i.value)||0);
    v = Math.max(64, Math.min(8192, v));
    P[key]=v; i.value=v; syncDims(); schedule(); refreshThumbs();
  });
  binders.push(sync); sync();
}
dimField("W","Width");
el("div","x",dims).textContent = "×";
dimField("H","Height");
function syncDims(){
  const key = P.W+"x"+P.H;
  sel.value = sel.querySelector('option[value="'+key+'"]') ? key : "custom";
  dims.querySelectorAll("input").forEach((i,n)=> i.value = n===0 ? P.W : P.H);
  updateStatus();
}
binders.push(syncDims);

const seedRow = el("div","seedrow",gOut);
const seedField = el("div","field",seedRow);
const seedLabel=el("label",null,seedField); seedLabel.textContent = "Seed";
const seedInput = el("input",null,seedField);
seedInput.id="seed"; seedLabel.htmlFor=seedInput.id;
seedInput.type="number"; seedInput.min=0; seedInput.max=9999; seedInput.step=1;
const syncSeed = ()=> seedInput.value = Math.round(P.seed*10000);
seedInput.addEventListener("change", ()=>{
  const v = Math.max(0, Math.min(9999, Math.round(parseFloat(seedInput.value)||0)));
  P.seed = v/10000; seedInput.value = v; schedule(); refreshThumbs();
});
binders.push(syncSeed); syncSeed();
const newSeed = el("button","btn",seedRow);
newSeed.type="button"; newSeed.textContent="New seed";
newSeed.addEventListener("click", ()=>{ P.seed = Math.round(Math.random()*9999)/10000; syncSeed(); schedule(); refreshThumbs(); });

toggle(gOut,"guides","Lock screen guides", ()=> frame.classList.toggle("guided", P.guides));
binders.push(()=> frame.classList.toggle("guided", !!P.guides));

const fmtField = el("div","field",gOut);
const fmtLabel=el("label",null,fmtField); fmtLabel.textContent = "File format";
const fmtSel = el("select","sel",fmtField);
fmtSel.id="file-format"; fmtLabel.htmlFor=fmtSel.id;
[["png","PNG · lossless"],["webp","WebP · small"],["jpeg","JPEG · smallest"]].forEach(([v,t])=>{
  const o = el("option",null,fmtSel); o.value=v; o.textContent=t;
});
fmtSel.value = P.fmt;
fmtSel.addEventListener("change", ()=>{ P.fmt = fmtSel.value; });
binders.push(()=>{ fmtSel.value = P.fmt; });

const setRow = el("div","pair",gOut);
const setField = el("div","field",setRow);
const setLabel=el("label",null,setField); setLabel.textContent = "Set size";
const setSel = el("select","sel",setField);
setSel.id="set-size"; setLabel.htmlFor=setSel.id;
[4,6,8,12].forEach(n=>{ const o=el("option",null,setSel); o.value=n; o.textContent=n+" stills"; });
setSel.value = P.setsize;
setSel.addEventListener("change", ()=>{ P.setsize = parseInt(setSel.value,10); });
binders.push(()=>{ setSel.value = P.setsize; });
const setBtn = el("button","btn",setRow);
setBtn.type="button"; setBtn.textContent="Export set";

const linkBtn = el("button","btn wide",gOut);
linkBtn.type="button"; linkBtn.textContent="Copy link to this look";

/* ---------- one group at a time on small screens ----------
   The tab bar is permanent and the group's own controls sit right above it:
   label on the left, the slider, switch or picker on the right. Recipes is the
   one group that shows something else — the plate strip, scrolling sideways. */
const tabsEl = document.getElementById("tabs");
const strip  = document.getElementById("peekplates");

SECTIONS.forEach((sec,i)=>{
  const b = el("button","tab",tabsEl);
  b.type="button";
  b.id="category-"+i;
  b.innerHTML = '<span class="tico">'+(ICONS[sec.dataset.sec]||"")+'</span>'
              + '<span class="tlbl">'+sec.dataset.sec+'</span>';
  b.addEventListener("click", ()=> setTab(i));
});

/* The handle trades the controls for more picture; the tab bar always stays. */
const grabEl = document.getElementById("grab");
function setMin(min){
  document.body.classList.toggle("sheet-min", min);
  grabEl.setAttribute("aria-expanded", min ? "false" : "true");
  grabEl.setAttribute("aria-label", min ? "Show the controls" : "Collapse the controls");
}

function setTab(i){
  setMin(false);              // a tapped category always shows its contents
  SECTIONS.forEach((s,n)=>{ s.classList.toggle("on", n===i); s.scrollTop = 0; });
  tabsEl.querySelectorAll(".tab").forEach((b,n)=>{
    b.setAttribute("aria-pressed", n===i ? "true":"false"); b.tabIndex=n===i?0:-1;
  });
  strip.hidden = SECTIONS[i].dataset.sec !== "Recipes";
  const active = tabsEl.querySelector('.tab[aria-pressed="true"]');
  if(active && active.scrollIntoView) active.scrollIntoView({block:"nearest", inline:"center"});
  rail.scrollTop = 0;
}
tabsEl.addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
  const all=Array.from(tabsEl.querySelectorAll(".tab"));
  let i=all.indexOf(document.activeElement);
  if(event.key==="Home") i=0; else if(event.key==="End") i=all.length-1;
  else i=(i+(event.key==="ArrowRight"?1:-1)+all.length)%all.length;
  event.preventDefault(); setTab(i); all[i].focus();
});
setTab(0);
