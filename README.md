# Emulsion

Make grainy, abstract still wallpapers. Start with one of fourteen plates, adjust
form, optics, tone, color, grain and surface, and export at your screen’s resolution.
Every pixel is generated on your device, with no accounts or image uploads.

[Download for iPhone](https://apps.apple.com/app/id6809967506) ·
[Web app for Android and desktop](https://emulsion.benmross.com/app/) ·
[About Emulsion](https://emulsion.benmross.com/) ·
[Privacy](https://emulsion.benmross.com/privacy)

## One repository, two apps

```
apps/
  ios/        SwiftUI + Metal app, iOS 17 and later
  web/
    src/      WebGL2 studio, landing page, service worker
    public/   App icons, self-hosted font, screenshots, preview loop, privacy page
dist/         Complete static website, committed and deployed to Cloudflare Pages
docs/         Reference images and development notes
build.mjs     Dependency-free website build
```

The iOS source matches version 1.1 build 17, including iOS 17 compatibility and
Liquid Glass on iOS 26. It was brought over from the original iOS checkout at
commit `8c6e5ca`. The original web history remains in this repository. Signing
keys, App Store credentials, correspondence and private release records are
not part of the source distribution.

Both apps have eight panels: Plates, Form, Optics, Tone, Color, Grain, Surface,
and Output. They use the same plate recipes, palettes and still-image shader
math. The shader exists as GLSL in `apps/web/src/shaders/plate.frag.glsl` and
Metal in `apps/ios/Emulsion/Render/Plate.metal`; changes to the rendering math
should be reflected in both. The cached animation on the website is a
presentation asset. The editor and native app produce still wallpapers.

## Web app

Requires a current browser with WebGL2. On Android, open `/app/` in Chrome and
choose **Install Emulsion** in Output when offered, or **Add to Home screen**
from the browser menu. It opens as a standalone app. After the first visit,
the studio and its font are cached for offline use. Installation requires HTTPS
(or localhost during development).

Your current look, panel and up to 80 undo steps are saved in local storage.
Undo/redo also supports Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. Storage restrictions or
clearing site data can remove this history. Plate changes preserve your output
size, seed and other session settings. Old `/#p=...` look links forward to the
studio; new shared links use `/app/#p=...`.

Save downloads a PNG, WebP or JPEG. Browsers do not provide native HEIC export,
so WebP is the web app’s smaller-file option. Share prepares an image, then asks
for a second tap where the OS share sheet requires a fresh user gesture. Export
set downloads one ZIP with 4, 6, 8 or 12 seed variations; tap a result preview to
continue editing that variation. Dimensions can be set up to 8192 pixels per
side, subject to the browser’s GPU and memory limits. The web app cannot set
Android’s wallpaper directly: open the downloaded image and set it through the
system photo or wallpaper app.

The landing page at `/` has real iPhone screenshots, an animated background,
the App Store link, a smaller Android/web link, and links to the privacy policy,
source and portfolio. Reduced motion uses the video poster; offscreen and
hidden-tab playback pauses. All fonts are served locally.

## Build and check

Node 24 is used by CI. No package installation is needed.

```sh
node build.mjs
node test.mjs
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080/` for the landing page or `/app/` for the studio.
`node test.mjs` checks both routes, script syntax, the manifest, offline shell,
security headers and shared-look round trips. Browser QA should additionally
cover mobile layout, undo/reload, exports, offline reload and installability.

The build keeps the root command and `dist` directory expected by the existing
Cloudflare Pages Git integration. `dist/` must be committed after rebuilding;
CI verifies every generated file. The service worker uses a content-derived
cache version and waits for existing app tabs to close before activating an
update. The stable manifest ID `/` preserves the identity of earlier installs;
the launch URL is now `/app/`.

## iOS app

Open `apps/ios/Emulsion.xcodeproj` in release Xcode. Select your own development
team and bundle identifier for device signing. No project generator is required.
See [the iOS build notes](apps/ios/README.md) for compatibility and simulator use.
The project’s relative paths stay inside `apps/ios/` after the monorepo move.

The native app saves to Photos with add-only permission, supports PNG, HEIC and
JPEG, and uses native sharing. Neither the native app nor the web app includes
motion or Live Photo export.

## License

[MIT](LICENSE). Archivo is distributed under the
[SIL Open Font License](apps/web/public/fonts/OFL.txt).

## Wallpapers and counted links

`apps/web/wallpapers/wallpapers.json` lists finished looks (recipe, palette and
seed) with their titles and descriptions. The build turns each one into
`/w/<slug>/`, a page that renders the full-resolution download on the visitor's
device from the same recipe, plus the `/wallpapers/` gallery and sitemap entries.
Preview images live in `apps/web/public/media/w/`.

`functions/go/[[path]].js` is the only server code. `/go/<channel>` sends
iPhones to the App Store, Android to the web app and everyone else to the
landing page; `/go/<channel>/<slug>` opens that wallpaper's page. Each request
adds one to a daily total in the `GO` KV binding, keyed by day, channel, target
and whether the client looked automated. Nothing about the visitor is stored.
Totals count requests, not people.
