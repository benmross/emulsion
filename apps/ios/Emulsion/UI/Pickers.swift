//  Pickers.swift
//  Every choice in this app is made from pictures.
//
//  Fourteen plates called Limb, Shaft, Satin and Oil are fourteen identical
//  words until you can see them, so each tile is a live render of that plate in
//  your own grain and output shape. Same for the eight fields and the fifteen
//  palettes. On a phone this is the difference between browsing and guessing.

import SwiftUI

/// Shared chrome for the three horizontal strips, so a plate tile, a shape tile
/// and a palette swatch all read as the same kind of thing.
private struct StripTile<Content: View>: View {
    let label: String
    let selected: Bool
    let size: CGSize
    let action: () -> Void
    @ViewBuilder var content: () -> Content

    var body: some View {
        Button(action: action) {
            VStack(spacing: 5) {
                content()
                    .frame(width: size.width, height: size.height)
                    .clipShape(.rect(cornerRadius: 11))
                    .overlay {
                        RoundedRectangle(cornerRadius: 11)
                            .strokeBorder(selected ? Theme.brass : Color.white.opacity(0.1),
                                          lineWidth: selected ? 2 : 0.7)
                    }
                Text(label)
                    .font(.system(size: 10.5, weight: selected ? .semibold : .regular))
                    .foregroundStyle(selected ? Theme.brass : Theme.mute)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(width: size.width + 8)
            }
        }
        .buttonStyle(.plain)
        .animation(.snappy(duration: 0.18), value: selected)
    }
}

/// A placeholder that looks like an unexposed plate rather than a grey box, so
/// the strip does not flash empty on the very first frame.
private struct TilePlaceholder: View {
    var body: some View {
        LinearGradient(colors: [Color.white.opacity(0.055), Color.white.opacity(0.015)],
                       startPoint: .top, endPoint: .bottom)
    }
}

struct PlateStrip: View {
    @Bindable var studio: Studio
    let thumbs: ThumbnailStore

    var body: some View {
        let size = CGSize(width: ThumbnailStore.width,
                          height: ThumbnailStore.height(for: studio.params))
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                HStack(spacing: 9) {
                    ForEach(Catalog.plates) { plate in
                        StripTile(label: plate.name,
                                  selected: studio.activePlate == plate.id,
                                  size: size,
                                  action: { studio.select(plate: plate.id) }) {
                            if let img = thumbs.plateImages[plate.id] {
                                Image(uiImage: img).resizable().scaledToFill()
                            } else {
                                TilePlaceholder()
                            }
                        }
                        .id(plate.id)
                    }
                }
                .padding(.horizontal, 2)
                .padding(.vertical, 2)
            }
            .scrollIndicators(.hidden)
            .onChange(of: studio.activePlate) { _, new in
                guard let new else { return }
                withAnimation(.snappy) { proxy.scrollTo(new, anchor: .center) }
            }
            .onAppear {
                if let i = studio.activePlate { proxy.scrollTo(i, anchor: .center) }
            }
        }
    }
}

struct ShapeStrip: View {
    @Bindable var studio: Studio
    let thumbs: ThumbnailStore

    var body: some View {
        let size = CGSize(width: ThumbnailStore.width,
                          height: ThumbnailStore.height(for: studio.params))
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text("Shape").controlLabel()
                Text(Catalog.shapes[Int(studio.params.look.shape)].hint)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.mute)
            }
            ScrollViewReader { proxy in
                ScrollView(.horizontal) {
                    HStack(spacing: 9) {
                        ForEach(Catalog.shapes) { shape in
                            StripTile(label: shape.name,
                                      selected: Int(studio.params.look.shape) == shape.id,
                                      size: size,
                                      action: {
                                          studio.params.look.shape = Int32(shape.id)
                                          studio.touchedLook()
                                          Haptics.select()
                                      }) {
                                if let img = thumbs.shapeImages[shape.id] {
                                    Image(uiImage: img).resizable().scaledToFill()
                                } else {
                                    TilePlaceholder()
                                }
                            }
                            .id(shape.id)
                        }
                    }
                    .padding(.horizontal, 2)
                    .padding(.vertical, 2)
                }
                .scrollIndicators(.hidden)
                .onAppear { proxy.scrollTo(Int(studio.params.look.shape), anchor: .center) }
            }
        }
    }
}

struct PaletteStrip: View {
    @Bindable var studio: Studio

    private var current: Palette? {
        Catalog.palettes.first { $0.matches(studio.params.look) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Palette").controlLabel()
            ScrollViewReader { proxy in
                ScrollView(.horizontal) {
                    HStack(spacing: 7) {
                        ForEach(Catalog.palettes) { palette in
                            let selected = palette.matches(studio.params.look)
                            Button {
                                studio.apply(palette: palette)
                            } label: {
                                VStack(spacing: 4) {
                                    LinearGradient(
                                        colors: [palette.c0.color, palette.c1.color, palette.c2.color],
                                        startPoint: .leading, endPoint: .trailing)
                                        .frame(width: 58, height: 22)
                                        .clipShape(.capsule)
                                        .overlay {
                                            Capsule().strokeBorder(
                                                selected ? Theme.brass : Color.white.opacity(0.12),
                                                lineWidth: selected ? 1.8 : 0.7)
                                        }
                                    Text(palette.name)
                                        .font(.system(size: 10, weight: selected ? .semibold : .regular))
                                        .foregroundStyle(selected ? Theme.brass : Theme.mute)
                                        .lineLimit(1)
                                        .frame(width: 62)
                                }
                            }
                            .buttonStyle(.plain)
                            .id(palette.name)
                        }
                    }
                    .padding(.horizontal, 2)
                    .padding(.vertical, 2)
                }
                .scrollIndicators(.hidden)
                .onAppear {
                    if let name = current?.name { proxy.scrollTo(name, anchor: .center) }
                }
            }
        }
    }
}

/// The three-stop ramp. Shadow, mid, light — the mid stop is movable, which is
/// what stops every plate from landing on the same curve.
struct RampRow: View {
    @Bindable var studio: Studio

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Color stops").controlLabel()
            HStack(spacing: 8) {
                stop("Shadow", \.c0)
                stop("Mid", \.c1)
                stop("Light", \.c2)
            }
        }
    }

    private func stop(_ tag: String, _ key: WritableKeyPath<Look, RGB>) -> some View {
        let binding = Binding<Color>(
            get: { studio.params.look[keyPath: key].color },
            set: { studio.params.look[keyPath: key] = RGB($0); studio.touchedLook() })
        return VStack(spacing: 4) {
            ColorPicker("", selection: binding, supportsOpacity: false)
                .labelsHidden()
                .scaleEffect(1.05)
            Text(tag)
                .font(.system(size: 10))
                .foregroundStyle(Theme.mute)
        }
        .frame(maxWidth: .infinity)
    }
}
