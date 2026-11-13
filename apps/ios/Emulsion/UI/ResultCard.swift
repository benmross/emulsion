//  ResultCard.swift
//  What a save leaves you with: where it went, how to make it your wallpaper,
//  and a way straight there.
//
//  The first user saved, then switched to Photos by hand, then asked how to
//  find his saved wallpaper. Every one of those steps is answered here.

import SwiftUI

struct ResultCard: View {
    let result: SaveResult
    let openPhotos: () -> Void
    let adopt: (Int) -> Void
    let dismiss: () -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 3)

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Theme.brass)
                Text(result.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.text)
            }

            if !result.variations.isEmpty {
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(result.variations) { v in
                        Button { adopt(v.seed) } label: {
                            ZStack(alignment: .bottomLeading) {
                                Group {
                                    if let image = v.image {
                                        Image(uiImage: image).resizable().scaledToFill()
                                    } else {
                                        Rectangle().fill(.white.opacity(0.06))
                                    }
                                }
                                .frame(height: 118)
                                .frame(maxWidth: .infinity)
                                .clipped()
                                Text("\(v.seed)")
                                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                                    .foregroundStyle(.white.opacity(0.85))
                                    .padding(5)
                            }
                            .clipShape(.rect(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Variation, seed \(v.seed)")
                        .accessibilityHint("Keeps editing with this seed")
                    }
                }
            }

            Text(result.howTo)
                .font(.system(size: 13))
                .foregroundStyle(Theme.mute)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 10) {
                Button(action: dismiss) {
                    Text("Done").frame(maxWidth: .infinity)
                }
                .plateButtonStyle()

                Button(action: openPhotos) {
                    Label("Open Photos", systemImage: "photo.on.rectangle")
                        .foregroundStyle(Color.black)
                        .frame(maxWidth: .infinity)
                }
                .plateButtonStyle(prominent: true)
                .tint(Theme.brass)
            }
            .font(.system(size: 14, weight: .semibold))
        }
        .padding(20)
        .plateGlass(in: .rect(cornerRadius: 26))
    }
}
