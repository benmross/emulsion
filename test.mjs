#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import vm from "node:vm";

const html=await readFile(new URL("./dist/index.html",import.meta.url),"utf8");
const app=html.split("<script>\n")[1]?.split("\n</script>")[0];
assert.ok(app,"built application script is present");
new vm.Script(app,{filename:"emulsion-built.js"});

for(const marker of [
  'meta name="description"','property="og:image"','rel="canonical"','rel="manifest"',
  'role="status"','aria-label="Procedurally generated wallpaper preview"'
]) assert.ok(html.includes(marker),`built page contains ${marker}`);

for(const file of ["icon.svg","icon-192.png","icon-512.png","apple-touch-icon.png","manifest.webmanifest","robots.txt","sitemap.xml","_headers","404.html","app.png"]){
  assert.ok((await stat(new URL("./dist/"+file,import.meta.url))).size>0,`${file} is emitted`);
}

const manifest=JSON.parse(await readFile(new URL("./dist/manifest.webmanifest",import.meta.url),"utf8"));
assert.equal(manifest.start_url,"/");
assert.ok(manifest.icons.length>=2);

const headers=await readFile(new URL("./dist/_headers",import.meta.url),"utf8");
for(const name of ["Strict-Transport-Security","Content-Security-Policy","Permissions-Policy"])
  assert.ok(headers.includes(name),`${name} is configured`);

console.log("production build checks passed");
