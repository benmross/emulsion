//  PlateView.swift
//  The picture, as a SwiftUI view.
//
//  **It always renders at native resolution.** There used to be an adaptive
//  scaler here: every frame reported its GPU time and the next frame's drawable
//  was sized from it, with a "settle" pass restoring full resolution a fifth of
//  a second after you stopped. It was a good idea for the wrong shader, and it
//  produced every rendering bug Ben reported on 8 September -- flickering
//  grain, a still plate that never stopped costing GPU time, and plates coming
//  back coarse when switched.
//
//  Two reasons it is gone rather than fixed again:
//
//  * **Adaptive resolution is wrong for *this* shader.** Grain cells are sized
//    in output pixels, so changing the render size does not make the picture
//    gracefully softer -- it makes it a *different picture*. For a smooth
//    gradient the change would be invisible; for grain it is the single most
//    noticeable thing on screen. The technique optimises exactly the thing this
//    app is for.
//  * **There was nothing to optimise.** Measured across the plates at full
//    resolution: 0.06-0.75 ms a frame, against an 8.3 ms budget at 120 Hz. The
//    view is around 870k pixels. The scaler spent its whole life backing away
//    from a budget it was never close to.
//
//  If a plate ever genuinely cannot keep up, the honest degradation is a lower
//  frame rate, not a picture that changes as you look at it. A DEBUG build logs
//  any frame over budget so that would be noticed rather than guessed at.

import SwiftUI
import MetalKit

struct PlateView: UIViewRepresentable {

    let renderer: PlateRenderer
    let params: Params

    func makeCoordinator() -> Coordinator { Coordinator(renderer: renderer) }

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: renderer.device)
        view.colorPixelFormat = PlateRenderer.pixelFormat
        view.framebufferOnly = true
        view.autoResizeDrawable = false          // we choose the size, not UIKit
        view.isOpaque = true
        view.backgroundColor = .black
        view.clearColor = MTLClearColorMake(0, 0, 0, 1)
        view.enableSetNeedsDisplay = true
        view.isPaused = true
        view.delegate = context.coordinator
        view.layer.magnificationFilter = .linear
        view.layer.isOpaque = true
        context.coordinator.view = view
        context.coordinator.params = params
        return view
    }

    func updateUIView(_ view: MTKView, context: Context) {
        context.coordinator.update(params: params)
    }

    @MainActor
    final class Coordinator: NSObject, MTKViewDelegate {

        private let renderer: PlateRenderer
        weak var view: MTKView?

        var params = Params()

        init(renderer: PlateRenderer) {
            self.renderer = renderer
        }

        func update(params new: Params) {
            // updateUIView runs on every SwiftUI body pass, not only when the
            // picture actually changed. Redrawing for those is pure waste.
            let unchanged = new == params
            params = new

            guard let view else { return }
            if unchanged { return }
            view.setNeedsDisplay()
        }

        func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
            // Nothing to reset. The drawable is always the natural size, so a
            // bounds change needs no decision -- the next draw will size it.
        }

        /// The plate is never cropped and never upscaled past its own output
        /// size — a 750×1334 plate on a Pro Max is drawn at 750 wide and shown
        /// larger, exactly as the export will look.
        private func naturalDrawableSize(for view: MTKView) -> CGSize {
            let bounds = view.bounds.size
            guard bounds.width > 1, bounds.height > 1 else { return .zero }
            let dpr = min(view.traitCollection.displayScale, 3)
            var w = bounds.width * dpr
            var h = bounds.height * dpr
            if w > CGFloat(params.width) {
                w = CGFloat(params.width)
                h = CGFloat(params.height)
            }
            return CGSize(width: w, height: h)
        }

        func draw(in view: MTKView) {
            let want = naturalDrawableSize(for: view)
            guard want.width > 1, want.height > 1 else { return }
            if view.drawableSize != want { view.drawableSize = want }

            renderer.drawPreview(params, in: view) { ms in
                #if DEBUG
                // 8.3 ms is one frame at 120 Hz. Nothing measured so far comes
                // near it, so anything that does is worth knowing about rather
                // than silently absorbing.
                if ms > 8.3 {
                    NSLog("SLOWFRAME %.2fms at %.0fx%.0f", ms, want.width, want.height)
                }
                #endif
            }
        }
    }
}
