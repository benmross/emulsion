//  Hints.swift
//  Two one-time pointers, in place of a tour.
//
//  The first user missed that the picture opens fullscreen
//  and where saving lives. Each hint names one of them,
//  appears once, and retires for good the moment you do the thing it points
//  at, whether or not you read it.

import SwiftUI

@MainActor
@Observable
final class Hints {

    enum Hint: String, CaseIterable {
        case fullscreen, save

        var text: String {
            switch self {
            case .fullscreen: return "Tap the picture to see it full screen"
            case .save:       return "Save puts it in Photos"
            }
        }
    }

    private(set) var showing: Hint?
    private var scheduled: Task<Void, Never>?

    init() {
        #if DEBUG
        if ProcessInfo.processInfo.environment["EMULSION_HINTS"] == "reset" {
            for h in Hint.allCases { UserDefaults.standard.removeObject(forKey: key(h)) }
        }
        if ProcessInfo.processInfo.environment["EMULSION_HINTS"] == "off" {
            for h in Hint.allCases { UserDefaults.standard.set(true, forKey: key(h)) }
        }
        #endif
    }

    private func key(_ h: Hint) -> String { "hint.\(h.rawValue).done" }
    private func done(_ h: Hint) -> Bool { UserDefaults.standard.bool(forKey: key(h)) }

    /// Shows the next hint not yet retired, after a pause, so hints never
    /// stack and never greet you before the picture has.
    func scheduleNext(after delay: Duration = .seconds(2.5)) {
        scheduled?.cancel()
        guard showing == nil, let next = Hint.allCases.first(where: { !done($0) }) else { return }
        scheduled = Task {
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled, !self.done(next) else { return }
            withAnimation(.snappy) { self.showing = next }
        }
    }

    /// The user did the thing, or dismissed the hint. Either way it is done.
    func retire(_ h: Hint) {
        guard !done(h) else { return }
        UserDefaults.standard.set(true, forKey: key(h))
        if showing == h {
            withAnimation(.snappy) { showing = nil }
            scheduleNext(after: .seconds(3))
        }
    }
}

/// A glass label with a pointer. Tapping it dismisses it.
struct HintBubble: View {
    let text: String
    var pointsUp = false
    let dismiss: () -> Void

    var body: some View {
        Button(action: dismiss) {
            HStack(spacing: 8) {
                if pointsUp {
                    Image(systemName: "arrow.up").font(.system(size: 11, weight: .bold))
                }
                Text(text)
                    .font(.system(size: 13, weight: .medium))
                    .multilineTextAlignment(.leading)
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Theme.mute)
            }
            .foregroundStyle(Theme.brassHi)
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .plateGlass(in: .capsule)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Dismisses this tip")
        .transition(.opacity.combined(with: .scale(scale: 0.92)))
    }
}
