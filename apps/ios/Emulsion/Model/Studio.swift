//  Studio.swift
//  The one piece of app state. SwiftUI observes this; the renderer reads it.
//
import SwiftUI
import Observation

@MainActor
@Observable
final class Studio {

    var params = Params()

    /// Which plate is showing, or nil once a slider has been moved — the app
    /// then says "Satin · shuffled" rather than claiming a plate you have
    /// since edited.
    var activePlate: Int? = 0

    var category: Category = .plates
    var sheetExpanded = true
    var immersive = false

    // MARK: - History

    /// Every settled state, oldest first. `cursor` is the one on screen.
    private(set) var history: [Snapshot] = []
    private(set) var cursor = 0
    private var commitTask: Task<Void, Never>?
    /// Set while undo or redo writes `params`, so the write is not itself
    /// recorded as a new edit.
    private var restoring = false
    private static let historyLimit = 80

    var canUndo: Bool { cursor > 0 || pendingEdit }
    var canRedo: Bool { cursor < history.count - 1 && !pendingEdit }

    private var current: Snapshot { Snapshot(params: params, activePlate: activePlate) }
    private var pendingEdit: Bool { history.indices.contains(cursor) && history[cursor] != current }

    init() {
        if let saved = SessionStore.load(), let last = saved.history[safe: saved.cursor] {
            history = saved.history
            cursor = saved.cursor
            params = last.params
            activePlate = last.activePlate
            category = Category(rawValue: saved.category) ?? .plates
        } else {
            history = [Snapshot(params: params, activePlate: activePlate)]
        }
        #if DEBUG
        if ProcessInfo.processInfo.environment["EMULSION_FRESH"] == "1" {
            params = Params(); activePlate = 0; category = .plates
            history = [Snapshot(params: params, activePlate: activePlate)]; cursor = 0
        }
        if ProcessInfo.processInfo.environment["EMULSION_IMMERSIVE"] == "1" { immersive = true }
        // Opens straight to one panel. A shell driving the simulator has no
        // way to synthesise a tap -- simctl has no such verb -- so without
        // this, screenshotting all eight categories to check their layout
        // would need a whole UI test target just to press seven buttons.
        // DEBUG-only, and read from the environment, so nothing in a release
        // build can reach it.
        if let name = ProcessInfo.processInfo.environment["EMULSION_CATEGORY"],
           let match = Category.allCases.first(where: {
               $0.title.caseInsensitiveCompare(name) == .orderedSame }) {
            category = match
        }
        // Same idea for the plate, so store screenshots can show a different
        // look in each frame instead of the same one five times.
        if let plate = ProcessInfo.processInfo.environment["EMULSION_PLATE"],
           let i = Catalog.plates.firstIndex(where: {
               $0.name.caseInsensitiveCompare(plate) == .orderedSame }) {
            select(plate: i)
        }
        #endif
    }

    /// Transient line over the picture: a plate name, or what an export did.
    var caption: String?
    private var captionToken = 0

    // Export progress, so a 4K still can show something happening.
    var busy: String?

    enum Category: Int, CaseIterable, Identifiable {
        // Raw values are saved in session.v1. Keep the former Motion slot (3)
        // unused so existing sessions reopen the same remaining panel.
        case plates = 0, form = 1, optics = 2
        case tone = 4, color = 5, grain = 6, surface = 7, output = 8
        var id: Int { rawValue }

        var title: String {
            switch self {
            case .plates:  return "Plates"
            case .form:    return "Form"
            case .optics:  return "Optics"
            case .tone:    return "Tone"
            case .color:   return "Color"
            case .grain:   return "Grain"
            case .surface: return "Surface"
            case .output:  return "Output"
            }
        }

        var symbol: String {
            switch self {
            case .plates:  return "square.stack.3d.down.right"
            case .form:    return "drop"
            case .optics:  return "camera.aperture"
            case .tone:    return "circle.lefthalf.filled"
            case .color:   return "paintpalette"
            case .grain:   return "aqi.medium"
            case .surface: return "line.diagonal"
            case .output:  return "square.and.arrow.down"
            }
        }
    }

    // MARK: - What the header says

    var plateName: String {
        if let i = activePlate { return Catalog.plates[i].name }
        return Catalog.shapes[Int(params.look.shape)].name + " · shuffled"
    }

    // MARK: - Edits

    /// Picking a plate moves the thirty keys it owns and resets the ones it does
    /// not name; your mid stop, output size, seed and format
    /// stay exactly where you put them.
    func select(plate index: Int) {
        guard Catalog.plates.indices.contains(index) else { return }
        params.look = Catalog.plates[index].look
        activePlate = index
        flash(Catalog.plates[index].name)
        Haptics.select()
    }

    /// Any hand edit to a look key means we are no longer on a plate.
    func touchedLook() {
        if activePlate != nil { activePlate = nil }
    }

    func apply(palette: Palette) {
        params.look.c0 = palette.c0
        params.look.c1 = palette.c1
        params.look.c2 = palette.c2
        touchedLook()
        Haptics.select()
    }

    func newSeed() {
        params.seedNumber = Int.random(in: 0...9999)
        Haptics.tick()
    }

    /// Same ranges as the web app's shuffle: enough movement to surprise, not
    /// enough to land on a black frame.
    func shuffle() {
        var l = params.look
        params.seedNumber = Int.random(in: 0...9999)
        l.angle  = Float(Int.random(in: -180...180))
        l.scale  = .random(in: 0.7...2.2)
        l.soft   = .random(in: 0.15...0.6)
        l.warp   = .random(in: 0.1...1.1)
        l.detail = .random(in: 2.5...5)
        l.mottle = .random(in: 0.1...0.6)
        l.posX   = .random(in: -0.5...0.5)
        l.posY   = .random(in: -0.4...0.4)
        l.bands  = .random(in: 1.2...4.5)
        if Bool.random() {
            l.blur = .random(in: 0.05...0.5)
            l.streak = .random(in: 0...0.9)
            l.streakAng = Float(Int.random(in: -180...180))
        } else {
            l.blur = .random(in: 0...0.12)
            l.streak = 0
        }
        params.look = l
        activePlate = nil
        Haptics.shuffle()
    }

    // MARK: - Undo

    /// Called on every change to `params`. A slider drag is hundreds of
    /// changes, so nothing is recorded until the edit has been still for half
    /// a second; a drag is then one step of undo, not three hundred.
    func noteChange() {
        guard !restoring else { return }
        commitTask?.cancel()
        commitTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            self.commit()
        }
    }

    /// Records the state on screen if it differs from the last one recorded.
    func commit() {
        commitTask?.cancel()
        commitTask = nil
        guard pendingEdit || history.isEmpty else { return }
        if cursor < history.count - 1 { history.removeSubrange((cursor + 1)...) }
        history.append(current)
        if history.count > Self.historyLimit { history.removeFirst(history.count - Self.historyLimit) }
        cursor = history.count - 1
        persist()
    }

    func undo() {
        commit()
        guard cursor > 0 else { return }
        cursor -= 1
        restore(history[cursor])
        flash("Undo")
    }

    func redo() {
        commit()
        guard cursor < history.count - 1 else { return }
        cursor += 1
        restore(history[cursor])
        flash("Redo")
    }

    private func restore(_ snap: Snapshot) {
        restoring = true
        params = snap.params
        activePlate = snap.activePlate
        Haptics.tick()
        persist()
        // onChange fires after this returns, so the flag has to outlive it.
        Task { self.restoring = false }
    }

    /// Writes the session to disk. Cheap: a few kilobytes of JSON.
    func persist() {
        var h = history
        var c = cursor
        // Whatever is on screen is saved even if it has not settled into
        // history yet, so backgrounding mid-drag still keeps the drag.
        if pendingEdit {
            if c < h.count - 1 { h.removeSubrange((c + 1)...) }
            h.append(current)
            c = h.count - 1
        }
        SessionStore.save(SavedSession(history: h, cursor: c, category: category.rawValue))
    }

    // MARK: - Caption

    func flash(_ text: String) {
        captionToken += 1
        let token = captionToken
        caption = text
        Task {
            try? await Task.sleep(for: .milliseconds(1600))
            if self.captionToken == token { self.caption = nil }
        }
    }
}

extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
