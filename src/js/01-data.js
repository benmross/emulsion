/* ============================== parameters ============================== */
const DEFAULTS = {
  shape:0, scale:1.00, angle:0, soft:.30, warp:.45, detail:3.4, mottle:.35, posx:-.05, posy:0,
  bands:2, blur:0, streak:0, streakang:0,
  exposure:.05, contrast:1.35, black:.05, gamma:1, vignette:.35, gloss:0,
  c0:"#000000", c1:"#6E7076", c2:"#F2F2F0", mid:.5, invert:false,
  grain:.16, gsize:1.3, gdens:.9, gresp:.75, chroma:false,
  tex:0, texamt:.35, texscale:1,
  animate:false, flow:.35, looplen:4, fill:false,
  W:1206, H:2622, seed:.37, fmt:"png", guides:false, setsize:6
};
const P = Object.assign({}, DEFAULTS);

const SHAPES = [
  {name:"Limb",  hint:"Soft lit column"},
  {name:"Shaft", hint:"Directional light beam"},
  {name:"Satin", hint:"Folded wave bands"},
  {name:"Dune",  hint:"Ridged drifts"},
  {name:"Plume", hint:"Drifting smoke"},
  {name:"Orb",   hint:"Lit sphere"},
  {name:"Chrome",hint:"Liquid metal contours"},
  {name:"Bloom", hint:"Soft merging blobs"}
];

const PALETTES = [
  {name:"Silver",    c:["#000000","#6E7076","#F2F2F0"]},
  {name:"Platinum",  c:["#04060A","#5C6B78","#EAF2F6"]},
  {name:"Sepia",     c:["#0A0705","#6A4B32","#F4E3C8"]},
  {name:"Safelight", c:["#060302","#5A2E06","#FFCF87"]},
  {name:"Cyanotype", c:["#01060E","#1E5C87","#D9EEF7"]},
  {name:"Ember",     c:["#08040A","#7A2140","#FFD9A8"]},
  {name:"Verdigris", c:["#030706","#3C6B5C","#E6F2E4"]}
];

const RECIPES = [
  {name:"Limb",   p:{shape:0,scale:1.00,angle:0,soft:.3,warp:.45,detail:3.4,mottle:.35,posx:-.05,posy:0,
                     exposure:.05,contrast:1.35,black:.05,gamma:1,vignette:.35,
                     grain:.16,gsize:1.3,gdens:.9,gresp:.75,tex:0,mid:.5,invert:false}},
  {name:"Shaft",  p:{shape:1,scale:1.15,angle:-38,soft:.5,warp:.3,detail:3,mottle:.5,posx:-.05,posy:0,
                     exposure:0,contrast:1.35,black:.06,gamma:1.1,vignette:.2,
                     grain:.2,gsize:1.1,gdens:.95,gresp:.6,tex:1,texamt:.35,texscale:1.1,mid:.5,invert:false}},
  {name:"Satin",  p:{shape:2,scale:1.10,angle:-22,soft:.4,warp:.75,detail:3.6,mottle:.2,posx:0,posy:0,
                     exposure:0,contrast:1.2,black:.04,gamma:1,vignette:.15,
                     grain:.28,gsize:1,gdens:1,gresp:.85,tex:0,mid:.5,invert:false}},
  {name:"Dune",   p:{shape:3,scale:1.20,angle:-12,soft:.4,warp:.55,detail:4.2,mottle:.3,posx:0,posy:0,
                     exposure:-.1,contrast:1.45,black:.08,gamma:1.1,vignette:.4,
                     grain:.22,gsize:1.2,gdens:.9,gresp:.8,tex:2,texamt:.25,texscale:1,mid:.5,invert:false}},
  {name:"Plume",  p:{shape:4,scale:1.05,angle:0,soft:.4,warp:.9,detail:4.5,mottle:.25,posx:0,posy:0,
                     exposure:.2,contrast:1.3,black:.1,gamma:1.2,vignette:.45,
                     grain:.2,gsize:1.4,gdens:.85,gresp:.7,tex:0,mid:.5,invert:false}},
  {name:"Orb",    p:{shape:5,scale:1.00,angle:0,soft:.25,warp:.35,detail:3.2,mottle:.2,posx:0,posy:0,
                     exposure:.05,contrast:1.25,black:.03,gamma:1,vignette:.3,
                     grain:.18,gsize:1.5,gdens:.9,gresp:.9,tex:0,mid:.5,invert:false}},
  {name:"Chrome", p:{shape:6,scale:1.00,angle:0,soft:.4,warp:.85,detail:3.2,mottle:.15,posx:0,posy:0,
                     bands:3.0,blur:.06,streak:0,streakang:0,
                     exposure:0,contrast:1.45,black:.03,gamma:1,vignette:.15,gloss:.55,
                     grain:.12,gsize:1,gdens:.85,gresp:.5,tex:0,mid:.5,invert:false}},
  {name:"Oil",    p:{shape:6,scale:1.35,angle:20,soft:.4,warp:1.2,detail:4,mottle:.2,posx:0,posy:0,
                     bands:5.0,blur:.13,streak:0,streakang:0,
                     exposure:0,contrast:1.15,black:.02,gamma:1,vignette:.2,gloss:.3,
                     grain:.18,gsize:1.1,gdens:1,gresp:.7,tex:0,mid:.5,invert:false}},
  {name:"Bloom",  p:{shape:7,scale:1.05,angle:0,soft:.4,warp:.55,detail:3.4,mottle:.25,posx:0,posy:0,
                     bands:2,blur:.24,streak:0,streakang:0,
                     exposure:-.3,contrast:1.2,black:.14,gamma:1.35,vignette:.55,gloss:0,
                     grain:.17,gsize:1.2,gdens:1,gresp:.35,tex:0,mid:.5,invert:false}},
  {name:"Sfumato",p:{shape:7,scale:1.10,angle:-12,soft:.5,warp:.6,detail:3,mottle:.3,posx:-.05,posy:.05,
                     bands:2,blur:.50,streak:.12,streakang:70,
                     exposure:-.18,contrast:1.15,black:.16,gamma:1.25,vignette:.55,gloss:0,
                     grain:.17,gsize:1.2,gdens:1,gresp:.25,tex:0,mid:.5,invert:false,
                     c0:"#060606",c1:"#4A4A4A",c2:"#A8A8A8"}},
  {name:"Smear",  p:{shape:2,scale:1.2,angle:8,soft:.4,warp:.7,detail:3.6,mottle:.3,posx:0,posy:0,
                     bands:2,blur:.55,streak:.92,streakang:92,
                     exposure:-.15,contrast:1.35,black:.08,gamma:1.15,vignette:.35,gloss:0,
                     grain:.24,gsize:1,gdens:1,gresp:.6,tex:0,mid:.5,invert:false}},
  {name:"Halftone",p:{shape:6,scale:1.3,angle:-10,soft:.4,warp:.9,detail:3.4,mottle:.2,posx:0,posy:0,
                     bands:2.4,blur:.12,streak:0,streakang:0,
                     exposure:-.1,contrast:1.3,black:.07,gamma:1.1,vignette:.3,gloss:.2,
                     grain:.1,gsize:1,gdens:.8,gresp:.6,tex:4,texamt:.75,texscale:1.15,mid:.5,invert:false}},
  {name:"Haze",   p:{shape:7,scale:1.9,angle:24,soft:.5,warp:.35,detail:2.6,mottle:.2,posx:.1,posy:-.1,
                     bands:2,blur:.5,streak:.3,streakang:20,
                     exposure:-.55,contrast:.85,black:.02,gamma:1.45,vignette:.25,gloss:0,
                     grain:.2,gsize:1.1,gdens:1,gresp:.3,tex:0,mid:.5,invert:false}},
  {name:"Negative",p:{shape:2,scale:1.05,angle:14,soft:.4,warp:.6,detail:3.4,mottle:.3,posx:0,posy:0,
                     exposure:0,contrast:1.15,black:.02,gamma:.95,vignette:.1,
                     grain:.24,gsize:1,gdens:1,gresp:.5,tex:0,mid:.5,invert:true}}
];

const SIZES = [
  {name:"iPhone 16 Pro · 1206 × 2622", w:1206, h:2622},
  {name:"iPhone 16 Pro Max · 1320 × 2868", w:1320, h:2868},
  {name:"Phone · 1080 × 1920", w:1080, h:1920},
  {name:"Phone · 1284 × 2778", w:1284, h:2778},
  {name:"Phone · 1440 × 3120", w:1440, h:3120},
  {name:"Square · 2048", w:2048, h:2048},
  {name:"Desktop · 2560 × 1440", w:2560, h:1440},
  {name:"Desktop · 3840 × 2160", w:3840, h:2160},
  {name:"Print 4:5 · 3000 × 3750", w:3000, h:3750}
];
