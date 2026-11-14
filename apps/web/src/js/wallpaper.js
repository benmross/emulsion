/* ============================== wallpaper page ==============================
   One finished look per page. The image on the page is a preview; the download
   is rendered here from the same recipe at the size of the visitor's screen.
   Shares 01-data.js, the renderer and the look codec with the studio. */
(()=>{
  const sizeEl=document.getElementById("size"), dl=document.getElementById("download"),
        save=document.getElementById("save"), status=document.getElementById("status"),
        fallback=document.getElementById("fallback");
  const say=t=>{ status.textContent=t; };
  const ping=kind=>{ try{ navigator.sendBeacon("/go/"+kind+"/"+WALL.slug); }catch(e){} };

  /* Phones and tablets only: a landscape canvas changes the composition. */
  const options=[];
  for(const g of SIZES) if(g.group==="Phone"||g.group==="Tablet") for(const s of g.items) options.push(s);
  const dpr=window.devicePixelRatio||1;
  const sw=Math.round(Math.min(screen.width,screen.height)*dpr), sh=Math.round(Math.max(screen.width,screen.height)*dpr);
  const mobile=matchMedia("(pointer:coarse)").matches;
  let pick=options.findIndex(s=>s.w===sw&&s.h===sh);
  if(pick<0 && mobile && sw>=600 && sh>=1000 && sw<=2048 && sh<=3200){
    options.unshift({w:sw,h:sh,name:"This screen"}); pick=0;
  }
  if(pick<0) pick=options.findIndex(s=>s.w===1290&&s.h===2796);
  options.forEach((s,i)=>{
    const o=document.createElement("option");
    o.value=i; o.textContent=s.w+" × "+s.h+" · "+s.name; sizeEl.appendChild(o);
  });
  sizeEl.value=pick;

  if(!decodeState(WALL.state)){ dl.disabled=true; fallback.hidden=false; return; }
  const look=Object.assign({},P);

  let prepared=null;
  sizeEl.addEventListener("change",()=>{ prepared=null; save.hidden=true; dl.hidden=false; say(""); });

  function render(w,h){
    const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
    const draw=makeRenderer(canvas);
    if(!draw) throw new Error("This browser can't run WebGL2.");
    try{
      const max=Math.min(draw.limits.texture,draw.limits.viewport[0],draw.limits.viewport[1]);
      if(w>max||h>max) throw new Error("This device can render up to "+max+" pixels per side.");
      draw(Object.assign({},look,{W:w,H:h}),w,h,1);
      return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error("Couldn't create the image.")),"image/png"));
    } finally { setTimeout(()=>{ draw.dispose(); canvas.width=1; canvas.height=1; },0); }
  }
  function saveFile(blob,name){
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }

  dl.addEventListener("click",async()=>{
    const s=options[+sizeEl.value];
    dl.disabled=true; say("Rendering "+s.w+" × "+s.h+"…");
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    try{
      const blob=await render(s.w,s.h), name="emulsion-"+WALL.slug+"-"+s.w+"x"+s.h+".png";
      ping("download");
      const file=typeof File!=="undefined"?new File([blob],name,{type:"image/png"}):null;
      /* iOS only reaches Photos through the share sheet, and that needs a fresh tap. */
      if(file && navigator.canShare && navigator.canShare({files:[file]}) && mobile){
        prepared=file; dl.hidden=true; save.hidden=false;
        say("Ready. Tap Save to Photos, then choose Save Image.");
      } else { saveFile(blob,name); say("Saved "+name+"."); }
    } catch(err){
      console.error(err); say((err&&err.message)||"Rendering failed."); fallback.hidden=false;
    } finally { dl.disabled=false; }
  });
  save.addEventListener("click",async()=>{
    if(!prepared) return;
    try{ await navigator.share({files:[prepared]}); say("Done."); }
    catch(err){ if(!(err&&err.name==="AbortError")){ saveFile(prepared,prepared.name); say("Saved "+prepared.name+"."); } }
  });
})();
