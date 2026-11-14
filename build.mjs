#!/usr/bin/env node
/**
 * Assembles src/ into a single self-contained page at dist/index.html.
 *
 * The whole app ships as one file on purpose: it runs from a file:// URL with
 * no server, no build step for the user, and no network access beyond the
 * locally served font.
 */
import { readFile, writeFile, mkdir, copyFile, cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFile(join(root, ...p), "utf8");

/** JS modules, concatenated in order — they share one top-level scope. */
const MODULES = [
  "01-data.js",      // parameters, shapes, palettes, recipes, sizes
  "01-session.js",   // local history and session persistence
  "02-renderer.js",  // WebGL2 program + uniform upload
  "03-stage.js",     // canvas sizing, paint loop, animation clock, status bar
  "04-controls.js",  // control factory and the rail
  "06-actions.js",   // plates, shuffle, still and batch export
  "07-pwa.js",       // offline registration and Android installation
];

const [template, styles, vert, frag] = await Promise.all([
  read("apps", "web", "src", "index.html"),
  read("apps", "web", "src", "styles.css"),
  read("apps", "web", "src", "shaders", "plate.vert.glsl"),
  read("apps", "web", "src", "shaders", "plate.frag.glsl"),
]);

const modules = await Promise.all(MODULES.map((f) => read("apps", "web", "src", "js", f)));

/** GLSL travels as a template literal; guard the two characters that would break it. */
const glsl = (name, source) => {
  if (/`|\$\{/.test(source)) throw new Error(`${name} contains a backtick or \${`);
  return "const " + name + " = `" + source.trim() + "`;\n";
};

const app = [
  '"use strict";',
  "",
  modules
    .join("\n")
    .replace("/* @shader VERT */", glsl("VERT", vert))
    .replace("/* @shader FRAG */", glsl("FRAG", frag)),
].join("\n");

const page = template
  .replace("<!-- @styles -->", "<style>\n" + styles.trim() + "\n</style>")
  .replace("<!-- @app -->", "<script>\n" + app.trim() + "\n</script>");

await rm(join(root,"dist"),{recursive:true,force:true});
await mkdir(join(root, "dist", "app"), { recursive: true });
await writeFile(join(root, "dist", "app", "index.html"), page);
await copyFile(join(root,"apps","web","src","landing.html"),join(root,"dist","index.html"));
await cp(join(root,"apps","web","public"),join(root,"dist"),{recursive:true});
await copyFile(join(root,"docs","app.png"),join(root,"dist","app.png"));

// Content-derived cache names make rebuilding deterministic and invalidate old shells.
const {createHash} = await import("node:crypto");
const font = await readFile(join(root,"apps","web","public","fonts","archivo.woff2"));
const manifest = await read("apps","web","public","manifest.webmanifest");
const swTemplate = await read("apps","web","src","sw.js");
const hash=createHash("sha256").update(page).update(font).update(manifest).update(swTemplate);
for(const file of ["icon.svg","icon-192.png","icon-512.png","apple-touch-icon.png"]) hash.update(await readFile(join(root,"apps","web","public",file)));
const version=hash.digest("hex").slice(0,16);
await writeFile(join(root,"dist","app","sw.js"),swTemplate.replaceAll("__CACHE_VERSION__",version));
console.log(`dist/index.html + dist/app/index.html (${(Buffer.byteLength(page)/1024).toFixed(1)} kB); offline cache ${version}`);

/* ---------- wallpaper pages: /w/<slug>/, /wallpapers/ and counted /go/ links ---------- */
const walls = JSON.parse(await read("apps","web","wallpapers","wallpapers.json"));
const vmod = await import("node:vm");
const dataJs = modules[0], actionsJs = modules[MODULES.indexOf("06-actions.js")];
const codec = actionsJs.slice(actionsJs.indexOf("const SHARE_KEYS"), actionsJs.indexOf("async function copyLink"));
const sandbox = {btoa:s=>Buffer.from(s,"binary").toString("base64"), atob:s=>Buffer.from(s,"base64").toString("binary")};
vmod.createContext(sandbox);
vmod.runInContext(dataJs+"\n"+codec+`
globalThis.stateFor = (w) => {
  const r = RECIPES.find(x => x.name === w.recipe), pal = PALETTES.find(x => x.name === w.palette);
  if(!r || !pal) throw new Error("unknown recipe or palette for " + w.slug);
  Object.assign(P, DEFAULTS);
  for(const k of LOOK) P[k] = (k in r.p) ? r.p[k] : DEFAULTS[k];
  [P.c0, P.c1, P.c2] = pal.c; P.seed = w.seed; P.W = 1290; P.H = 2796;
  return encodeState();
};`, sandbox);
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const seen = new Set();
for(const w of walls){
  if(!/^[a-z0-9][a-z0-9-]{0,47}$/.test(w.slug) || seen.has(w.slug)) throw new Error("bad or duplicate slug " + w.slug);
  seen.add(w.slug); w.state = sandbox.stateFor(w);
}
const [wallTpl, galleryTpl, wallCss, wallJs] = await Promise.all([
  read("apps","web","src","wallpaper.html"), read("apps","web","src","gallery.html"),
  read("apps","web","src","wallpaper.css"), read("apps","web","src","js","wallpaper.js"),
]);
const wallApp = ['"use strict";', dataJs,
  modules[MODULES.indexOf("02-renderer.js")].replace("/* @shader VERT */", glsl("VERT", vert)).replace("/* @shader FRAG */", glsl("FRAG", frag)),
  codec, wallJs].join("\n");
const card = w => `<a href="/w/${w.slug}/"><img src="/media/w/thumb/${w.slug}.webp" width="400" height="867" loading="lazy" alt="${esc(w.alt)}">${esc(w.name)}</a>`;
const fill = (tpl, w) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => esc({pinW:1000, pinH:2167, ...w}[k] ?? ""));
const styleTag = "<style>\n" + wallCss.trim() + "\n</style>";
walls.forEach((w, i) => {
  const related = Array.from({length: Math.min(6, walls.length - 1)}, (_, n) => walls[(i + 1 + n) % walls.length]);
  const page = fill(wallTpl, w)
    .replace("<!-- @wallstyles -->", styleTag)
    .replace("<!-- @related -->", `<section class="related" aria-label="More wallpapers"><h2>More wallpapers</h2><div class="grid">${related.map(card).join("")}</div></section>`)
    .replace("<!-- @wallapp -->", "<script>\n" + wallApp.trim() + "\n</script>");
  w.html = page;
});
for(const w of walls){
  await mkdir(join(root, "dist", "w", w.slug), {recursive: true});
  await writeFile(join(root, "dist", "w", w.slug, "index.html"), w.html);
}
await mkdir(join(root, "dist", "wallpapers"), {recursive: true});
await writeFile(join(root, "dist", "wallpapers", "index.html"), galleryTpl
  .replace(/\{\{cover\}\}/g, esc(walls[0].slug))
  .replace("<!-- @wallstyles -->", styleTag)
  .replace("<!-- @grid -->", `<div class="grid">${walls.map(card).join("")}</div>`));
const site = "https://emulsion.benmross.com";
await writeFile(join(root, "dist", "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  + ["/", "/app/", "/privacy", "/wallpapers/", ...walls.map(w => "/w/" + w.slug + "/")].map(u => `<url><loc>${site}${u}</loc></url>`).join("") + "</urlset>\n");
// Only /go/ runs a Function; everything else stays static.
await writeFile(join(root, "dist", "_routes.json"), JSON.stringify({version: 1, include: ["/go/*"], exclude: []}) + "\n");
const slugModule = "// Generated by build.mjs from apps/web/wallpapers/wallpapers.json. Do not edit.\nexport const WALLPAPERS = " + JSON.stringify(walls.map(w => w.slug)) + ";\n";
const slugPath = join(root, "functions", "_wallpapers.js");
if(await readFile(slugPath, "utf8").catch(() => "") !== slugModule) await writeFile(slugPath, slugModule);
console.log(`${walls.length} wallpaper pages`);
