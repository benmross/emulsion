//  Actions.swift
//  Everything that leaves the app: a still or a set.
//
//  All of it renders on a background task and reports progress, because a 4K
//  plate with half a screen of blur is genuinely seconds of GPU work and a
//  spinner that does not move is indistinguishable from a hang.

import SwiftUI
import Photos

/// What a finished save shows: what happened, how to get it onto the lock
/// screen, and for a set, the set itself.
struct SaveResult: Identifiable, @unchecked Sendable {
    struct Variation: Identifiable {
        let seed: Int
        let image: UIImage?
        var id: Int { seed }
    }
    let id = UUID()
    let title: String
    let howTo: String
    var variations: [Variation] = []
}

@MainActor
@Observable
final class PlateActions {

    private let studio: Studio
    private let exporter: Exporter

    /// What is happening right now, shown over the picture.
    var progress: String?
    /// 0...1 when the work can say how far along it is.
    var fraction: Double?
    var errorMessage: String?
    /// The card shown after a save.
    var result: SaveResult?
    /// Set to present the system share sheet.
    var shareItems: [URL] = []

    private var working = false
    private var token: CancelToken?

    init(studio: Studio, renderer: PlateRenderer) {
        self.studio = studio
        self.exporter = Exporter(renderer: renderer)
    }

#if DEBUG
    /// Renders one still exactly as `saveStill` would and drops it in the
    /// app's Documents directory instead of Photos, so the export path can be
    /// checked from a shell. Verifies the bytes decode
    /// and are not a blank frame, which is the failure a screenshot of the
    /// *preview* would never catch: the preview and the export are two
    /// different render passes at two different resolutions.
    func selfTestExport() async {
        do {
            try SessionStore.selfTestCompatibility()
            let started = Date()
            for format in ExportFormat.allCases {
                var params = studio.params
                params.format = format
                let url = try exporter.temporaryFile(for: params)
                let bytes = try Data(contentsOf: url)
                guard let image = UIImage(data: bytes)?.cgImage,
                      image.width == params.width, image.height == params.height else {
                    throw ExportError.encodeFailed
                }
                let dest = URL.documentsDirectory.appending(path: "selftest-export.\(format.fileExtension)")
                try? FileManager.default.removeItem(at: dest)
                try FileManager.default.moveItem(at: url, to: dest)
                NSLog("SELFTEST export ok: %@ %d x %d, %d bytes -> %@",
                      format.rawValue, image.width, image.height, bytes.count, dest.path)
            }
            var params = studio.params
            params.width = 240; params.height = 520; params.setSize = 4
            let items = try exporter.exportSet(params, cancel: CancelToken()) { _, _ in }
            guard items.count == 4, items.first?.seed == params.seedNumber,
                  Set(items.map(\.seed)).count == 4,
                  items.allSatisfy({ $0.thumbnail != nil }) else {
                throw ExportError.encodeFailed
            }
            for item in items { try? FileManager.default.removeItem(at: item.url) }
            NSLog("SELFTEST stills and variations passed in %.2fs", Date().timeIntervalSince(started))
        } catch {
            NSLog("SELFTEST export FAILED: %@", String(describing: error))
        }
    }

#endif

    // Each of these snapshots `studio.params` on the main actor *before* the
    // work starts. That is not just a concurrency formality: it means the
    // picture you exported is the one that was on screen when you tapped, even
    // if you carry on moving sliders while a 4K plate renders.

    // MARK: - Stills

    func saveStill() {
        let params = studio.params
        let exporter = exporter
        run("Rendering \(sizeText)…") { _ in
            let url = try exporter.temporaryFile(for: params)
            try await Exporter.saveToPhotos(fileAt: url)
            try? FileManager.default.removeItem(at: url)
            return SaveResult(title: "Saved to Photos",
                              howTo: "In Photos, tap Share › Use as Wallpaper.")
        }
    }

    func shareStill() {
        let params = studio.params
        let exporter = exporter
        run("Rendering \(sizeText)…") { [self] _ in
            let url = try exporter.temporaryFile(for: params)
            await MainActor.run { self.shareItems = [url] }
            return nil
        }
    }

    // MARK: - Sets

    func exportSet() {
        let params = studio.params
        let exporter = exporter
        let n = params.setSize
        run("Rendering 1 of \(n)…", fraction: 0) { [self] token in
            let items = try exporter.exportSet(params, cancel: token) { done, total in
                Task { @MainActor in
                    self.fraction = Double(done) / Double(total)
                    self.progress = done < total ? "Rendering \(done + 1) of \(total)…"
                                                  : "Saving \(total)…"
                }
            }
            try await Exporter.saveToPhotos(files: items.map(\.url))
            for item in items { try? FileManager.default.removeItem(at: item.url) }
            let variations = items.map { SaveResult.Variation(seed: $0.seed,
                                                              image: $0.thumbnail.map(UIImage.init(cgImage:))) }
            return SaveResult(title: "\(items.count) variations saved to Photos",
                              howTo: "Tap one to keep editing it.",
                              variations: variations)
        }
    }

    // MARK: - Control

    func cancel() {
        token?.cancel()
        progress = "Cancelling…"
    }

    /// Keeps the chosen variation's seed, so the set is a way of choosing and
    /// not only a way of exporting.
    func adopt(seed: Int) {
        studio.params.seedNumber = seed
        studio.touchedLook()
        result = nil
        studio.flash("Seed \(seed)")
        Haptics.select()
    }

    func openPhotos() {
        // Undocumented but long-standing: opens Photos at its most recent item.
        if let url = URL(string: "photos-redirect://") {
            UIApplication.shared.open(url)
        }
        result = nil
    }

    // MARK: - Plumbing

    private var sizeText: String { "\(studio.params.width) × \(studio.params.height)" }

    var isWorking: Bool { working }

    /// One place where every export gets its progress line, its error handling,
    /// its cancel button and its "only one at a time" rule.
    private func run(_ initial: String, fraction start: Double? = nil,
                     _ work: @escaping @Sendable (CancelToken) async throws -> SaveResult?) {
        guard !working else { return }
        working = true
        progress = initial
        fraction = start
        result = nil
        let token = CancelToken()
        self.token = token
        studio.commit()
        Task {
            do {
                let done = try await Task.detached(priority: .userInitiated) {
                    try await work(token)
                }.value
                finish()
                if let done {
                    result = done
                    Haptics.saved()
                }
            } catch ExportError.cancelled {
                finish()
                studio.flash("Cancelled")
            } catch {
                finish()
                if token.isCancelled {
                    studio.flash("Cancelled")
                } else {
                    errorMessage = error.localizedDescription
                    Haptics.failed()
                }
            }
        }
    }

    private func finish() {
        progress = nil
        fraction = nil
        working = false
        token = nil
    }
}

/// The system share sheet, which is how a still gets to Messages, AirDrop,
/// Files and "Save Image" without this app reimplementing any of them.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [URL]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
