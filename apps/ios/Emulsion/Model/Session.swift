//  Session.swift
//  What survives the app being closed: the plate on screen, where you were in
//  the panel, and the undo history that got you there.
//
//  The first person to download Emulsion switched to Photos to look at his
//  export, iOS evicted the app behind him, and he came back to the default
//  plate with every setting gone. Everything lived in memory. Now the session
//  is written whenever it settles and whenever the app leaves the screen.

import Foundation

/// One point in the undo history. The whole parameter stack, not a diff: it is
/// a few hundred bytes, and a snapshot can never be applied out of order.
struct Snapshot: Equatable, Codable, Sendable {
    var params: Params
    var activePlate: Int?
}

struct SavedSession: Codable, Sendable {
    var history: [Snapshot]
    var cursor: Int
    var category: Int
}

enum SessionStore {

    private static let key = "session.v1"

    static func load() -> SavedSession? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return decodeTolerantly(data)
    }

    static func save(_ session: SavedSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    /// Synthesised `Codable` refuses a document that is missing any key, so the
    /// first update that adds a parameter would silently throw away every
    /// user's saved session. Instead each saved snapshot is laid over a
    /// freshly encoded default, so a key the save predates simply takes its
    /// default, and a key that no longer exists is ignored.
    static func decodeTolerantly(_ data: Data) -> SavedSession? {
        if let exact = try? JSONDecoder().decode(SavedSession.self, from: data) { return exact }

        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let history = root["history"] as? [[String: Any]],
              let defaults = try? JSONSerialization.jsonObject(
                with: JSONEncoder().encode(Snapshot(params: Params(), activePlate: nil)))
                as? [String: Any]
        else { return nil }

        let merged = history.map { merge(defaults, over: $0) }
        var repaired = root
        repaired["history"] = merged
        guard let fixed = try? JSONSerialization.data(withJSONObject: repaired) else { return nil }
        return try? JSONDecoder().decode(SavedSession.self, from: fixed)
    }

    /// `saved` wins wherever it has a key the defaults also have; nested
    /// dictionaries merge rather than replace.
    private static func merge(_ defaults: [String: Any], over saved: [String: Any]) -> [String: Any] {
        var out = defaults
        for (k, v) in saved where defaults[k] != nil {
            if let d = defaults[k] as? [String: Any], let s = v as? [String: Any] {
                out[k] = merge(d, over: s)
            } else {
                out[k] = v
            }
        }
        // activePlate is optional, so the default encodes without it.
        if let plate = saved["activePlate"] { out["activePlate"] = plate }
        return out
    }
}

#if DEBUG
extension SessionStore {
    /// Exercises legacy saves with motion settings and every saved category.
    /// No defaults are written, so testing cannot replace a working session.
    @MainActor
    static func selfTestCompatibility() throws {
        let snapshots = (0..<3).map { index -> Snapshot in
            var params = Params()
            params.seedNumber = 100 + index
            params.look.exposure = Float(index) * 0.2
            return Snapshot(params: params, activePlate: index)
        }
        let session = SavedSession(history: snapshots, cursor: 1, category: 8)
        var legacy = try JSONSerialization.jsonObject(with: JSONEncoder().encode(session)) as! [String: Any]
        var history = legacy["history"] as! [[String: Any]]
        for index in history.indices {
            var params = history[index]["params"] as! [String: Any]
            params["animate"] = true
            params["flow"] = 0.8
            params["loopLength"] = 3
            params["fps"] = 60
            history[index]["params"] = params
        }
        legacy["history"] = history
        for raw in 0...8 {
            legacy["category"] = raw
            let data = try JSONSerialization.data(withJSONObject: legacy)
            guard let loaded = decodeTolerantly(data), loaded.history == snapshots,
                  loaded.cursor == 1, loaded.category == raw,
                  (Studio.Category(rawValue: raw) ?? .plates).rawValue == (raw == 3 ? 0 : raw) else {
                throw CocoaError(.coderReadCorrupt)
            }
            let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(loaded)) as! [String: Any]
            let savedHistory = encoded["history"] as! [[String: Any]]
            for snapshot in savedHistory {
                let params = snapshot["params"] as! [String: Any]
                guard ["animate", "flow", "loopLength", "fps"].allSatisfy({ params[$0] == nil }) else {
                    throw CocoaError(.coderReadCorrupt)
                }
            }
        }
        NSLog("SELFTEST legacy session ok: 3 history entries, undo/redo cursor, all 9 saved categories")
    }
}
#endif
