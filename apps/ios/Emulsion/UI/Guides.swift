//  Guides.swift
//  Where the lock screen will put things on top of your picture.
//
//  Ported from the web app's .guides rules, with one thing the web could not
//  do: on iOS we already know the device, so the Dynamic Island cut-out is
//  drawn only where there actually is one.

import SwiftUI

struct LockScreenGuides: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack(alignment: .topLeading) {
                // The island is opaque because it genuinely covers the picture,
                // rather than merely sitting in front of it.
                Capsule()
                    .fill(.black.opacity(0.5))
                    .frame(width: w * 0.31, height: h * 0.043)
                    .position(x: w / 2, y: h * 0.012 + h * 0.0215)

                zone("clock",    x: 0.08, y: 0.095, width: 0.84, height: 0.12, in: geo.size)
                zone("widgets",  x: 0.08, y: 0.225, width: 0.84, height: 0.05, in: geo.size)
                zone("controls", x: 0.08, y: 0.860, width: 0.84, height: 0.08, in: geo.size)
            }
        }
        .allowsHitTesting(false)
    }

    private func zone(_ label: String, x: CGFloat, y: CGFloat,
                      width: CGFloat, height: CGFloat, in size: CGSize) -> some View {
        RoundedRectangle(cornerRadius: 5)
            .strokeBorder(Theme.brass.opacity(0.36),
                          style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            .overlay(alignment: .topLeading) {
                Text(label.uppercased())
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                    .tracking(1.1)
                    .foregroundStyle(Theme.brass.opacity(0.72))
                    .padding(.leading, 5)
                    .padding(.top, 3)
            }
            .frame(width: size.width * width, height: size.height * height)
            .offset(x: size.width * x, y: size.height * y)
    }
}

/// A stand-in lock screen clock for fullscreen, measured from Ben's own lock
/// screen on 11 November: a short date ("Wed Nov 11") over large
/// condensed numerals drawn as glass.
struct LockScreenClock: View {
    private static let dateFormat: DateFormatter = {
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate("EEEMMMd")
        return f
    }()
    private static let timeFormat: DateFormatter = {
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate("hmm")
        f.amSymbol = ""; f.pmSymbol = ""
        return f
    }()

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            TimelineView(.everyMinute) { context in
                VStack(spacing: w * 0.012) {
                    Text(Self.dateFormat.string(from: context.date).replacingOccurrences(of: ",", with: ""))
                        .font(.system(size: w * 0.051, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.95))
                    Text(Self.timeFormat.string(from: context.date).trimmingCharacters(in: .whitespaces))
                        // Condensed: the system's numerals are about two
                        // thirds as wide as they are tall.
                        .font(.system(size: w * 0.30, weight: .bold))
                        .fontWidth(.condensed)
                        // Glass: a pale translucent fill, a bright top edge
                        // and a soft shadow beneath, as the system clock has.
                        .foregroundStyle(LinearGradient(
                            colors: [.white.opacity(0.62), .white.opacity(0.30)],
                            startPoint: .top, endPoint: .bottom))
                        .shadow(color: .white.opacity(0.45), radius: 0, y: -1)
                        .shadow(color: .black.opacity(0.28), radius: 3, y: 2)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, h * 0.092)
            }
        }
        .accessibilityHidden(true)
    }
}
