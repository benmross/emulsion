/* ============================== parameters ============================== */
const DEFAULTS = {
  shape:0, scale:1.00, angle:0, soft:.30, warp:.45, detail:3.4, mottle:.35, posx:-.05, posy:0,
  bands:2, blur:0, streak:0, streakang:0,
  exposure:.05, contrast:1.35, black:.05, gamma:1, vignette:.35, gloss:0,
  c0:"#000000", c1:"#6E7076", c2:"#F2F2F0", mid:.5, invert:false,
  grain:.16, gsize:1.3, gdens:.9, gresp:.75, chroma:false,
  tex:0, texamt:.35, texscale:1,
  animate:false, flow:.35, looplen:4, fps:30, fill:false,
  W:1206, H:2622, seed:.37, fmt:"png", guides:false, setsize:6
};
const P = Object.assign({}, DEFAULTS);

/* A plate is a look, not a working setup. Picking one moves exactly these keys —
   anything a plate does not name resets to its default — and leaves the rest of
   your session alone: mid stop, colour grain, output size, seed, file format,
   and the motion transport all stay where you put them. Each plate carries its
   own three-stop ramp, so the colour is part of the look and not a mode you are
   left in. */
const LOOK = [
  "shape","scale","angle","soft","warp","detail","mottle","posx","posy",
  "bands","blur","streak","streakang",
  "exposure","contrast","black","gamma","vignette","gloss",
  "grain","gsize","gdens","gresp",
  "tex","texamt","texscale","invert",
  "c0","c1","c2"
];

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
  {name:"Steel",     c:["#03080E","#4E6E8C","#CFE2F2"]},
  {name:"Sepia",     c:["#0A0705","#6A4B32","#F4E3C8"]},
  {name:"Safelight", c:["#060302","#5A2E06","#FFCF87"]},
  {name:"Cyanotype", c:["#01060E","#1E5C87","#D9EEF7"]},
  {name:"Ember",     c:["#08040A","#7A2140","#FFD9A8"]},
  {name:"Verdigris", c:["#030706","#3C6B5C","#E6F2E4"]},
  {name:"Ash",       c:["#060606","#4A4A4A","#A8A8A8"]},
  {name:"Bone",      c:["#07070A","#6B6455","#F2EADB"]},
  {name:"Selenium",  c:["#05060B","#5B5A72","#EFE9F2"]},
  {name:"Ultramarine",c:["#04051A","#3B44A8","#DCDEFF"]},
  {name:"Rosé",      c:["#0A0507","#7A4552","#FFE0D2"]},
  {name:"Neon",      c:["#05010A","#A0219C","#7FF6FF"]},
  {name:"Ink",       c:["#0C1020","#33406B","#FCF8EE"]}
];

const RECIPES = [
  {name:"Limb",   p:{shape:0,scale:1.00,angle:0,soft:.3,warp:.45,detail:3.4,mottle:.35,posx:-.05,posy:0,
                     exposure:.05,contrast:1.35,black:.05,gamma:1,vignette:.35,
                     grain:.16,gsize:1.3,gdens:.9,gresp:.75,tex:0,invert:false,
                     /* Silver */ c0:"#000000",c1:"#6E7076",c2:"#F2F2F0"}},
  {name:"Shaft",  p:{shape:1,scale:1.15,angle:-38,soft:.5,warp:.3,detail:3,mottle:.5,posx:-.05,posy:0,
                     exposure:0,contrast:1.35,black:.06,gamma:1.1,vignette:.2,
                     grain:.2,gsize:1.1,gdens:.95,gresp:.6,tex:1,texamt:.35,texscale:1.1,invert:false,
                     /* Safelight */ c0:"#060302",c1:"#5A2E06",c2:"#FFCF87"}},
  {name:"Satin",  p:{shape:2,scale:1.10,angle:-22,soft:.4,warp:.75,detail:3.6,mottle:.2,posx:0,posy:0,
                     exposure:0,contrast:1.2,black:.04,gamma:1,vignette:.15,
                     grain:.28,gsize:1,gdens:1,gresp:.85,tex:0,invert:false,
                     /* Rosé */ c0:"#0A0507",c1:"#7A4552",c2:"#FFE0D2"}},
  {name:"Dune",   p:{shape:3,scale:1.20,angle:-12,soft:.4,warp:.55,detail:4.2,mottle:.3,posx:0,posy:0,
                     exposure:-.1,contrast:1.45,black:.08,gamma:1.1,vignette:.4,
                     grain:.22,gsize:1.2,gdens:.9,gresp:.8,tex:2,texamt:.25,texscale:1,invert:false,
                     /* Sepia */ c0:"#0A0705",c1:"#6A4B32",c2:"#F4E3C8"}},
  {name:"Plume",  p:{shape:4,scale:1.05,angle:0,soft:.4,warp:.9,detail:4.5,mottle:.25,posx:0,posy:0,
                     exposure:.2,contrast:1.3,black:.1,gamma:1.2,vignette:.45,
                     grain:.2,gsize:1.4,gdens:.85,gresp:.7,tex:0,invert:false,
                     /* Selenium */ c0:"#05060B",c1:"#5B5A72",c2:"#EFE9F2"}},
  {name:"Orb",    p:{shape:5,scale:1.00,angle:0,soft:.25,warp:.35,detail:3.2,mottle:.2,posx:0,posy:0,
                     exposure:.05,contrast:1.25,black:.03,gamma:1,vignette:.3,
                     grain:.18,gsize:1.5,gdens:.9,gresp:.9,tex:0,invert:false,
                     /* Bone */ c0:"#07070A",c1:"#6B6455",c2:"#F2EADB"}},
  {name:"Chrome", p:{shape:6,scale:1.00,angle:0,soft:.4,warp:.85,detail:3.2,mottle:.15,posx:0,posy:0,
                     bands:3.0,blur:.06,streak:0,streakang:0,
                     exposure:0,contrast:1.45,black:.03,gamma:1,vignette:.15,gloss:.55,
                     grain:.12,gsize:1,gdens:.85,gresp:.5,tex:0,invert:false,
                     /* Steel */ c0:"#03080E",c1:"#4E6E8C",c2:"#CFE2F2"}},
  {name:"Oil",    p:{shape:6,scale:1.35,angle:20,soft:.4,warp:1.2,detail:4,mottle:.2,posx:0,posy:0,
                     bands:5.0,blur:.13,streak:0,streakang:0,
                     exposure:0,contrast:1.15,black:.02,gamma:1,vignette:.2,gloss:.3,
                     grain:.18,gsize:1.1,gdens:1,gresp:.7,tex:0,invert:false,
                     /* Neon */ c0:"#05010A",c1:"#A0219C",c2:"#7FF6FF"}},
  {name:"Bloom",  p:{shape:7,scale:1.05,angle:0,soft:.4,warp:.55,detail:3.4,mottle:.25,posx:0,posy:0,
                     bands:2,blur:.24,streak:0,streakang:0,
                     exposure:-.3,contrast:1.2,black:.14,gamma:1.35,vignette:.55,gloss:0,
                     grain:.17,gsize:1.2,gdens:1,gresp:.35,tex:0,invert:false,
                     /* Ember */ c0:"#08040A",c1:"#7A2140",c2:"#FFD9A8"}},
  {name:"Sfumato",p:{shape:7,scale:1.10,angle:-12,soft:.5,warp:.6,detail:3,mottle:.3,posx:-.05,posy:.05,
                     bands:2,blur:.50,streak:.12,streakang:70,
                     exposure:-.18,contrast:1.15,black:.16,gamma:1.25,vignette:.55,gloss:0,
                     grain:.17,gsize:1.2,gdens:1,gresp:.25,tex:0,invert:false,
                     /* Ash */ c0:"#060606",c1:"#4A4A4A",c2:"#A8A8A8"}},
  {name:"Smear",  p:{shape:2,scale:1.2,angle:8,soft:.4,warp:.7,detail:3.6,mottle:.3,posx:0,posy:0,
                     bands:2,blur:.55,streak:.92,streakang:92,
                     exposure:-.15,contrast:1.35,black:.08,gamma:1.15,vignette:.35,gloss:0,
                     grain:.24,gsize:1,gdens:1,gresp:.6,tex:0,invert:false,
                     /* Cyanotype */ c0:"#01060E",c1:"#1E5C87",c2:"#D9EEF7"}},
  {name:"Halftone",p:{shape:6,scale:1.3,angle:-10,soft:.4,warp:.9,detail:3.4,mottle:.2,posx:0,posy:0,
                     bands:2.4,blur:.12,streak:0,streakang:0,
                     exposure:-.1,contrast:1.3,black:.07,gamma:1.1,vignette:.3,gloss:.2,
                     grain:.1,gsize:1,gdens:.8,gresp:.6,tex:4,texamt:.75,texscale:1.15,invert:false,
                     /* Ultramarine */ c0:"#04051A",c1:"#3B44A8",c2:"#DCDEFF"}},
  {name:"Haze",   p:{shape:7,scale:1.9,angle:24,soft:.5,warp:.35,detail:2.6,mottle:.2,posx:.1,posy:-.1,
                     bands:2,blur:.5,streak:.3,streakang:20,
                     exposure:-.55,contrast:.85,black:.02,gamma:1.45,vignette:.25,gloss:0,
                     grain:.2,gsize:1.1,gdens:1,gresp:.3,tex:0,invert:false,
                     /* Verdigris */ c0:"#030706",c1:"#3C6B5C",c2:"#E6F2E4"}},
  {name:"Negative",p:{shape:2,scale:1.05,angle:14,soft:.4,warp:.6,detail:3.4,mottle:.3,posx:0,posy:0,
                     exposure:0,contrast:1.15,black:.02,gamma:.95,vignette:.1,
                     grain:.24,gsize:1,gdens:1,gresp:.5,tex:0,invert:true,
                     /* Ink */ c0:"#0C1020",c1:"#33406B",c2:"#FCF8EE"}}
];

const SIZES = [
  {group:"Phone", items:[
    {w:1206, h:2622, name:"iPhone 16 Pro · 17 Pro"},
    {w:1320, h:2868, name:"iPhone 16 Pro Max · 17 Pro Max"},
    {w:1290, h:2796, name:"iPhone 14 Pro Max · 15 Plus · 15 Pro Max · 16 Plus"},
    {w:1179, h:2556, name:"iPhone 14 Pro · 15 · 15 Pro · 16"},
    {w:1170, h:2532, name:"iPhone 12 · 12 Pro · 13 · 13 Pro · 14"},
    {w:1125, h:2436, name:"iPhone X · XS · 11 Pro"},
    {w:1080, h:2340, name:"iPhone 12 mini · 13 mini · many Android"},
    {w:828,  h:1792, name:"iPhone XR · 11"},
    {w:750,  h:1334, name:"iPhone SE 2 · SE 3"},
    {w:1440, h:3120, name:"Pixel 9 Pro · Galaxy S24 Ultra"},
    {w:1440, h:3200, name:"Galaxy S21 Ultra · S22 Ultra"},
    {w:1080, h:2400, name:"Pixel 9 · Galaxy S23 · S24"}
  ]},
  {group:"Tablet", items:[
    {w:2048, h:2732, name:"iPad Pro 12.9″"},
    {w:1668, h:2388, name:"iPad Pro 11″ · iPad Air"}
  ]},
  {group:"Desktop", items:[
    {w:2560, h:1440, name:"QHD"},
    {w:3840, h:2160, name:"4K UHD"},
    {w:3456, h:2234, name:"MacBook Pro 16″"},
    {w:3024, h:1964, name:"MacBook Pro 14″"}
  ]},
  {group:"Square & print", items:[
    {w:2048, h:2048, name:"Square"},
    {w:3000, h:3750, name:"4:5 print"}
  ]}
];
