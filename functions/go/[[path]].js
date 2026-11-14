/* Counted links for each place Emulsion is shared.

     /go/<channel>              app: App Store on iPhone/iPad, the web app on Android, else the landing page
     /go/<channel>/<wallpaper>  that wallpaper's download page
     /go/store/<wallpaper>      the app, counted as a click from that wallpaper page
     POST /go/download/<slug>   beacon from a wallpaper page after a download

   Counts are aggregate daily totals in KV (binding GO), keyed by day, channel,
   target and whether the client looked automated. Nothing about the visitor
   is stored: no IP, cookie, user agent or referrer. Totals count requests, not
   people, and KV's read-then-write can drop a count under concurrent hits. */
import {WALLPAPERS} from "../_wallpapers.js";

const APP_STORE = "https://apps.apple.com/app/id6809967506";
const NAME = /^[a-z0-9][a-z0-9-]{0,47}$/;
const AUTOMATED = /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|curl|wget|python|headless|lighthouse/i;
const known = new Set(WALLPAPERS);

function appFor(ua){
  if(/iPhone|iPad|iPod/.test(ua)) return APP_STORE;
  if(/Android/.test(ua)) return "/app/";
  return "/";
}

async function count(env, channel, target, automated){
  if(!env.GO) return;
  const day = new Date().toISOString().slice(0,10);
  const key = day+"|"+channel+"|"+target+"|"+(automated?"auto":"human");
  const now = parseInt(await env.GO.get(key) || "0", 10) || 0;
  await env.GO.put(key, String(now+1));
}

export async function onRequest(context){
  const {request, params, env} = context, waitUntil = p => context.waitUntil(p);
  const parts = [].concat(params.path || []);
  const ua = request.headers.get("user-agent") || "";
  const automated = AUTOMATED.test(ua);
  const [channel, slug, extra] = parts.map(s => String(s).toLowerCase());
  const valid = channel && NAME.test(channel) && !extra && (!slug || NAME.test(slug));

  if(channel === "download"){
    if(request.method === "POST" && valid && known.has(slug)) waitUntil(count(env, "download", slug, automated).catch(()=>{}));
    return new Response(null, {status:204, headers:{"cache-control":"no-store"}});
  }

  let dest;
  if(!valid) dest = "/";
  else if(channel === "store") dest = appFor(ua);
  else if(!slug) dest = appFor(ua);
  else dest = known.has(slug) ? "/w/"+slug+"/" : "/wallpapers/";

  const target = !slug ? "app" : known.has(slug) ? slug : "unknown";
  if(valid && request.method === "GET") waitUntil(count(env, channel, target, automated).catch(()=>{}));
  return new Response(null, {status:302, headers:{
    "location": new URL(dest, request.url).toString(),
    "cache-control": "no-store",
    "referrer-policy": "strict-origin-when-cross-origin",
  }});
}
