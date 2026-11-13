//  EmulsionApp.swift
//  One window, one renderer, portrait only.
//
//  The renderer is built here rather than in a view because compiling the
//  pipeline costs real milliseconds and there is exactly one of it for the
//  app's whole life. If Metal is not there at all we say so plainly instead of
//  showing a black rectangle.

import SwiftUI

@main
struct EmulsionApp: App {

    private let renderer: Result<PlateRenderer, Error>

    init() {
        renderer = Result { try PlateRenderer() }
    }

    var body: some Scene {
        WindowGroup {
            switch renderer {
            case .success(let renderer):
                ContentView(renderer: renderer)
            case .failure(let error):
                RendererUnavailable(error: error)
            }
        }
    }
}

private struct RendererUnavailable: View {
    let error: Error

    var body: some View {
        ZStack {
            Theme.ink.ignoresSafeArea()
            VStack(spacing: 14) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 34, weight: .light))
                    .foregroundStyle(Theme.brass)
                Text("Emulsion can't draw here")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.text)
                Text(error.localizedDescription)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.mute)
                    .multilineTextAlignment(.center)
            }
            .padding(34)
        }
        .preferredColorScheme(.dark)
    }
}
