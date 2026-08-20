/* ============================== renderer ============================== */
/* @shader VERT */

/* @shader FRAG */

function hex2rgb(h){
  const n = parseInt(h.slice(1),16);
  return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255];
}

function makeRenderer(canvas){
  const gl = canvas.getContext("webgl2",{preserveDrawingBuffer:true,antialias:false,alpha:false});
  if(!gl) return null;
  const sh = (type,src)=>{
    const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER,VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER,FRAG));
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const va = gl.createVertexArray(); gl.bindVertexArray(va);
  const warned = {};
  const loc = {}, U = n => (loc[n] !== undefined ? loc[n] : (loc[n]=gl.getUniformLocation(prog,n)));

  return function draw(p, w, h, ps, phase){
    if(canvas.width!==w || canvas.height!==h){ canvas.width=w; canvas.height=h; }
    gl.viewport(0,0,w,h);
    gl.useProgram(prog);
    gl.uniform2f(U("uRes"), w, h);
    gl.uniform1f(U("uPS"), ps);
    gl.uniform1f(U("uSeed"), p.seed);
    gl.uniform1i(U("uShape"), p.shape|0);
    gl.uniform1i(U("uTex"), p.tex|0);
    gl.uniform1i(U("uInvert"), p.invert?1:0);
    gl.uniform1i(U("uChroma"), p.chroma?1:0);
    const f = (n,v)=>{
      if(!Number.isFinite(v)){
        if(!warned[n]){ warned[n]=1; console.warn("Emulsion: uniform "+n+" got "+v+" — check DEFAULTS"); }
        v = 0;
      }
      gl.uniform1f(U(n), v);
    };
    f("uScale",p.scale); f("uAngle",p.angle); f("uSoft",p.soft); f("uWarp",p.warp);
    f("uDetail",p.detail); f("uMottle",p.mottle); f("uPosX",p.posx); f("uPosY",p.posy);
    f("uExp",p.exposure); f("uCon",p.contrast); f("uBlack",p.black); f("uGam",p.gamma); f("uVig",p.vignette);
    f("uTexAmt",p.texamt); f("uTexScale",p.texscale);
    f("uGrain",p.grain); f("uGSize",p.gsize); f("uGDens",p.gdens); f("uGResp",p.gresp);
    f("uBands",p.bands); f("uBlur",p.blur); f("uStreak",p.streak); f("uStreakAng",p.streakang);
    f("uGloss",p.gloss);
    f("uPhase", phase||0); f("uMotion", p.flow);
    f("uMid",p.mid);
    gl.uniform3fv(U("uC0"), hex2rgb(p.c0));
    gl.uniform3fv(U("uC1"), hex2rgb(p.c1));
    gl.uniform3fv(U("uC2"), hex2rgb(p.c2));
    gl.drawArrays(gl.TRIANGLES,0,3);
  };
}
