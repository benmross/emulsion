//  Exporter.swift
//  Getting the plate out: one still, or a set of seed variations.
//
//  The whole point of Emulsion is that the export is not a stretched preview —
//  the field is evaluated per pixel at the resolution you asked for. So none of
//  this scales anything up. A 4K still is 8.3 million separate evaluations of
//  the same maths the preview ran on ninety thousand.

import UIKit
import Photos
import UniformTypeIdentifiers
import os

let exportLog = Logger(subsystem: "com.benmross.emulsion", category: "export")

/// Lets a render running on another queue be stopped from the main actor.
final class CancelToken: @unchecked Sendable {
    private let lock = NSLock()
    private var flag = false
    var isCancelled: Bool { lock.withLock { flag } }
    func cancel() { lock.withLock { flag = true } }
}

enum ExportError: LocalizedError {
    case photoAccessDenied
    case encodeFailed
    case cancelled

    var errorDescription: String? {
        switch self {
        case .photoAccessDenied:
            return "Emulsion needs permission to add to your photo library. Settings › Emulsion › Photos › Add Photos Only."
        case .encodeFailed:
            return "The image could not be written."
        case .cancelled:
            return "Cancelled."
        }
    }
}

struct Exporter: Sendable {

    let renderer: PlateRenderer

    // MARK: - Stills

    func data(for params: Params) throws -> Data {
        let image = try renderer.image(params, width: params.width, height: params.height)
        return try Self.encode(image, as: params.format)
    }

    static func encode(_ image: CGImage, as format: ExportFormat) throws -> Data {
        let type: CFString
        var options: [CFString: Any] = [:]
        switch format {
        case .png:
            type = UTType.png.identifier as CFString
        case .heic:
            type = UTType.heic.identifier as CFString
            options[kCGImageDestinationLossyCompressionQuality] = 0.92
        case .jpeg:
            type = UTType.jpeg.identifier as CFString
            options[kCGImageDestinationLossyCompressionQuality] = 0.94
        }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, type, 1, nil) else {
            throw ExportError.encodeFailed
        }
        CGImageDestinationAddImage(dest, image, options as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { throw ExportError.encodeFailed }
        return out as Data
    }

    /// Writes to a temp file, because a share sheet handing over a *named file*
    /// is how you get "Save Image" and AirDrop and Files, where handing over a
    /// UIImage only gets you some of them.
    func temporaryFile(for params: Params, index: Int? = nil) throws -> URL {
        let bytes = try data(for: params)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(Self.name(params, index: index))
        try bytes.write(to: url, options: .atomic)
        return url
    }

    static func name(_ params: Params, index: Int? = nil) -> String {
        var parts = ["emulsion", "\(params.width)x\(params.height)",
                     String(format: "s%04d", params.seedNumber)]
        if let index { parts.append(String(format: "%02d", index + 1)) }
        return parts.joined(separator: "-") + "." + params.format.fileExtension
    }

    // MARK: - Photo library

    @discardableResult
    static func requestAddAccess() async -> Bool {
        switch PHPhotoLibrary.authorizationStatus(for: .addOnly) {
        case .authorized, .limited:
            return true
        case .notDetermined:
            return await PHPhotoLibrary.requestAuthorization(for: .addOnly) == .authorized
        default:
            return false
        }
    }

    static func saveToPhotos(fileAt url: URL) async throws {
        try await saveToPhotos(files: [url])
    }

    /// Several files in one library change, retried once. A set used to be six
    /// separate changes with no retry, and one Photos hiccup (seen once, on
    /// 6 November) stopped it partway with some images saved and some not.
    static func saveToPhotos(files: [URL]) async throws {
        guard await requestAddAccess() else { throw ExportError.photoAccessDenied }
        let change = {
            for url in files {
                let request = PHAssetCreationRequest.forAsset()
                request.addResource(with: .photo, fileURL: url, options: nil)
            }
        }
        do {
            try await PHPhotoLibrary.shared().performChanges(change)
        } catch {
            exportLog.error("Photos save failed, retrying once: \(error.localizedDescription, privacy: .public)")
            try await Task.sleep(for: .milliseconds(400))
            try await PHPhotoLibrary.shared().performChanges(change)
        }
    }

    // MARK: - Sets

    struct SetItem: @unchecked Sendable {
        let url: URL
        let seed: Int
        /// Small enough to show six at once; rendered, not downscaled, so it
        /// has the same grain the full image does.
        let thumbnail: CGImage?
    }

    /// Seed variations of the current look. Everything else is held still, so a
    /// set is the same picture rolled again rather than a different look. The
    /// first one keeps your seed, so the plate you were looking at is in it.
    func exportSet(_ params: Params, cancel: CancelToken,
                   progress: @escaping @Sendable (Int, Int) -> Void) throws -> [SetItem] {
        var items: [SetItem] = []
        let n = params.setSize
        var used: Set<Int> = [params.seedNumber]
        for i in 0..<n {
            if cancel.isCancelled { throw ExportError.cancelled }
            var q = params
            if i > 0 {
                var s = Int.random(in: 0...9999)
                while used.contains(s) { s = Int.random(in: 0...9999) }
                used.insert(s)
                q.seedNumber = s
            }
            let url = try temporaryFile(for: q, index: i)
            let tw = 240
            let th = max(1, Int((Double(tw) / Double(q.aspect)).rounded()))
            let thumb = try? renderer.image(q, width: tw, height: th)
            items.append(SetItem(url: url, seed: q.seedNumber, thumbnail: thumb))
            progress(i + 1, n)
        }
        return items
    }
}
