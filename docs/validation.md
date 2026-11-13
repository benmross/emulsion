# Validation, 13 November 2026

The website build and Node checks pass. A clean rebuild reproduces all committed
output. Browser checks used Chromium with a software WebGL2 renderer on Linux;
mobile screens were emulated. Physical Android installation has not been tested.

Verified in the built website:

- Eight editor panels and all fourteen plates render.
- Plate selection and edits support undo/redo. The look, panel and history
  survive a reload. Changing the seed refreshes the thumbnail images.
- Real PNG, WebP and JPEG downloads decode at the requested dimensions. A set
  downloads as a valid ZIP with four independently rendered variations; a result
  preview can be adopted as the current seed.
- The studio reloads offline, restores its session and permits new edits.
  Chromium reports no manifest or installation errors. The studio makes no
  external resource requests and throws no JavaScript exceptions in these flows.
- Old root shared-look links redirect to the studio and preserve the full seed.
  Manual gallery selection and reduced-motion behavior work on the landing page.
- The picture stays above the controls, with category tabs visible, at 320 × 568,
  412 × 915 and 915 × 412. Collapsing the sheet retains the tabs. Tapping the
  picture hides and restores the interface. Desktop undo controls stay at the top.
- A browser without WebGL2 gets an explanation and disabled editor controls.

The 32 native app source, project and resource files match the original iOS
1.1 build 17 checkout byte for byte. The iOS README changes only its web link.
No new native binary was built for this website and repository update.

A follow-up reproduces Cloudflare’s `/app/index.html` redirect locally. The
previous worker cached that redirected response, which Chrome rejects for an
offline navigation. The fallback now uses the clean `/app/` response directly;
offline reload and editing pass with clean-URL redirects and the production CSP.

The landing preview now derives its height from the screenshot itself, keeping
the device border outside the image ratio. Plates, Color and Grain are checked
at 320, 412 and 1440 pixels wide for exact ratio and no letterboxing.

Hosting verification is separate: production uses the existing Cloudflare Pages
Git integration, root build command `node build.mjs`, and `dist` output. Live
routes, response headers, analytics removal and GitHub CI must be checked after
publication approval and deployment.
