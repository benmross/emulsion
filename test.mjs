import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const landing=await read('./dist/index.html'),html=await read('./dist/app/index.html');
for(const [name,page] of [['landing',landing],['studio',html]]){
  for(const script of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script[1],{filename:name+'.js'});
  assert.ok(!page.includes('fonts.googleapis.com'),name+' is self-contained for fonts');
}
for(const link of ['/app/','/privacy','https://benmross.com','https://apps.apple.com/app/id6809967506','https://github.com/benmross/emulsion']) assert.ok(landing.includes('href="'+link+'"'),link);
for(const marker of ['data-history="undo"','data-history="redo"','id="result"','register("/app/sw.js"','role="status"','aria-label="Procedurally generated wallpaper preview"']) assert.ok(html.includes(marker),marker);
assert.ok(!html.includes('Record loop'));assert.ok(!html.includes('section("Motion")'));assert.ok(!html.includes('uMotion'));
for(const file of ['icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png','manifest.webmanifest','robots.txt','sitemap.xml','_headers','_redirects','404.html','privacy.html','app/sw.js','media/plates.webp','media/satin-loop.mp4','fonts/archivo.woff2']) assert.ok((await stat(new URL('./dist/'+file,import.meta.url))).size>0,file);
const manifest=JSON.parse(await read('./dist/manifest.webmanifest'));
assert.equal(manifest.start_url,'/app/');assert.equal(manifest.scope,'/app/');assert.equal(manifest.id,'/');assert.equal(manifest.display,'standalone');
assert.ok(manifest.icons.some(i=>i.sizes==='512x512' && i.purpose.includes('maskable')));
const sw=await read('./dist/app/sw.js');new vm.Script(sw);assert.ok(!sw.includes('__CACHE_VERSION__'));assert.ok(sw.includes('cache.addAll(SHELL)'));
const headers=await read('./dist/_headers');for(const name of ['Strict-Transport-Security','Content-Security-Policy','Permissions-Policy','Cache-Control: no-cache']) assert.ok(headers.includes(name));
// A saved / shared look must preserve the full seed and every supported parameter.
const data=await read('./apps/web/src/js/01-data.js');
const actions=await read('./apps/web/src/js/06-actions.js');
const core=actions.slice(actions.indexOf('const SHARE_KEYS'),actions.indexOf('async function copyLink'));
const sandbox={btoa:s=>Buffer.from(s).toString('base64'),atob:s=>Buffer.from(s,'base64').toString()};vm.createContext(sandbox);
vm.runInContext(data+'\n'+core+'\nP.seed=.1234;globalThis.saved=encodeState();P.seed=0;globalThis.decoded=decodeState(saved);globalThis.seed=P.seed;',sandbox);
assert.equal(sandbox.decoded,true);assert.equal(sandbox.seed,.1234);
vm.runInContext('globalThis.bad=decodeState("bad");',sandbox);assert.equal(sandbox.bad,false);
console.log('Production routes, scripts, install manifest, offline shell and look round-trip checks passed.');
