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
