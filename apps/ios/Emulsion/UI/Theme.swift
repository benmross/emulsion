//  Theme.swift
//  The web app's identity, expressed in the terms iOS uses.
//
//  Emulsion on the web is near-black with a single brass accent, and that is
//  worth keeping — it is what makes the tool look like a darkroom rather than a
//  photo filter. What is NOT worth keeping is the web app's own chrome: its
//  hand-drawn panels, 1px hairlines and custom sliders all exist because the
//  browser gave it nothing. iOS gives us Liquid Glass, so the controls are
//  system material tinted brass, and the only colours we bring over are the
//  ones the pictures sit against.
//
//  Deliberately no bundled webfont. Syne and Instrument Sans are the web
//  wordmark; on iOS, SF at tight tracking is the thing that reads as native,
//  and shipping a display face for one line of text would be a worse trade.

import SwiftUI

enum Theme {

    /// Exercises the older-system presentation on a current simulator.
    static var useLegacyControls: Bool {
        #if DEBUG
        ProcessInfo.processInfo.environment["EMULSION_LEGACY_UI"] == "1"
        #else
        false
        #endif
    }

    static var reseedSymbol: String {
        if #available(iOS 18.0, *), !useLegacyControls {
            return "arrow.trianglehead.2.clockwise"
        }
        return "arrow.triangle.2.circlepath"
    }

    /// Behind everything. Matches --ink.
    static let ink = Color(red: 0x08 / 255, green: 0x09 / 255, blue: 0x0A / 255)

    /// The stage the plate sits on — a very slightly lifted radial, same as the
    /// web app's .stage gradient.
    static let stageTop = Color(red: 0x13 / 255, green: 0x14 / 255, blue: 0x17 / 255)
    static let stageMid = Color(red: 0x0B / 255, green: 0x0C / 255, blue: 0x0D / 255)
    static let stageBottom = Color(red: 0x07 / 255, green: 0x08 / 255, blue: 0x09 / 255)

    /// --gold-txt. The one accent, used for selection and nothing else.
    static let brass = Color(red: 0xD6 / 255, green: 0xAC / 255, blue: 0x70 / 255)
    static let brassHi = Color(red: 0xE9 / 255, green: 0xC5 / 255, blue: 0x8C / 255)
    static let brassLo = Color(red: 0xB9 / 255, green: 0x8A / 255, blue: 0x3F / 255)

    static let brassGradient = LinearGradient(
        colors: [brassHi, brassLo], startPoint: .topLeading, endPoint: .bottomTrailing)

    /// --text and --mute.
    static let text = Color(red: 0xED / 255, green: 0xEB / 255, blue: 0xE6 / 255)
    static let mute = Color(red: 0x8B / 255, green: 0x8F / 255, blue: 0x97 / 255)

    static var stage: some ShapeStyle {
        RadialGradient(colors: [stageTop, stageMid, stageBottom],
                       center: .top, startRadius: 0, endRadius: 900)
    }

    // Corner radii, chosen to nest: a tile inside a panel inside the screen.
    static let panelRadius: CGFloat = 30

    /// The display's own corner radius, which the control panel has to stay
    /// inside of. iOS exposes no public API for it, so this is the roundest
    /// current iPhone (16/17 Pro, 62pt). Over-estimating is the safe
    /// direction: a larger corner radius only ever removes area near the
    /// corner, so it cannot poke out on a squarer screen.
    static let screenRadius: CGFloat = 62
    static let tileRadius: CGFloat = 18
    static let plateRadius: CGFloat = 22
}

extension Text {
    /// The wordmark: tight, quiet, and not competing with the picture.
    func wordmark() -> Text {
        self.font(.system(size: 17, weight: .semibold))
            .tracking(-0.4)
    }
}

extension View {
    /// Keep Liquid Glass on current systems, with native material on iOS 17/18.
    @ViewBuilder
    func plateGlass<S: InsettableShape>(in shape: S) -> some View {
        if #available(iOS 26.0, *), !Theme.useLegacyControls {
            self.glassEffect(.regular, in: shape)
        } else {
            self.background(.ultraThinMaterial, in: shape)
                .overlay {
                    shape.strokeBorder(.white.opacity(0.12), lineWidth: 0.7)
                }
        }
    }

    @ViewBuilder
    func plateButtonStyle(prominent: Bool = false) -> some View {
        if #available(iOS 26.0, *), !Theme.useLegacyControls {
            if prominent { self.buttonStyle(.glassProminent) }
            else { self.buttonStyle(.glass) }
        } else {
            if prominent { self.buttonStyle(.borderedProminent) }
            else { self.buttonStyle(.bordered) }
        }
    }

    @ViewBuilder
    func plateGlassID(_ id: String, in namespace: Namespace.ID) -> some View {
        if #available(iOS 26.0, *), !Theme.useLegacyControls {
            self.glassEffectID(id, in: namespace)
        } else {
            self
        }
    }

    /// A caption over the picture, sized so it never fights the plate.
    func plateCaption() -> some View {
        self.font(.system(size: 13, weight: .medium))
            .tracking(0.6)
            .foregroundStyle(Theme.text)
    }

    /// A control's own label inside the sheet.
    func controlLabel() -> some View {
        self.font(.system(size: 13, weight: .medium))
            .foregroundStyle(Theme.text.opacity(0.86))
    }

    /// The right-hand read-out on a slider — always the same width family so
    /// the numbers do not jitter as they change.
    func controlValue() -> some View {
        self.font(.system(size: 13, weight: .medium, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(Theme.brass)
    }
}

struct PlateGlassContainer<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder let content: () -> Content

    var body: some View {
        if #available(iOS 26.0, *), !Theme.useLegacyControls {
            GlassEffectContainer(spacing: spacing, content: content)
        } else {
            content()
        }
    }
}
