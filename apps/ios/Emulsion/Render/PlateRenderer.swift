//  PlateRenderer.swift
//  One pipeline, three jobs: the live preview, the picker thumbnails, and
//  full-resolution export. All three go through `encode` so a thumbnail and a
//  4K still can never disagree about what the plate looks like.

import Metal
import MetalKit
import CoreGraphics
import simd

enum RenderError: LocalizedError {
    case noDevice
    case noLibrary(String)
    case noTexture
    case noImage

    var errorDescription: String? {
        switch self {
        case .noDevice:            return "This device has no Metal GPU."
        case .noLibrary(let why):  return "The plate shader could not be loaded: \(why)"
        case .noTexture:           return "Ran out of memory making the image."
        case .noImage:             return "The image could not be encoded."
        }
    }
}

/// `@unchecked Sendable` because everything it holds — device, command queue,
/// pipeline state — is documented thread-safe, and the only blocking call
/// (`image`) is deliberately used off the main thread.
final class PlateRenderer: @unchecked Sendable {

    let device: MTLDevice
    private let queue: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState

    /// Offscreen work is written to this format; the live drawable uses whatever
    /// the MTKView is configured for, which is the same thing.
    static let pixelFormat: MTLPixelFormat = .bgra8Unorm

    /// Tiles are capped so a huge export never needs one huge allocation. 2048²
    /// is 16 MB — small enough to always succeed, big enough that a 4K plate is
    /// only six passes.
    private static let maxTile = 2048

    init() throws {
        guard let device = MTLCreateSystemDefaultDevice() else { throw RenderError.noDevice }
        self.device = device
        guard let queue = device.makeCommandQueue() else { throw RenderError.noDevice }
        self.queue = queue

        let library: MTLLibrary
        do { library = try device.makeDefaultLibrary(bundle: .main) }
        catch { throw RenderError.noLibrary(error.localizedDescription) }

        guard let vfn = library.makeFunction(name: "plateVertex"),
              let ffn = library.makeFunction(name: "plateFragment") else {
            throw RenderError.noLibrary("plateVertex / plateFragment missing")
        }

        let desc = MTLRenderPipelineDescriptor()
        desc.label = "Plate"
        desc.vertexFunction = vfn
        desc.fragmentFunction = ffn
        desc.colorAttachments[0].pixelFormat = Self.pixelFormat
        pipeline = try device.makeRenderPipelineState(descriptor: desc)
    }

    // MARK: - Core encode

    private func encode(_ uniforms: PlateUniforms,
                        into buffer: MTLCommandBuffer,
                        target: MTLTexture,
                        viewport: MTLViewport? = nil) {
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = target
        pass.colorAttachments[0].loadAction = .dontCare
        pass.colorAttachments[0].storeAction = .store
        guard let enc = buffer.makeRenderCommandEncoder(descriptor: pass) else { return }
        enc.label = "Plate pass"
        enc.setRenderPipelineState(pipeline)
        if let viewport { enc.setViewport(viewport) }
        var u = uniforms
        enc.setFragmentBytes(&u, length: MemoryLayout<PlateUniforms>.stride, index: 0)
        enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        enc.endEncoding()
    }

    // MARK: - Preview

    /// Draws straight into the view's drawable. Nothing here waits on the GPU,
    /// so a slider drag never blocks the main thread on a slow frame — the cost
    /// of the frame comes back later through `gpuMilliseconds`, used for
    /// slow-frame diagnostics.
    /// Returns the size actually rendered, or `.zero` if the frame did not
    /// happen. The caller needs to know: `currentDrawable` is nil often enough
    /// to matter, and for a frame or two after `drawableSize` changes the
    /// drawable handed back is still the *old* size. A caller that assumes it
    /// drew what it asked for will quietly keep a stale, lower-resolution
    /// picture on screen.
    @discardableResult
    func drawPreview(_ params: Params, in view: MTKView,
                  gpuMilliseconds: (@Sendable (Double) -> Void)? = nil) -> CGSize {
        guard let drawable = view.currentDrawable,
              let buffer = queue.makeCommandBuffer() else { return .zero }
        let w = drawable.texture.width, h = drawable.texture.height
        guard w > 1, h > 1 else { return .zero }
        let u = params.uniforms(renderWidth: w, renderHeight: h)
        encode(u, into: buffer, target: drawable.texture)
        if let gpuMilliseconds {
            buffer.addCompletedHandler { cb in
                gpuMilliseconds((cb.gpuEndTime - cb.gpuStartTime) * 1000)
            }
        }
        buffer.present(drawable)
        buffer.commit()
        return CGSize(width: w, height: h)
    }

    // MARK: - Offscreen

    private func makeTexture(_ w: Int, _ h: Int) throws -> MTLTexture {
        let d = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: Self.pixelFormat, width: w, height: h, mipmapped: false)
        d.usage = [.renderTarget, .shaderRead]
        d.storageMode = .shared
        guard let t = device.makeTexture(descriptor: d) else { throw RenderError.noTexture }
        return t
    }

    /// Renders the plate at `width × height` and hands back a CGImage.
    ///
    /// Anything larger than one tile is drawn in strips: `res` stays the full
    /// size so grain, aspect and vignette are computed against the whole
    /// picture, and each pass only says which corner it is filling. That is why
    /// an 8K export needs 16 MB of texture rather than 268 MB, and why a strip
    /// is bit-identical to the same strip of a one-shot render.
    func image(_ params: Params, width: Int, height: Int) throws -> CGImage {
        let w = max(1, width), h = max(1, height)
        let bytesPerRow = w * 4
        var pixels = [UInt8](repeating: 0, count: bytesPerRow * h)

        let tileW = min(w, Self.maxTile)
        let tileH = min(h, Self.maxTile)
        let tile = try makeTexture(tileW, tileH)

        var y = 0
        while y < h {
            let rows = min(tileH, h - y)
            var x = 0
            while x < w {
                let cols = min(tileW, w - x)
                guard let buffer = queue.makeCommandBuffer() else { throw RenderError.noTexture }
                let u = params.uniforms(renderWidth: w, renderHeight: h,
                                        tileOrigin: simd_float2(Float(x), Float(y)))
                // The viewport keeps the draw inside the live part of the tile,
                // so a short final strip does not sample past the image.
                encode(u, into: buffer, target: tile,
                       viewport: MTLViewport(originX: 0, originY: 0,
                                             width: Double(cols), height: Double(rows),
                                             znear: 0, zfar: 1))
                buffer.commit()
                buffer.waitUntilCompleted()

                pixels.withUnsafeMutableBytes { raw in
                    let base = raw.baseAddress!.advanced(by: y * bytesPerRow + x * 4)
                    tile.getBytes(base,
                                  bytesPerRow: bytesPerRow,
                                  from: MTLRegionMake2D(0, 0, cols, rows),
                                  mipmapLevel: 0)
                }
                x += cols
            }
            y += rows
        }

        return try Self.cgImage(bgra: pixels, width: w, height: h, bytesPerRow: bytesPerRow)
    }

    private static func cgImage(bgra: [UInt8], width: Int, height: Int,
                                bytesPerRow: Int) throws -> CGImage {
        let data = Data(bgra)
        guard let provider = CGDataProvider(data: data as CFData),
              let image = CGImage(
                width: width, height: height,
                bitsPerComponent: 8, bitsPerPixel: 32,
                bytesPerRow: bytesPerRow,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGBitmapInfo(rawValue:
                    CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue),
                provider: provider, decode: nil, shouldInterpolate: false,
                intent: .defaultIntent)
        else { throw RenderError.noImage }
        return image
    }
}
