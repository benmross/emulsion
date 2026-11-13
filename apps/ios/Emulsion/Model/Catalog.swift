//  Catalog.swift
//  The shapes, palettes, plates and output sizes — a faithful port of the
//  tables in the web app's 01-data.js. The numbers are the artwork; do not
//  "tidy" them.

import Foundation

struct Shape: Identifiable {
    let id: Int
    let name: String
    let hint: String
}

struct Palette: Identifiable, Hashable {
    let name: String
    let c0: RGB, c1: RGB, c2: RGB
    var id: String { name }

    init(_ name: String, _ a: String, _ b: String, _ c: String) {
        self.name = name
        c0 = RGB(hex: a); c1 = RGB(hex: b); c2 = RGB(hex: c)
    }

    func matches(_ look: Look) -> Bool {
        look.c0 == c0 && look.c1 == c1 && look.c2 == c2
    }
}

/// A plate is a *look*, not a working setup.
struct Plate: Identifiable {
    let id: Int
    let name: String
    let look: Look
}

struct OutputSize: Identifiable, Hashable {
    let w: Int, h: Int, name: String
    var id: String { "\(w)x\(h)" }
    var label: String { "\(w) × \(h)" }
}

struct SizeGroup: Identifiable {
    let group: String
    let items: [OutputSize]
    var id: String { group }
}

enum Catalog {

    static let shapes: [Shape] = [
        .init(id: 0, name: "Limb",   hint: "Soft lit column"),
        .init(id: 1, name: "Shaft",  hint: "Directional light beam"),
        .init(id: 2, name: "Satin",  hint: "Folded wave bands"),
        .init(id: 3, name: "Dune",   hint: "Ridged drifts"),
        .init(id: 4, name: "Plume",  hint: "Drifting smoke"),
        .init(id: 5, name: "Orb",    hint: "Lit sphere"),
        .init(id: 6, name: "Chrome", hint: "Liquid metal contours"),
        .init(id: 7, name: "Bloom",  hint: "Soft merging blobs")
    ]

    static let palettes: [Palette] = [
        .init("Silver",      "#000000", "#6E7076", "#F2F2F0"),
        .init("Platinum",    "#04060A", "#5C6B78", "#EAF2F6"),
        .init("Steel",       "#03080E", "#4E6E8C", "#CFE2F2"),
        .init("Sepia",       "#0A0705", "#6A4B32", "#F4E3C8"),
        .init("Safelight",   "#060302", "#5A2E06", "#FFCF87"),
        .init("Cyanotype",   "#01060E", "#1E5C87", "#D9EEF7"),
        .init("Ember",       "#08040A", "#7A2140", "#FFD9A8"),
        .init("Verdigris",   "#030706", "#3C6B5C", "#E6F2E4"),
        .init("Ash",         "#060606", "#4A4A4A", "#A8A8A8"),
        .init("Bone",        "#07070A", "#6B6455", "#F2EADB"),
        .init("Selenium",    "#05060B", "#5B5A72", "#EFE9F2"),
        .init("Ultramarine", "#04051A", "#3B44A8", "#DCDEFF"),
        .init("Rosé",        "#0A0507", "#7A4552", "#FFE0D2"),
        .init("Neon",        "#05010A", "#A0219C", "#7FF6FF"),
        .init("Ink",         "#0C1020", "#33406B", "#FCF8EE")
    ]

    /// Fourteen plates, in strip order so the row reads as a filmstrip. Each
    /// carries its own three-stop ramp, so no two land on the same colour.
    static let plates: [Plate] = {
        var out: [Plate] = []
        func add(_ name: String, _ look: Look) { out.append(Plate(id: out.count, name: name, look: look)) }

        add("Limb", Look(
            shape: 0, scale: 1.00, angle: 0, soft: 0.3, warp: 0.45, detail: 3.4, mottle: 0.35,
            posX: -0.05, posY: 0,
            exposure: 0.05, contrast: 1.35, black: 0.05, gamma: 1, vignette: 0.35,
            grain: 0.16, gSize: 1.3, gDens: 0.9, gResp: 0.75, tex: 0, invert: false,
            c0: RGB(hex: "#000000"), c1: RGB(hex: "#6E7076"), c2: RGB(hex: "#F2F2F0")))

        add("Shaft", Look(
            shape: 1, scale: 1.15, angle: -38, soft: 0.5, warp: 0.3, detail: 3, mottle: 0.5,
            posX: -0.05, posY: 0,
            exposure: 0, contrast: 1.35, black: 0.06, gamma: 1.1, vignette: 0.2,
            grain: 0.2, gSize: 1.1, gDens: 0.95, gResp: 0.6,
            tex: 1, texAmt: 0.35, texScale: 1.1, invert: false,
            c0: RGB(hex: "#060302"), c1: RGB(hex: "#5A2E06"), c2: RGB(hex: "#FFCF87")))

        add("Satin", Look(
            shape: 2, scale: 1.10, angle: -22, soft: 0.4, warp: 0.75, detail: 3.6, mottle: 0.2,
            posX: 0, posY: 0,
            exposure: 0, contrast: 1.2, black: 0.04, gamma: 1, vignette: 0.15,
            grain: 0.28, gSize: 1, gDens: 1, gResp: 0.85, tex: 0, invert: false,
            c0: RGB(hex: "#0A0507"), c1: RGB(hex: "#7A4552"), c2: RGB(hex: "#FFE0D2")))

        add("Dune", Look(
            shape: 3, scale: 1.20, angle: -12, soft: 0.4, warp: 0.55, detail: 4.2, mottle: 0.3,
            posX: 0, posY: 0,
            exposure: -0.1, contrast: 1.45, black: 0.08, gamma: 1.1, vignette: 0.4,
            grain: 0.22, gSize: 1.2, gDens: 0.9, gResp: 0.8,
            tex: 2, texAmt: 0.25, texScale: 1, invert: false,
            c0: RGB(hex: "#0A0705"), c1: RGB(hex: "#6A4B32"), c2: RGB(hex: "#F4E3C8")))

        add("Plume", Look(
            shape: 4, scale: 1.05, angle: 0, soft: 0.4, warp: 0.9, detail: 4.5, mottle: 0.25,
            posX: 0, posY: 0,
            exposure: 0.2, contrast: 1.3, black: 0.1, gamma: 1.2, vignette: 0.45,
            grain: 0.2, gSize: 1.4, gDens: 0.85, gResp: 0.7, tex: 0, invert: false,
            c0: RGB(hex: "#05060B"), c1: RGB(hex: "#5B5A72"), c2: RGB(hex: "#EFE9F2")))

        add("Orb", Look(
            shape: 5, scale: 1.00, angle: 0, soft: 0.25, warp: 0.35, detail: 3.2, mottle: 0.2,
            posX: 0, posY: 0,
            exposure: 0.05, contrast: 1.25, black: 0.03, gamma: 1, vignette: 0.3,
            grain: 0.18, gSize: 1.5, gDens: 0.9, gResp: 0.9, tex: 0, invert: false,
            c0: RGB(hex: "#07070A"), c1: RGB(hex: "#6B6455"), c2: RGB(hex: "#F2EADB")))

        add("Chrome", Look(
            shape: 6, scale: 1.00, angle: 0, soft: 0.4, warp: 0.85, detail: 3.2, mottle: 0.15,
            posX: 0, posY: 0,
            bands: 3.0, blur: 0.06, streak: 0, streakAng: 0,
            exposure: 0, contrast: 1.45, black: 0.03, gamma: 1, vignette: 0.15, gloss: 0.55,
            grain: 0.12, gSize: 1, gDens: 0.85, gResp: 0.5, tex: 0, invert: false,
            c0: RGB(hex: "#03080E"), c1: RGB(hex: "#4E6E8C"), c2: RGB(hex: "#CFE2F2")))

        add("Oil", Look(
            shape: 6, scale: 1.35, angle: 20, soft: 0.4, warp: 1.2, detail: 4, mottle: 0.2,
            posX: 0, posY: 0,
            bands: 5.0, blur: 0.13, streak: 0, streakAng: 0,
            exposure: 0, contrast: 1.15, black: 0.02, gamma: 1, vignette: 0.2, gloss: 0.3,
            grain: 0.18, gSize: 1.1, gDens: 1, gResp: 0.7, tex: 0, invert: false,
            c0: RGB(hex: "#05010A"), c1: RGB(hex: "#A0219C"), c2: RGB(hex: "#7FF6FF")))

        add("Bloom", Look(
            shape: 7, scale: 1.05, angle: 0, soft: 0.4, warp: 0.55, detail: 3.4, mottle: 0.25,
            posX: 0, posY: 0,
            bands: 2, blur: 0.24, streak: 0, streakAng: 0,
            exposure: -0.3, contrast: 1.2, black: 0.14, gamma: 1.35, vignette: 0.55, gloss: 0,
            grain: 0.17, gSize: 1.2, gDens: 1, gResp: 0.35, tex: 0, invert: false,
            c0: RGB(hex: "#08040A"), c1: RGB(hex: "#7A2140"), c2: RGB(hex: "#FFD9A8")))

        add("Sfumato", Look(
            shape: 7, scale: 1.10, angle: -12, soft: 0.5, warp: 0.6, detail: 3, mottle: 0.3,
            posX: -0.05, posY: 0.05,
            bands: 2, blur: 0.50, streak: 0.12, streakAng: 70,
            exposure: -0.18, contrast: 1.15, black: 0.16, gamma: 1.25, vignette: 0.55, gloss: 0,
            grain: 0.17, gSize: 1.2, gDens: 1, gResp: 0.25, tex: 0, invert: false,
            c0: RGB(hex: "#060606"), c1: RGB(hex: "#4A4A4A"), c2: RGB(hex: "#A8A8A8")))

        add("Smear", Look(
            shape: 2, scale: 1.2, angle: 8, soft: 0.4, warp: 0.7, detail: 3.6, mottle: 0.3,
            posX: 0, posY: 0,
            bands: 2, blur: 0.55, streak: 0.92, streakAng: 92,
            exposure: -0.15, contrast: 1.35, black: 0.08, gamma: 1.15, vignette: 0.35, gloss: 0,
            grain: 0.24, gSize: 1, gDens: 1, gResp: 0.6, tex: 0, invert: false,
            c0: RGB(hex: "#01060E"), c1: RGB(hex: "#1E5C87"), c2: RGB(hex: "#D9EEF7")))

        add("Halftone", Look(
            shape: 6, scale: 1.3, angle: -10, soft: 0.4, warp: 0.9, detail: 3.4, mottle: 0.2,
            posX: 0, posY: 0,
            bands: 2.4, blur: 0.12, streak: 0, streakAng: 0,
            exposure: -0.1, contrast: 1.3, black: 0.07, gamma: 1.1, vignette: 0.3, gloss: 0.2,
            grain: 0.1, gSize: 1, gDens: 0.8, gResp: 0.6,
            tex: 4, texAmt: 0.75, texScale: 1.15, invert: false,
            c0: RGB(hex: "#04051A"), c1: RGB(hex: "#3B44A8"), c2: RGB(hex: "#DCDEFF")))

        add("Haze", Look(
            shape: 7, scale: 1.9, angle: 24, soft: 0.5, warp: 0.35, detail: 2.6, mottle: 0.2,
            posX: 0.1, posY: -0.1,
            bands: 2, blur: 0.5, streak: 0.3, streakAng: 20,
            exposure: -0.55, contrast: 0.85, black: 0.02, gamma: 1.45, vignette: 0.25, gloss: 0,
            grain: 0.2, gSize: 1.1, gDens: 1, gResp: 0.3, tex: 0, invert: false,
            c0: RGB(hex: "#030706"), c1: RGB(hex: "#3C6B5C"), c2: RGB(hex: "#E6F2E4")))

        add("Negative", Look(
            shape: 2, scale: 1.05, angle: 14, soft: 0.4, warp: 0.6, detail: 3.4, mottle: 0.3,
            posX: 0, posY: 0,
            exposure: 0, contrast: 1.15, black: 0.02, gamma: 0.95, vignette: 0.1,
            grain: 0.24, gSize: 1, gDens: 1, gResp: 0.5, tex: 0, invert: true,
            c0: RGB(hex: "#0C1020"), c1: RGB(hex: "#33406B"), c2: RGB(hex: "#FCF8EE")))

        return out
    }()

    static let sizeGroups: [SizeGroup] = [
        .init(group: "Phone", items: [
            .init(w: 1206, h: 2622, name: "iPhone 16 Pro · 17 Pro"),
            .init(w: 1320, h: 2868, name: "iPhone 16 Pro Max · 17 Pro Max"),
            .init(w: 1290, h: 2796, name: "iPhone 14 Pro Max · 15 Plus · 16 Plus"),
            .init(w: 1179, h: 2556, name: "iPhone 14 Pro · 15 · 15 Pro · 16"),
            .init(w: 1170, h: 2532, name: "iPhone 12 · 13 · 13 Pro · 14"),
            .init(w: 1125, h: 2436, name: "iPhone X · XS · 11 Pro"),
            .init(w: 1080, h: 2340, name: "iPhone 12 mini · 13 mini"),
            .init(w:  828, h: 1792, name: "iPhone XR · 11"),
            .init(w:  750, h: 1334, name: "iPhone SE 2 · SE 3"),
            .init(w: 1440, h: 3120, name: "Pixel 9 Pro · S24 Ultra"),
            .init(w: 1080, h: 2400, name: "Pixel 9 · Galaxy S24")
        ]),
        .init(group: "Tablet", items: [
            .init(w: 2048, h: 2732, name: "iPad Pro 12.9″"),
            .init(w: 1668, h: 2388, name: "iPad Pro 11″ · iPad Air")
        ]),
        .init(group: "Desktop", items: [
            .init(w: 2560, h: 1440, name: "QHD"),
            .init(w: 3840, h: 2160, name: "4K UHD"),
            .init(w: 3456, h: 2234, name: "MacBook Pro 16″"),
            .init(w: 3024, h: 1964, name: "MacBook Pro 14″")
        ]),
        .init(group: "Square & print", items: [
            .init(w: 2048, h: 2048, name: "Square"),
            .init(w: 3000, h: 3750, name: "4:5 print")
        ])
    ]

    static let allSizes: [OutputSize] = sizeGroups.flatMap(\.items)

    static let textures = ["None", "Dash", "Brush", "Weave", "Dots"]
}
