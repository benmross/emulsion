# Emulsion for iOS

A native SwiftUI + Metal rewrite of [emulsion.benmross.com](https://emulsion.benmross.com):
generative grain plates for still wallpapers.

The web app renders its whole image from one WebGL2 fragment shader. This app
does the same thing in one Metal fragment shader (`Render/Plate.metal`), so a
plate is not a picture of the web app's output. It is the same math, sampled
at whatever resolution you export.

## Why it is shaped this way

- The plate is the screen. The picture sits whole above the controls,
  never cropped, so what you see is what lands on the lock screen. Tap it for
  fullscreen; the dice button shuffles.
- One `MTKView` for the app's whole life. Going fullscreen animates rather
  than flashes, and no plate is ever re-created just because a panel opened.
- Liquid Glass for the chrome, not the picture. The top bar and the
  control sheet use Liquid Glass on iOS 26 and native material on iOS 17/18;
  the plate itself is left
  completely alone, because it is the thing being judged.
- The category strip never leaves. Collapsing the sheet trades controls
  for picture without costing you your place.
## Layout

```
App/       the entry point and the single renderer instance
Model/     Params (the full parameter stack), Studio (UI state), Catalog (plates)
Render/    the Metal shader, its renderer, the MTKView wrapper, export, thumbnails
UI/        ContentView (the stage), the panels, the controls, theme
```

## Building

Open `Emulsion.xcodeproj` in Xcode, pick a team under Signing & Capabilities,
and Run. The project file is checked in, so there is no generator step and
nothing rewrites `Info.plist` behind you.

For the simulator, from a shell:

```bash
xcodebuild -project Emulsion.xcodeproj -scheme Emulsion \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO build
```

In a **DEBUG** build only, `EMULSION_CATEGORY` opens the app straight to one
panel, which is how the layout of all eight gets checked without a UI test
target (`simctl` cannot synthesise a tap):

```bash
SIMCTL_CHILD_EMULSION_CATEGORY=Tone xcrun simctl launch <device> com.benmross.emulsion
```

## Compatibility

Minimum iOS: 17.0. Observation and the two-value `onChange` API make iOS 17 a
practical floor; going lower would require changing state observation throughout
the app. Wallpaper rendering and export use the same code on every version.
Liquid Glass stays on iOS 26; earlier systems use material panels and bordered
buttons. Glass morphing IDs and containers are used only where available.
The reseed icon has a fallback for iOS 17.

In DEBUG builds, `EMULSION_LEGACY_UI=1` exercises the older UI presentation on a
current simulator. Verified with release Xcode 26.2: device Release and
simulator Debug builds target iOS 17.0. Native iOS 17.5 (iPhone XS) and iOS 26.2
(iPhone 13) simulator checks cover all eight panels, the result card, export in
PNG/HEIC/JPEG, seed variations and legacy session/undo compatibility. The current
Liquid Glass path was also checked on iOS 26.2. Physical-device validation on an
older iPhone is still separate from these simulator checks.

## Saving

Save a still to Photos, share it, or export a set of seed variations. PNG, HEIC
and JPEG are supported. Sessions and undo history survive app updates, including
sessions saved by earlier builds with motion enabled.
