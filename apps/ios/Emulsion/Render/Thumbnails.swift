//  Thumbnails.swift
//  Every picker in this app is a contact sheet, not a list of words.
//
//  The plate strip previews each plate *in the grain and output shape you are
//  currently working in*, and the shape strip previews each field *in your
//  colours*. That is the single best thing about the web app's phone UI and it
//  is worth the GPU time.
//
//  What it is not worth is re-rendering fourteen plates on every slider tick.
//  A plate tile depends on its recipe and the session's seed, midpoint, grain
//  mode and output size. A drag through Exposure repaints nothing.

import UIKit
import Metal

@MainActor
@Observable
final class ThumbnailStore {

    private let renderer: PlateRenderer
    /// Metal's command queue is thread-safe but `PlateRenderer.image` blocks on
    /// the GPU, so it gets its own serial queue and never runs on main.
    private let workQueue = DispatchQueue(label: "com.benmross.emulsion.thumbs",
                                          qos: .userInitiated)

    private(set) var plateImages: [Int: UIImage] = [:]
    private(set) var shapeImages: [Int: UIImage] = [:]

    private var plateSignature = ""
    private var shapeSignature = ""
    private var generation = 0

    /// Points; the pixel size is this times the screen scale.
    static let width: CGFloat = 78

    init(renderer: PlateRenderer) {
        self.renderer = renderer
    }

    static func height(for params: Params) -> CGFloat {
        // Clamped so a 4K-landscape output still gives a tile you can see, and
        // a 4:5 print does not become a postage stamp.
        let ratio = min(max(1.0 / params.aspect, 1.15), 2.1)
        return (width * ratio).rounded()
    }

    /// Seed changes must invalidate the tiles along with the main picture.
    private func plateKey(_ p: Params) -> String {
        let l = p.look
        return ["\(p.seed)", l.c0.hex, l.c1.hex, l.c2.hex, "\(p.mid)", "\(p.chroma)",
                "\(l.grain)", "\(l.gSize)", "\(l.gDens)", "\(l.gResp)",
                "\(p.width)x\(p.height)"].joined(separator: "|")
    }

    /// A shape tile shows the whole current look with only the field swapped,
    /// so it depends on very nearly everything.
    private func shapeKey(_ p: Params) -> String {
        var l = p.look
        l.shape = -1                       // the one key that does not matter here
        return "\(l)|\(p.seed)|\(p.mid)|\(p.chroma)|\(p.width)x\(p.height)"
    }

    func refresh(_ params: Params, includeShapes: Bool, scale: CGFloat) {
        let pKey = plateKey(params)
        let sKey = shapeKey(params)
        let needPlates = pKey != plateSignature
        let needShapes = includeShapes && sKey != shapeSignature
        guard needPlates || needShapes else { return }

        if needPlates { plateSignature = pKey }
        if needShapes { shapeSignature = sKey }

        generation += 1
        let gen = generation
        let w = Int(Self.width * scale)
        let h = Int(Self.height(for: params) * scale)
        let renderer = self.renderer

        workQueue.async { [weak self] in
            var plates: [Int: UIImage] = [:]
            var shapes: [Int: UIImage] = [:]

            if needPlates {
                for plate in Catalog.plates {
                    var q = params
                    q.look = plate.look
                    // The plate's own ramp is part of the look, so the tile
                    // shows the colour the plate will actually give you.
                    if let img = try? renderer.image(q, width: w, height: h) {
                        plates[plate.id] = UIImage(cgImage: img, scale: scale, orientation: .up)
                    }
                }
            }
            if needShapes {
                for shape in Catalog.shapes {
                    var q = params
                    q.look.shape = Int32(shape.id)
                    if let img = try? renderer.image(q, width: w, height: h) {
                        shapes[shape.id] = UIImage(cgImage: img, scale: scale, orientation: .up)
                    }
                }
            }

            DispatchQueue.main.async {
                guard let self, self.generation == gen else { return }   // a newer pass won
                if needPlates { self.plateImages = plates }
                if needShapes { self.shapeImages = shapes }
            }
        }
    }
}
