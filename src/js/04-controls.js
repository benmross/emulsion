/* ============================== control factory ============================== */
function el(tag, cls, parent){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(parent) parent.appendChild(n);
  return n;
}
const SECTIONS = [];
function section(title){
  const s = el("section","sec",rail);
  s.dataset.sec = title;
  SECTIONS.push(s);
  el("h2",null,s).textContent = title;
  return el("div","stack",s);
}
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
function segmented(host, key, options, onAfter){
  const seg = el("div","seg",host);
  seg.setAttribute("role","group");
  const btns = options.map((o,i)=>{
    const b = el("button",null,seg);
    b.type="button"; b.textContent=o;
    b.addEventListener("click", ()=>{ P[key]=i; sync(); schedule(); if(onAfter) onAfter(); });
    return b;
  });
  const sync = ()=> btns.forEach((b,i)=> b.setAttribute("aria-pressed", P[key]===i ? "true":"false"));
  binders.push(sync); sync();
}

/* ============================== rail ============================== */
const gRecipes = section("Recipes");
const recipeBar = el("div","recipes",gRecipes);
recipeBar.setAttribute("role","group");
recipeBar.setAttribute("aria-label","Recipes");

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
}
binders.push(syncShapes); syncShapes();

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
const recBtn = el("button","btn wide",gMotion);
recBtn.type="button"; recBtn.textContent="Record loop";
const recNote = el("p","hint",gMotion);
recNote.textContent = "The loop is seamless: the field travels a closed path and returns to frame one.";

const gTone = section("Tone");
slider(gTone,"exposure","Exposure",-2,2,0.01, v=>(v>0?"+":"")+v.toFixed(2)+" EV", refreshThumbs);
slider(gTone,"contrast","Contrast",0.3,3,0.01, v=>v.toFixed(2), refreshThumbs);
slider(gTone,"black","Black point",0,0.6,0.005, pct, refreshThumbs);
slider(gTone,"gamma","Gamma",0.4,2.4,0.01, v=>v.toFixed(2), refreshThumbs);
slider(gTone,"gloss","Gloss",0,1,0.01, pct, refreshThumbs);
slider(gTone,"vignette","Vignette",0,1,0.01, pct, refreshThumbs);

const gColor = section("Palette");
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
}
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
slider(gColor,"mid","Mid stop",0.1,0.9,0.005, pct, refreshThumbs);
toggle(gColor,"invert","Invert tones", refreshThumbs);

const gGrain = section("Grain");
slider(gGrain,"grain","Amount",0,0.6,0.005, pct, refreshThumbs);
slider(gGrain,"gsize","Grain size",0.5,8,0.05, v=>v.toFixed(2)+" px", refreshThumbs);
slider(gGrain,"gdens","Density",0.02,1,0.005, pct, refreshThumbs);
slider(gGrain,"gresp","Midtone bias",0,1,0.01, pct, refreshThumbs);
toggle(gGrain,"chroma","Color grain", refreshThumbs);

const gTex = section("Surface");
segmented(gTex,"tex",["None","Dash","Brush","Weave","Dots"], refreshThumbs);
slider(gTex,"texamt","Depth",0,1,0.01, pct, refreshThumbs);
slider(gTex,"texscale","Texture scale",0.2,3,0.01, v=>v.toFixed(2)+"×", refreshThumbs);

const gOut = section("Output");
const sel = el("select","sel",gOut);
SIZES.forEach((s,i)=>{ const o=el("option",null,sel); o.value=i; o.textContent=s.name; });
const oCustom = el("option",null,sel); oCustom.value="custom"; oCustom.textContent="Custom";
sel.addEventListener("change", ()=>{
  if(sel.value==="custom") return;
  const s = SIZES[parseInt(sel.value,10)];
  P.W=s.w; P.H=s.h; syncDims(); schedule(); refreshThumbs();
});
const dims = el("div","dims",gOut);
function dimField(key,label){
  const f = el("div","field",dims);
  el("span",null,f).textContent = label;
  const i = el("input",null,f);
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
  const idx = SIZES.findIndex(s=>s.w===P.W && s.h===P.H);
  sel.value = idx>=0 ? String(idx) : "custom";
  dims.querySelectorAll("input").forEach((i,n)=> i.value = n===0 ? P.W : P.H);
  updateStatus();
}
binders.push(syncDims);

const seedRow = el("div","seedrow",gOut);
const seedField = el("div","field",seedRow);
el("span",null,seedField).textContent = "Seed";
const seedInput = el("input",null,seedField);
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
el("span",null,fmtField).textContent = "File format";
const fmtSel = el("select","sel",fmtField);
[["png","PNG · lossless"],["webp","WebP · small"],["jpeg","JPEG · smallest"]].forEach(([v,t])=>{
  const o = el("option",null,fmtSel); o.value=v; o.textContent=t;
});
fmtSel.value = P.fmt;
fmtSel.addEventListener("change", ()=>{ P.fmt = fmtSel.value; });
binders.push(()=>{ fmtSel.value = P.fmt; });

const setRow = el("div","pair",gOut);
const setField = el("div","field",setRow);
el("span",null,setField).textContent = "Set size";
const setSel = el("select","sel",setField);
[4,6,8,12].forEach(n=>{ const o=el("option",null,setSel); o.value=n; o.textContent=n+" stills"; });
setSel.value = P.setsize;
setSel.addEventListener("change", ()=>{ P.setsize = parseInt(setSel.value,10); });
binders.push(()=>{ setSel.value = P.setsize; });
const setBtn = el("button","btn",setRow);
setBtn.type="button"; setBtn.textContent="Export set";

const hint = el("p","hint",gOut.parentElement);
hint.innerHTML = 'Grain is measured in <em>output</em> pixels — the preview scales it to match, so a 1&nbsp;px grain stays 1&nbsp;px in the export. <b>Export set</b> writes a batch of seeds for an iPhone Photo&nbsp;Shuffle album; <b>Record loop</b> writes a video for a Live&nbsp;Photo lock screen. Press <kbd>R</kbd> to reshuffle.';

/* ---------- one group at a time on small screens ---------- */
const tabsEl = document.getElementById("tabs");
SECTIONS.forEach((sec,i)=>{
  const b = el("button","tab",tabsEl);
  b.type="button"; b.textContent = sec.dataset.sec;
  b.setAttribute("role","tab");
  b.addEventListener("click", ()=> setTab(i));
});
function setTab(i){
  SECTIONS.forEach((s,n)=> s.classList.toggle("on", n===i));
  tabsEl.querySelectorAll(".tab").forEach((b,n)=> b.setAttribute("aria-selected", n===i ? "true":"false"));
  const active = tabsEl.querySelector('.tab[aria-selected="true"]');
  if(active && active.scrollIntoView) active.scrollIntoView({block:"nearest", inline:"nearest"});
  rail.scrollTop = 0;
}
setTab(0);
