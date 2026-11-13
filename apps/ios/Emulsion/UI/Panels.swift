//  Panels.swift
//  One panel per category, in the same order and with the same ranges as the
//  web app's rail. The ranges are not arbitrary — they are where the shader
//  still produces a picture — so they are copied from 04-controls.js exactly.

import SwiftUI

private let LOOK_DEFAULT = Look()
private let PARAM_DEFAULT = Params()

struct CategoryPanel: View {
    @Bindable var studio: Studio
    let thumbs: ThumbnailStore
    let actions: PlateActions

    var body: some View {
        switch studio.category {
        case .plates:  PlatesPanel(studio: studio, thumbs: thumbs)
        case .form:    FormPanel(studio: studio, thumbs: thumbs)
        case .optics:  OpticsPanel(studio: studio)
        case .tone:    TonePanel(studio: studio)
        case .color:   ColorPanel(studio: studio)
        case .grain:   GrainPanel(studio: studio)
        case .surface: SurfacePanel(studio: studio)
        case .output:  OutputPanel(studio: studio, actions: actions)
        }
    }
}

// MARK: - Plates

private struct PlatesPanel: View {
    @Bindable var studio: Studio
    let thumbs: ThumbnailStore

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            PlateStrip(studio: studio, thumbs: thumbs)
            HStack(spacing: 8) {
                Button {
                    studio.shuffle()
                } label: {
                    Label("Shuffle", systemImage: "dice").font(.system(size: 13, weight: .medium))
                }
                .plateButtonStyle()

                Button {
                    studio.newSeed()
                } label: {
                    Label("New seed", systemImage: Theme.reseedSymbol)
                        .font(.system(size: 13, weight: .medium))
                }
                .plateButtonStyle()
                Spacer(minLength: 0)
            }
        }
    }
}

// MARK: - Form

private struct FormPanel: View {
    @Bindable var studio: Studio
    let thumbs: ThumbnailStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ShapeStrip(studio: studio, thumbs: thumbs)
            look("Scale", \.scale, 0.25...4, 0.01, .times, LOOK_DEFAULT.scale)
            look("Rotation", \.angle, -180...180, 1, .degrees, LOOK_DEFAULT.angle)
            look("Edge softness", \.soft, 0.03...1, 0.005, .percent, LOOK_DEFAULT.soft)
            look("Warp", \.warp, 0...1.5, 0.01, .decimals(2), LOOK_DEFAULT.warp)
            look("Detail", \.detail, 1...6, 0.05, .octaves, LOOK_DEFAULT.detail)
            look("Mottle", \.mottle, 0...1, 0.01, .percent, LOOK_DEFAULT.mottle)
            look("Ripples", \.bands, 0.4...8, 0.05, .decimals(2), LOOK_DEFAULT.bands)
            look("Offset X", \.posX, -1.5...1.5, 0.01, .decimals(2), LOOK_DEFAULT.posX)
            look("Offset Y", \.posY, -1.5...1.5, 0.01, .decimals(2), LOOK_DEFAULT.posY)
        }
    }

    private func look(_ title: String, _ key: WritableKeyPath<Look, Float>,
                      _ range: ClosedRange<Float>, _ step: Float,
                      _ fmt: Fmt, _ def: Float) -> some View {
        LookSlider(studio: studio, title: title, key: key,
                   range: range, step: step, fmt: fmt, defaultValue: def)
    }
}

/// A slider bound to a *look* key, which means moving it drops the plate name —
/// you are no longer on Satin once you have changed Satin.
struct LookSlider: View {
    @Bindable var studio: Studio
    let title: String
    let key: WritableKeyPath<Look, Float>
    let range: ClosedRange<Float>
    let step: Float
    let fmt: Fmt
    let defaultValue: Float

    var body: some View {
        PlateSlider(title: title,
                    value: Binding(get: { studio.params.look[keyPath: key] },
                                   set: { studio.params.look[keyPath: key] = $0 }),
                    range: range, step: step, fmt: fmt, defaultValue: defaultValue,
                    onEdit: { studio.touchedLook() })
    }
}

// MARK: - Optics

private struct OpticsPanel: View {
    @Bindable var studio: Studio

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            LookSlider(studio: studio, title: "Blur", key: \.blur,
                       range: 0...1, step: 0.005, fmt: .percent, defaultValue: LOOK_DEFAULT.blur)
            LookSlider(studio: studio, title: "Streak", key: \.streak,
                       range: 0...1, step: 0.01, fmt: .percent, defaultValue: LOOK_DEFAULT.streak)
            LookSlider(studio: studio, title: "Streak angle", key: \.streakAng,
                       range: -180...180, step: 1, fmt: .degrees, defaultValue: LOOK_DEFAULT.streakAng)
                .padding(.top, 2)
        }
    }
}

// MARK: - Tone

private struct TonePanel: View {
    @Bindable var studio: Studio

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            LookSlider(studio: studio, title: "Exposure", key: \.exposure,
                       range: -2...2, step: 0.01, fmt: .ev, defaultValue: LOOK_DEFAULT.exposure)
            LookSlider(studio: studio, title: "Contrast", key: \.contrast,
                       range: 0.3...3, step: 0.01, fmt: .decimals(2), defaultValue: LOOK_DEFAULT.contrast)
            LookSlider(studio: studio, title: "Black point", key: \.black,
                       range: 0...0.6, step: 0.005, fmt: .percent, defaultValue: LOOK_DEFAULT.black)
            LookSlider(studio: studio, title: "Gamma", key: \.gamma,
                       range: 0.4...2.4, step: 0.01, fmt: .decimals(2), defaultValue: LOOK_DEFAULT.gamma)
            LookSlider(studio: studio, title: "Gloss", key: \.gloss,
                       range: 0...1, step: 0.01, fmt: .percent, defaultValue: LOOK_DEFAULT.gloss)
            LookSlider(studio: studio, title: "Vignette", key: \.vignette,
                       range: 0...1, step: 0.01, fmt: .percent, defaultValue: LOOK_DEFAULT.vignette)
        }
    }
}

// MARK: - Color

private struct ColorPanel: View {
    @Bindable var studio: Studio

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            PaletteStrip(studio: studio)
            RampRow(studio: studio)
            PlateSlider(title: "Mid stop", value: $studio.params.mid,
                        range: 0.1...0.9, step: 0.005, fmt: .percent,
                        defaultValue: PARAM_DEFAULT.mid)
            PlateToggle(title: "Invert tones", isOn: Binding(
                get: { studio.params.look.invert },
                set: { studio.params.look.invert = $0; studio.touchedLook() }))
        }
    }
}

// MARK: - Grain

private struct GrainPanel: View {
    @Bindable var studio: Studio

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            LookSlider(studio: studio, title: "Amount", key: \.grain,
                       range: 0...0.6, step: 0.005, fmt: .percent, defaultValue: LOOK_DEFAULT.grain)
            LookSlider(studio: studio, title: "Grain size", key: \.gSize,
                       range: 0.5...8, step: 0.05, fmt: .pixels, defaultValue: LOOK_DEFAULT.gSize)
            LookSlider(studio: studio, title: "Density", key: \.gDens,
                       range: 0.02...1, step: 0.005, fmt: .percent, defaultValue: LOOK_DEFAULT.gDens)
            LookSlider(studio: studio, title: "Midtone bias", key: \.gResp,
                       range: 0...1, step: 0.01, fmt: .percent, defaultValue: LOOK_DEFAULT.gResp)
            PlateToggle(title: "Color grain", isOn: $studio.params.chroma)
        }
    }
}

// MARK: - Surface

private struct SurfacePanel: View {
    @Bindable var studio: Studio

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            PlateSegmented(title: "Texture", options: Catalog.textures,
                           selection: Binding(
                            get: { Int(studio.params.look.tex) },
                            set: { studio.params.look.tex = Int32($0); studio.touchedLook() }))
            Group {
                LookSlider(studio: studio, title: "Depth", key: \.texAmt,
                           range: 0...1, step: 0.01, fmt: .percent, defaultValue: LOOK_DEFAULT.texAmt)
                LookSlider(studio: studio, title: "Texture scale", key: \.texScale,
                           range: 0.2...3, step: 0.01, fmt: .times, defaultValue: LOOK_DEFAULT.texScale)
            }
            // Nothing to weight or scale until there is an overlay to weight.
            .disabled(studio.params.look.tex == 0)
            .opacity(studio.params.look.tex == 0 ? 0.4 : 1)
        }
    }
}

// MARK: - Output

private struct OutputPanel: View {
    @Bindable var studio: Studio
    let actions: PlateActions

    private func secondary(_ title: String, _ symbol: String,
                           action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.system(size: 13, weight: .medium))
                .frame(maxWidth: .infinity)
        }
        .plateButtonStyle()
    }

    private var sizeLabel: String {
        let key = "\(studio.params.width)x\(studio.params.height)"
        if let match = Catalog.allSizes.first(where: { $0.id == key }) { return match.name }
        return "Custom"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Saving lives here, at the top, because this is where the first
            // user went looking for it.
            Button { actions.saveStill() } label: {
                Label("Save to Photos", systemImage: "square.and.arrow.down")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.black)
                    .frame(maxWidth: .infinity)
            }
            .plateButtonStyle(prominent: true)
            .tint(Theme.brass)

            HStack(spacing: 8) {
                secondary("\(studio.params.setSize) variations", "square.grid.2x2") { actions.exportSet() }
                secondary("Share", "square.and.arrow.up") { actions.shareStill() }
            }


            PlateMenuRow(title: "Size", value: sizeLabel) {
                ForEach(Catalog.sizeGroups) { group in
                    Section(group.group) {
                        ForEach(group.items) { size in
                            Button {
                                studio.params.width = size.w
                                studio.params.height = size.h
                                Haptics.select()
                            } label: {
                                Text("\(size.label) — \(size.name)")
                            }
                        }
                    }
                }
            }

            HStack(spacing: 12) {
                PlateNumberRow(title: "Width", value: $studio.params.width, range: 64...8192)
                PlateNumberRow(title: "Height", value: $studio.params.height, range: 64...8192)
            }

            HStack(spacing: 12) {
                PlateNumberRow(title: "Seed", value: $studio.params.seedNumber, range: 0...9999)
                Button { studio.newSeed() } label: {
                    Image(systemName: Theme.reseedSymbol)
                        .font(.system(size: 13, weight: .semibold))
                }
                .plateButtonStyle()
            }

            PlateToggle(title: "Lock screen guides", isOn: $studio.params.guides)

            PlateMenuRow(title: "File format", value: studio.params.format.label) {
                ForEach(ExportFormat.allCases) { f in
                    Button(f.label) { studio.params.format = f }
                }
            }

            PlateMenuRow(title: "Variations", value: "\(studio.params.setSize) stills") {
                ForEach([4, 6, 8, 12], id: \.self) { n in
                    Button("\(n) stills") { studio.params.setSize = n }
                }
            }

            Text(String(format: "%d × %d · %.1f MP", studio.params.width,
                        studio.params.height, studio.params.megapixels))
                .font(.system(size: 11, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Theme.mute)
        }
    }
}
