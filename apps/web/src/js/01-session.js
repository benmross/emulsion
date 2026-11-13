/* Local-only sessions. The key stays stable across releases and / -> /app/ moves. */
const SESSION_KEY = "emulsion.session.v1";
let sessionReady = false, history = [], cursor = 0, currentCategory = 0, editTimer = 0;
function snapshot(){ return {params:{...P},activeRecipe}; }
function sameSnapshot(a,b){ return JSON.stringify(a)===JSON.stringify(b); }
function cleanParams(raw){
  const out={...DEFAULTS};
  if(!raw || typeof raw!=="object") return out;
  for(const [k,def] of Object.entries(DEFAULTS)){
    const v=raw[k];
    if(typeof def==="number"){
      const range=STATE_RANGE[k];
      if(typeof v==="number" && Number.isFinite(v)){
        const n=range?Math.max(range[0],Math.min(range[1],v)):v;
        out[k]=range?.[2]?Math.round(n):n;
      }
    } else if(typeof def==="boolean") out[k]=typeof v==="boolean"?v:def;
    else if(k==="fmt") out[k]=["png","webp","jpeg"].includes(v)?v:def;
    else if(/^#[0-9a-f]{6}$/i.test(v)) out[k]=v;
  }
  out.setsize=[4,6,8,12].includes(out.setsize)?out.setsize:6;
  return out;
}
function restoreSession(){
  try {
    const saved=JSON.parse(localStorage.getItem(SESSION_KEY));
    if(saved?.version===1 && Array.isArray(saved.history) && saved.history.length){
      history=saved.history.slice(-80).map(s=>({params:cleanParams(s.params),activeRecipe:Number.isInteger(s.activeRecipe)&&s.activeRecipe>=0&&s.activeRecipe<RECIPES.length?s.activeRecipe:-1}));
      cursor=Math.max(0,Math.min(history.length-1,Number.isInteger(saved.cursor)?saved.cursor:history.length-1));
      currentCategory=Number.isInteger(saved.category)?Math.max(0,Math.min(7,saved.category)):0;
      Object.assign(P,history[cursor].params); activeRecipe=history[cursor].activeRecipe;
    }
  } catch(e){ /* A full or disabled store never prevents editing. */ }
  if(!history.length){ history=[snapshot()]; cursor=0; }
}
function syncHistory(){
  const pending=history.length && !sameSnapshot(history[cursor],snapshot());
  document.querySelectorAll('[data-history="undo"]').forEach(b=>b.disabled=recording || (!pending && cursor===0));
  document.querySelectorAll('[data-history="redo"]').forEach(b=>b.disabled=recording || pending || cursor>=history.length-1);
}
function persistSession(){
  if(!sessionReady) return;
  let h=history.slice(), c=cursor;
  if(!sameSnapshot(h[c],snapshot())){ h=h.slice(0,c+1); h.push(snapshot()); c=h.length-1; }
  if(h.length>80){ const extra=h.length-80; h=h.slice(extra); c-=extra; }
  try {
    localStorage.setItem(SESSION_KEY,JSON.stringify({version:1,history:h,cursor:c,category:currentCategory}));
    document.getElementById("sessionStatus").textContent="Saved on this device";
  } catch(e){ document.getElementById("sessionStatus").textContent="Session saving unavailable"; }
}
function commitEdit(){
  clearTimeout(editTimer);
  if(!sessionReady || recording) return;
  if(!sameSnapshot(history[cursor],snapshot())){
    history=history.slice(0,cursor+1); history.push(snapshot());
    if(history.length>80) history.shift();
    cursor=history.length-1;
  }
  syncHistory(); persistSession();
}
function noteEdit(){
  clearTimeout(editTimer); syncHistory(); persistSession();
  editTimer=setTimeout(commitEdit,500);
}
function stepHistory(delta){
  if(recording) return;
  commitEdit();
  const next=cursor+delta;
  if(next<0 || next>=history.length) return;
  cursor=next; Object.assign(P,history[cursor].params); activeRecipe=history[cursor].activeRecipe;
  syncAll(); schedule(); refreshThumbs(); syncHistory(); persistSession(); flashCaption(delta<0?"Undo":"Redo");
}
function touchedLook(key){
  if(!sessionReady || !LOOK.includes(key)) return;
  activeRecipe=-1; syncRecipes();
}
