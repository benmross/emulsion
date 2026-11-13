//  Haptics.swift
//  Small, specific taps. A wallpaper tool is a thing you fiddle with, and
//  feeling the plate land is most of what makes it feel native rather than
//  like a page.

import UIKit

enum Haptics {
    private static let selection = UISelectionFeedbackGenerator()
    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let rigid = UIImpactFeedbackGenerator(style: .rigid)
    private static let notice = UINotificationFeedbackGenerator()

    static func prepare() {
        selection.prepare(); light.prepare(); rigid.prepare()
    }

    /// Moving between plates, palettes, shapes.
    static func select() { selection.selectionChanged(); selection.prepare() }

    /// A slider passing through its own default value.
    static func tick() { light.impactOccurred(intensity: 0.55); light.prepare() }

    static func shuffle() { rigid.impactOccurred(intensity: 0.8); rigid.prepare() }

    static func saved() { notice.notificationOccurred(.success) }
    static func failed() { notice.notificationOccurred(.error) }
}
