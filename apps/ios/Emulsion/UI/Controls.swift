//  Controls.swift
//  The control vocabulary: one slider, one switch, one picker row.
//
//  The web app draws its own sliders because a browser range input is ugly. We
//  use the system Slider on purpose — it already has the right thumb, the right
//  drag physics, and VoiceOver — and add the two things it lacks that the web
//  version had: a mark showing where the plate's default sits, and something
//  you can feel when you pass it. Double-tapping the label returns the slider
//  to that default, which the web app could not offer at all.

import SwiftUI

/// How each parameter reads out. Ported from the fmt closures in 04-controls.js.
enum Fmt {
    case percent
    case decimals(Int)
    case degrees
    case times
    case octaves
    case pixels
    case ev
    case seconds

    func string(_ v: Float) -> String {
        switch self {
        case .percent:        return "\(Int((v * 100).rounded()))%"
        case .decimals(let n): return String(format: "%.\(n)f", v)
        case .degrees:        return "\(Int(v.rounded()))°"
        case .times:          return String(format: "%.2f×", v)
        case .octaves:        return String(format: "%.1f oct", v)
        case .pixels:         return String(format: "%.2f px", v)
        case .ev:             return String(format: "%@%.2f EV", v > 0 ? "+" : "", v)
        case .seconds:        return String(format: "%.1f s", v)
        }
    }
}

struct PlateSlider: View {
    let title: String
    @Binding var value: Float
    let range: ClosedRange<Float>
    let step: Float
    let fmt: Fmt
    let defaultValue: Float
    var onEdit: () -> Void = {}

    @State private var lastSide: Int = 0

    private var fraction: CGFloat {
        CGFloat((defaultValue - range.lowerBound) / (range.upperBound - range.lowerBound))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(title).controlLabel()
                Spacer(minLength: 8)
                Text(fmt.string(value)).controlValue()
            }
            // Double-tapping the row's text is the reset, not the slider, so it
            // can never fire in the middle of a drag.
            .contentShape(.rect)
            .onTapGesture(count: 2) {
                withAnimation(.snappy(duration: 0.22)) { value = defaultValue }
                Haptics.tick()
                onEdit()
            }
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Double tap to reset \(title) to its default")

            Slider(value: $value, in: range, step: step) { editing in
                if !editing { onEdit() }
            }
            .tint(Theme.brass)
            .background(alignment: .leading) { defaultMark }
            .onChange(of: value) { _, new in
                onEdit()
                // A tick exactly as the value crosses the default — the same
                // information the web app's little notch carried, by feel.
                let side = new == defaultValue ? 0 : (new > defaultValue ? 1 : -1)
                if side != lastSide, lastSide != 0 || side == 0 { Haptics.tick() }
                lastSide = side
            }
            .onAppear {
                lastSide = value == defaultValue ? 0 : (value > defaultValue ? 1 : -1)
            }
        }
        .padding(.vertical, 1)
    }

    /// Sits under the track at the default value. Inset by half a thumb at each
    /// end so it lines up with where the thumb's *centre* can actually reach —
    /// the same alignment fix the web app needed.
    private var defaultMark: some View {
        GeometryReader { geo in
            let thumb: CGFloat = 27
            let travel = max(geo.size.width - thumb, 1)
            Capsule()
                .fill(Theme.brass.opacity(0.5))
                .frame(width: 2, height: 7)
                .offset(x: thumb / 2 + travel * fraction - 1,
                        y: geo.size.height / 2 - 3.5)
        }
        .allowsHitTesting(false)
    }
}

struct PlateToggle: View {
    let title: String
    @Binding var isOn: Bool
    var onEdit: () -> Void = {}

    var body: some View {
        Toggle(isOn: $isOn) { Text(title).controlLabel() }
            .toggleStyle(.switch)
            .tint(Theme.brass)
            .onChange(of: isOn) { _, _ in Haptics.select(); onEdit() }
    }
}

/// A row of pill choices. Used for Texture and the frame-rate options, where a
/// wheel picker would be four taps for a one-of-five decision.
struct PlateSegmented: View {
    let title: String
    let options: [String]
    @Binding var selection: Int
    var onEdit: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).controlLabel()
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(Array(options.enumerated()), id: \.offset) { i, name in
                        Button(name) {
                            selection = i
                            Haptics.select()
                            onEdit()
                        }
                        .buttonStyle(PillButtonStyle(selected: selection == i))
                    }
                }
                .padding(.horizontal, 1)
            }
            .scrollIndicators(.hidden)
        }
    }
}

struct PillButtonStyle: ButtonStyle {
    let selected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: selected ? .semibold : .regular))
            .foregroundStyle(selected ? Color.black : Theme.text.opacity(0.9))
            .padding(.horizontal, 13)
            .padding(.vertical, 8)
            .background {
                if selected {
                    Capsule().fill(Theme.brassGradient)
                } else {
                    Capsule().fill(.white.opacity(0.07))
                }
            }
            .opacity(configuration.isPressed ? 0.6 : 1)
            .animation(.snappy(duration: 0.15), value: selected)
    }
}

/// Label on the left, a compact menu on the right. This is the native answer to
/// the web app's <select>, and it collapses a twenty-entry size list into one
/// line that still says what is chosen.
struct PlateMenuRow<Content: View>: View {
    let title: String
    let value: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        HStack {
            Text(title).controlLabel()
            Spacer(minLength: 8)
            Menu {
                content()
            } label: {
                HStack(spacing: 4) {
                    Text(value)
                        .font(.system(size: 13, weight: .medium))
                        .lineLimit(1)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 9, weight: .semibold))
                }
                .foregroundStyle(Theme.brass)
            }
            .menuOrder(.fixed)
        }
    }
}

/// A stepping number field for width, height and seed. A keyboard is the wrong
/// tool on a phone for a value you mostly nudge, so this is tap-to-type with
/// steppers either side.
struct PlateNumberRow: View {
    let title: String
    @Binding var value: Int
    let range: ClosedRange<Int>
    var onEdit: () -> Void = {}

    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 10) {
            Text(title).controlLabel()
            Spacer(minLength: 4)
            TextField("", text: $text)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Theme.brass)
                .focused($focused)
                .frame(width: 66)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(Capsule().fill(.white.opacity(0.07)))
                .onAppear { text = "\(value)" }
                .onChange(of: value) { _, new in if !focused { text = "\(new)" } }
                .onChange(of: focused) { _, isFocused in
                    guard !isFocused else { return }
                    commit()
                }
                .toolbar {
                    if focused {
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button("Done") { focused = false }
                        }
                    }
                }
        }
    }

    private func commit() {
        let n = Int(text.filter(\.isNumber)) ?? value
        value = min(max(n, range.lowerBound), range.upperBound)
        text = "\(value)"
        onEdit()
    }
}
