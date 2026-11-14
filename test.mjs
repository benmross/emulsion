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
// Wallpaper pages: every manifest entry has a page, preview, thumbnail and studio link; /go/ is the only Function route.
const walls=JSON.parse(await read('./apps/web/wallpapers/wallpapers.json'));
assert.ok(walls.length>0,'wallpaper manifest is not empty');
const gallery=await read('./dist/wallpapers/index.html'),sitemap=await read('./dist/sitemap.xml');
for(const w of walls){
  const page=await read('./dist/w/'+w.slug+'/index.html');
  for(const script of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script[1],{filename:w.slug+'.js'});
  assert.ok(/href="\/app\/#p=[A-Za-z0-9_-]+"/.test(page),w.slug+' opens in the studio');
  assert.ok(page.includes('href="/go/store/'+w.slug+'"'),w.slug+' counts App Store clicks');
  assert.ok(w.title.length<=100&&w.description.length<=500,w.slug+' fits Pinterest limits');
  for(const f of ['media/w/'+w.slug+'.jpg','media/w/thumb/'+w.slug+'.webp']) assert.ok((await stat(new URL('./dist/'+f,import.meta.url))).size>0,f);
  assert.ok(gallery.includes('href="/w/'+w.slug+'/"'),w.slug+' in gallery');
  assert.ok(sitemap.includes('/w/'+w.slug+'/'),w.slug+' in sitemap');
}
assert.deepEqual(JSON.parse(await read('./dist/_routes.json')),{version:1,include:['/go/*'],exclude:[]});
const {WALLPAPERS}=await import('./functions/_wallpapers.js');assert.deepEqual(WALLPAPERS,walls.map(w=>w.slug));
// The /go/ Function redirects and counts without storing anything about the visitor.
const {onRequest}=await import('./functions/go/[[path]].js');
const store=new Map(),waits=[];
const env={GO:{get:async k=>store.get(k)??null,put:async(k,v)=>{store.set(k,v);}}};
const go=async(path,ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',method='GET')=>{
  const r=await onRequest({request:new Request('https://emulsion.benmross.com/go/'+path,{method,headers:{'user-agent':ua}}),params:{path:path.split('/').filter(Boolean)},env,waitUntil:p=>waits.push(p)});
  await Promise.all(waits.splice(0));return r;
};
const first=walls[0].slug;
assert.equal((await go('pinterest/'+first)).headers.get('location'),'https://emulsion.benmross.com/w/'+first+'/');
assert.equal((await go('pinterest')).headers.get('location'),'https://apps.apple.com/app/id6809967506');
assert.equal((await go('pinterest','Mozilla/5.0 (Linux; Android 15)')).headers.get('location'),'https://emulsion.benmross.com/app/');
assert.equal((await go('pinterest/no-such-wall')).headers.get('location'),'https://emulsion.benmross.com/wallpapers/');
assert.equal((await go('../etc')).headers.get('location'),'https://emulsion.benmross.com/');
assert.equal((await go('pinterest/'+first,'Pinterestbot/1.0')).status,302);
assert.equal((await go('download/'+first,undefined,'POST')).status,204);
const day=new Date().toISOString().slice(0,10);
assert.equal(store.get(day+'|pinterest|'+first+'|human'),'1');assert.equal(store.get(day+'|pinterest|'+first+'|auto'),'1');
assert.equal(store.get(day+'|download|'+first+'|human'),'1');assert.equal(store.get(day+'|pinterest|unknown|human'),'1');
assert.ok([...store.keys()].every(k=>k.split('|').length===4),'keys hold only day, channel, target and kind');
console.log(walls.length+' wallpaper pages and the /go/ redirects passed.');
