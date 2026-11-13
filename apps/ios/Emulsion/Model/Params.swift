//  Params.swift
//  The parameter set, one-for-one with DEFAULTS in the web app's 01-data.js.

import SwiftUI
import simd

/// A colour as the app stores it: three floats, because that is what the shader
/// wants, with hex only as a presentation detail.
struct RGB: Equatable, Hashable, Codable, Sendable {
    var r: Float, g: Float, b: Float

    init(r: Float, g: Float, b: Float) { self.r = r; self.g = g; self.b = b }

    init(hex: String) {
        let s = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        let n = UInt32(s, radix: 16) ?? 0
        r = Float((n >> 16) & 255) / 255
        g = Float((n >> 8) & 255) / 255
        b = Float(n & 255) / 255
    }

    var hex: String {
        String(format: "#%02X%02X%02X",
               Int((r * 255).rounded()), Int((g * 255).rounded()), Int((b * 255).rounded()))
    }

    var simd: simd_float3 { simd_float3(r, g, b) }

    var color: Color { Color(.sRGB, red: Double(r), green: Double(g), blue: Double(b)) }

    init(_ color: Color) {
        let ui = UIColor(color)
        var rr: CGFloat = 0, gg: CGFloat = 0, bb: CGFloat = 0, aa: CGFloat = 0
        ui.getRed(&rr, green: &gg, blue: &bb, alpha: &aa)
        r = Float(rr); g = Float(gg); b = Float(bb)
    }
}

/// The thirty keys a *plate* owns.
///
/// This mirrors the web app's `LOOK` array, and the memberwise initialiser gives
/// the same rule for free: a recipe that does not name a key gets that key's
/// default, so picking a plate can never leave you in a mode a previous plate
/// put you in. Anything outside this struct — mid stop, output size, seed
/// and format — is *your* working setup and a plate never
/// touches it.
struct Look: Equatable, Codable, Sendable {
    var shape: Int32 = 0
    var scale: Float = 1.00
    var angle: Float = 0
    var soft: Float = 0.30
    var warp: Float = 0.45
    var detail: Float = 3.4
    var mottle: Float = 0.35
    var posX: Float = -0.05
    var posY: Float = 0

    var bands: Float = 2
    var blur: Float = 0
    var streak: Float = 0
    var streakAng: Float = 0

    var exposure: Float = 0.05
    var contrast: Float = 1.35
    var black: Float = 0.05
    var gamma: Float = 1
    var vignette: Float = 0.35
    var gloss: Float = 0

    var grain: Float = 0.16
    var gSize: Float = 1.3
    var gDens: Float = 0.9
    var gResp: Float = 0.75

    var tex: Int32 = 0
    var texAmt: Float = 0.35
    var texScale: Float = 1

    var invert: Bool = false

    var c0 = RGB(hex: "#000000")
    var c1 = RGB(hex: "#6E7076")
    var c2 = RGB(hex: "#F2F2F0")
}

enum ExportFormat: String, CaseIterable, Identifiable, Codable, Sendable {
    case png, heic, jpeg
    var id: String { rawValue }
    var label: String {
        switch self {
        case .png:  return "PNG · lossless"
        case .heic: return "HEIC · small"
        case .jpeg: return "JPEG · smallest"
        }
    }
    var fileExtension: String {
        switch self {
        case .png: return "png"
        case .heic: return "heic"
        case .jpeg: return "jpg"
        }
    }
}

/// Everything the renderer needs, and everything a session remembers.
struct Params: Equatable, Codable, Sendable {
    var look = Look()

    // Session settings — a plate never moves these.
    var mid: Float = 0.5
    var chroma: Bool = false

    var width: Int = 1206          // iPhone 16 Pro / 17 Pro
    var height: Int = 2622
    var seed: Float = 0.37
    var format: ExportFormat = .png
    var guides: Bool = false
    var setSize: Int = 6

    var aspect: CGFloat { CGFloat(width) / CGFloat(height) }
    var megapixels: Double { Double(width) * Double(height) / 1e6 }

    /// Seed as the UI shows it: a whole number 0–9999.
    var seedNumber: Int {
        get { Int((seed * 10_000).rounded()) }
        set { seed = Float(max(0, min(9999, newValue))) / 10_000 }
    }

    /// `pixelScale` is renderWidth / outputWidth. Grain is sized in output
    /// pixels, so the preview has to tell the shader how much smaller it is.
    /// - Parameters:
    ///   - renderWidth/renderHeight: the size the *whole* picture is being drawn
    ///     at — the preview's downscaled size, or the full export size even when
    ///     that export is coming out one tile at a time.
    ///   - tileOrigin: which corner of that picture this pass covers.
    func uniforms(renderWidth: Int, renderHeight: Int,
                  tileOrigin: simd_float2 = .zero) -> PlateUniforms {
        let l = look
        return PlateUniforms(
            res: simd_float2(Float(renderWidth), Float(renderHeight)),
            pixelScale: Float(renderWidth) / Float(max(width, 1)),
            seed: seed,
            shape: l.shape,
            tex: l.tex,
            invert: l.invert ? 1 : 0,
            chroma: chroma ? 1 : 0,
            scale: l.scale, angle: l.angle, soft: l.soft, warp: l.warp,
            detail: l.detail, mottle: l.mottle, posX: l.posX, posY: l.posY,
            exposure: l.exposure, contrast: l.contrast, black: l.black, gamma: l.gamma,
            vignette: l.vignette, gloss: l.gloss,
            texAmt: l.texAmt, texScale: l.texScale,
            grain: l.grain, gSize: l.gSize, gDens: l.gDens, gResp: l.gResp,
            bands: l.bands, blur: l.blur, streak: l.streak, streakAng: l.streakAng,
            mid: mid, _pad0: 0, _pad1: 0, _pad2: 0,
            tileOrigin: tileOrigin, _tilePad: .zero,
            c0: l.c0.simd, c1: l.c1.simd, c2: l.c2.simd
        )
    }
}
