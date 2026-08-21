#!/usr/bin/env node
/**
 * Assembles src/ into a single self-contained page at dist/index.html.
 *
 * The whole app ships as one file on purpose: it runs from a file:// URL with
 * no server, no build step for the user, and no network access beyond the
 * Google Fonts stylesheet.
 */
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFile(join(root, ...p), "utf8");

/** JS modules, concatenated in order — they share one top-level scope. */
const MODULES = [
  "01-data.js",      // parameters, shapes, palettes, recipes, sizes
  "02-renderer.js",  // WebGL2 program + uniform upload
  "03-stage.js",     // canvas sizing, paint loop, animation clock, status bar
  "04-controls.js",  // control factory and the rail
  "05-video.js",     // WebCodecs encoder + MP4 muxer for loop export
  "06-actions.js",   // recipes, shuffle, export, batch, loop recording
];

const [template, styles, vert, frag] = await Promise.all([
  read("src", "index.html"),
  read("src", "styles.css"),
  read("src", "shaders", "plate.vert.glsl"),
  read("src", "shaders", "plate.frag.glsl"),
]);

const modules = await Promise.all(MODULES.map((f) => read("src", "js", f)));

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

await mkdir(join(root, "dist"), { recursive: true });
await writeFile(join(root, "dist", "index.html"), page);
await Promise.all([
  "icon.svg","icon-192.png","icon-512.png","apple-touch-icon.png","manifest.webmanifest","robots.txt","sitemap.xml","_headers","404.html"
].map(f=>copyFile(join(root,"public",f),join(root,"dist",f))));
await copyFile(join(root,"docs","app.png"),join(root,"dist","app.png"));

const kb = (Buffer.byteLength(page) / 1024).toFixed(1);
console.log(`dist/index.html — ${kb} kB, ${page.split("\n").length} lines`);
