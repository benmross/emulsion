//  ContentView.swift
//  The plate is the screen.
//
//  This keeps the one decision that makes the web app's phone layout work — the
//  picture sits whole above the controls, never cropped, so what you see is what
//  lands on the lock screen — and throws away the rest of its chrome. The rail
//  becomes one Liquid Glass panel that floats over the stage; the category
//  strip is permanent so the picture never jumps as you move between groups;
//  and there is exactly one MTKView for the app's whole life, so going
//  fullscreen animates rather than flashes.

import SwiftUI

struct ContentView: View {

    let renderer: PlateRenderer
    @State private var studio: Studio
    @State private var thumbs: ThumbnailStore
    @State private var actions: PlateActions
    @State private var hints = Hints()
    /// The real safe area. The plate's own GeometryReader ignores the safe
    /// area, so its insets read zero, which is how the picture ended up
    /// starting underneath the status bar and the top buttons.
    @State private var safe = EdgeInsets()

    @Namespace private var glass
    @Environment(\.displayScale) private var displayScale
    @Environment(\.scenePhase) private var scenePhase

    init(renderer: PlateRenderer) {
        self.renderer = renderer
        let studio = Studio()
        _studio = State(initialValue: studio)
        _thumbs = State(initialValue: ThumbnailStore(renderer: renderer))
        _actions = State(initialValue: PlateActions(studio: studio, renderer: renderer))
    }

    var body: some View {
        ZStack {
            Rectangle().fill(Theme.stage).ignoresSafeArea()

            // Full-screen coordinates, insetting itself from
            // `geo.safeAreaInsets`, because the panel below now reaches past
            // the bottom inset and the stage has to account for that.
            plate
                .ignoresSafeArea()

            if !studio.immersive {
                VStack(spacing: 0) {
                    topChrome
                    Spacer(minLength: 0)
                    historyRow
                    sheet
                }
                // So the panel can sit `bezel` from the bottom edge rather
                // than resting on top of the home-indicator inset.
                .ignoresSafeArea(edges: .bottom)
            }

            overlays
        }
        .background(Theme.ink)
        .background {
            GeometryReader { g in
                Color.clear
                    .onAppear { safe = g.safeAreaInsets }
                    .onChange(of: g.safeAreaInsets) { _, new in safe = new }
            }
        }
        .preferredColorScheme(.dark)
        .tint(Theme.brass)
        .statusBarHidden(studio.immersive)
        .persistentSystemOverlays(studio.immersive ? .hidden : .automatic)
        .animation(.smooth(duration: 0.38), value: studio.immersive)
        .animation(.snappy(duration: 0.28), value: studio.sheetExpanded)
        .task {
            Haptics.prepare()
            studio.flash("Emulsion")
            #if DEBUG
            if ProcessInfo.processInfo.environment["EMULSION_SELFTEST"] == "export" {
                await actions.selfTestExport()
            }
            // Changes a plate after launch, the way a finger would, so a
            // relaunch can show whether it was kept.
            if ProcessInfo.processInfo.environment["EMULSION_SELFTEST"] == "persist" {
                try? await Task.sleep(for: .milliseconds(500))
                studio.select(plate: 5)
                studio.params.look.exposure = 0.4
            }
            if ProcessInfo.processInfo.environment["EMULSION_SELFTEST"] == "result" {
                actions.result = SaveResult(
                    title: "6 variations saved to Photos",
                    howTo: "Tap one to keep editing it.",
                    variations: (0..<6).map { SaveResult.Variation(seed: $0, image: nil) })
            }
            if ProcessInfo.processInfo.environment["EMULSION_SELFTEST"] == "progress" {
                actions.progress = "Rendering 3 of 6…"
                actions.fraction = 0.45
            }
            // Ben, 8 Sep: "switching between plate options, the noise
            // resolution seems to randomly be lower sometimes". Walks the
            // plates the way a finger would and lets each one settle, so the
            // SETTLE lines above say whether full resolution actually landed.
            if ProcessInfo.processInfo.environment["EMULSION_SELFTEST"] == "plates" {
                for i in 0..<min(8, Catalog.plates.count) {
                    studio.select(plate: i)
                    try? await Task.sleep(for: .milliseconds(700))
                }
            }
            #endif
            hints.scheduleNext(after: .seconds(1.8))
        }
        .onChange(of: studio.params) { _, _ in
            refreshThumbs()
            studio.noteChange()
        }
        .onChange(of: studio.category) { _, _ in
            refreshThumbs()
            studio.persist()
        }
        .onChange(of: actions.progress) { _, new in
            if new != nil { hints.retire(.save) }
        }
        .onChange(of: scenePhase) { _, phase in
            // The moment the app leaves the screen is the last moment it is
            // guaranteed to run. iOS may evict it from the background without
            // another word.
            if phase != .active { studio.persist() }
        }
        .onAppear { refreshThumbs() }
        .sheet(isPresented: Binding(get: { !actions.shareItems.isEmpty },
                                    set: { if !$0 { actions.shareItems = [] } })) {
            ShareSheet(items: actions.shareItems)
                .presentationDetents([.medium, .large])
        }
        .alert("Couldn't finish", isPresented: Binding(
            get: { actions.errorMessage != nil },
            set: { if !$0 { actions.errorMessage = nil } })
        ) {
            Button("OK", role: .cancel) { actions.errorMessage = nil }
        } message: {
            Text(actions.errorMessage ?? "")
        }
    }

    // MARK: - The picture

    /// Aspect-fit inside whatever space the chrome leaves, so the plate is
    /// whole. In fullscreen it fills instead, because that is how a wallpaper
    /// actually sits on a screen.
    private var plate: some View {
        GeometryReader { geo in
            let box = plateBox(in: geo.size, insets: safe)
            ZStack {
                PlateView(renderer: renderer, params: studio.params)
                    .frame(width: box.width, height: box.height)
                    .clipShape(.rect(cornerRadius: studio.immersive ? 0 : Theme.plateRadius))
                    .overlay {
                        if !studio.immersive {
                            RoundedRectangle(cornerRadius: Theme.plateRadius)
                                .strokeBorder(.white.opacity(0.07), lineWidth: 0.7)
                        }
                    }
                    .overlay {
                        if studio.params.guides {
                            LockScreenGuides()
                                .frame(width: box.width, height: box.height)
                        }
                    }
                    .shadow(color: .black.opacity(studio.immersive ? 0 : 0.55),
                            radius: 22, y: 8)
                    .contentShape(.rect)
                    // One gesture only. A double tap used to shuffle, which
                    // made every single tap wait to see whether a second was
                    // coming, and nobody found it anyway: the dice does it.
                    .onTapGesture { toggleImmersive() }
                    .overlay(alignment: .topTrailing) {
                        if !studio.immersive { expandButton }
                    }
                    .accessibilityLabel("Plate preview, \(studio.plateName)")
                    .accessibilityHint("Shows it full screen")
                    .accessibilityAddTraits(.isButton)
            }
            .frame(width: box.width, height: box.height)
            .position(plateCenter(in: geo.size, insets: safe))
        }
    }

    /// The visible way into fullscreen. The first user never discovered that
    /// tapping the picture did it.
    private var expandButton: some View {
        Button { toggleImmersive() } label: {
            Image(systemName: "arrow.up.left.and.arrow.down.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.text)
                .frame(width: 30, height: 30)
                .plateGlass(in: .circle)
        }
        .buttonStyle(.plain)
        .padding(9)
        .accessibilityLabel("Full screen")
    }

    /// Where the plate's centre goes — the middle of the *stage*, not of the
    /// screen. `plateBox` already subtracts the top bar and the sheet out of
    /// the height it will fit into; centring the result in the full bounds as
    /// well spends that reservation twice, which pushed the picture down into
    /// the sheet by half the chrome and left an equal band of dead space
    /// above it. Measured on an iPhone 17 Pro: 114pt of a 425pt plate sat
    /// behind the panel.
    private func plateCenter(in size: CGSize, insets: EdgeInsets) -> CGPoint {
        guard !studio.immersive else {
            return CGPoint(x: size.width / 2, y: size.height / 2)
        }
        return CGPoint(x: size.width / 2,
                       y: stageTop(insets) + stageHeight(in: size, insets: insets) / 2)
    }

    /// The band the picture gets: under the top bar, over the control panel.
    /// In full-screen coordinates, so the top safe-area inset has to be added
    /// back and the panel's own bezel subtracted at the bottom.
    private func stageTop(_ insets: EdgeInsets) -> CGFloat { insets.top + 6 }

    private func stageHeight(in size: CGSize, insets: EdgeInsets) -> CGFloat {
        max(120, size.height - bezel - sheetHeight - stageTop(insets) - 6)
    }

    /// The wordmark sits in the left one and the buttons in the right one, so
    /// the picture is never narrower than the screen minus these two.
    private let sideColumn: CGFloat = 100

    /// The plate's own rectangle. Above the sheet when there is chrome, the
    /// whole screen when there is not — and it is measured from the output
    /// aspect, never cropped to the phone's.
    private func plateBox(in size: CGSize, insets: EdgeInsets) -> CGSize {
        let aspect = studio.params.aspect
        if studio.immersive {
            // Fill: the picture covers the screen the way a wallpaper does.
            let w = max(size.width, size.height * aspect)
            return CGSize(width: w, height: w / aspect)
        }
        let availableH = max(120, stageHeight(in: size, insets: insets) - 12)
        let availableW = max(120, size.width - 2 * sideColumn)
        let w = min(availableW, availableH * aspect)
        return CGSize(width: w, height: w / aspect)
    }

    /// The gap between the control panel and the screen edge, the same on all
    /// three sides. It was not: the panel sat *inside* the bottom safe area, so
    /// the visible bottom bezel was the ~34pt home-indicator inset plus 4pt of
    /// padding, against 8pt at the sides. Ben spotted it straight away.
    private let bezel: CGFloat = 8

    /// Held clear inside the panel's own bottom edge. The panel now reaches
    /// past the home indicator, so without this the category labels would sit
    /// underneath it.
    private let indicatorClearance: CGFloat = 14


    /// 330 rather than 292: at the shorter height every panel but Optics cut
    /// its fourth control in half (Tone lost Gamma, Grain sliced the Midtone
    /// bias knob, Output clipped Set size). The plate gives up 38pt of height
    /// for it and is still 387pt tall on an iPhone 17 Pro, which is the right
    /// side of that trade -- a picture slightly smaller reads fine, a control
    /// sawn through reads broken.
    private var sheetHeight: CGFloat {
        (studio.sheetExpanded ? 330 : 92) + indicatorClearance
    }

    // MARK: - Chrome

    /// The wordmark on the left; Save and Shuffle stacked on the right.
    /// Both live in the bars beside the picture rather than over it.
    private var topChrome: some View {
        HStack(alignment: .top) {
            Text("Emulsion")
                .wordmark()
                .foregroundStyle(Theme.text)
                .padding(.top, 9)
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 10) {
                saveButton
                Button {
                    studio.shuffle()
                } label: {
                    Image(systemName: "dice").font(.system(size: 15, weight: .medium))
                }
                .plateButtonStyle()
                .accessibilityLabel("Shuffle the look")
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 4)
    }

    /// Undo and redo, floating in the bars either side of the picture, just
    /// above the panel.
    private var historyRow: some View {
        HStack {
            historyButton("arrow.uturn.backward", label: "Undo",
                          enabled: studio.canUndo) { studio.undo() }
            Spacer(minLength: 0)
            historyButton("arrow.uturn.forward", label: "Redo",
                          enabled: studio.canRedo) { studio.redo() }
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
    }

    /// Tap saves to Photos. Touch and hold for variations and sharing.
    private var saveButton: some View {
        Menu {
            Button { actions.saveStill() } label: {
                Label("Save to Photos", systemImage: "photo")
            }
            Button { actions.exportSet() } label: {
                Label("Save \(studio.params.setSize) variations", systemImage: "square.grid.2x2")
            }
            Divider()
            Button { actions.shareStill() } label: {
                Label("Share image…", systemImage: "square.and.arrow.up")
            }
            Section(String(format: "%d × %d · %.1f MP", studio.params.width,
                           studio.params.height, studio.params.megapixels)) {
                EmptyView()
            }
        } label: {
            Text("Save")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.black)
                .padding(.horizontal, 4)
        } primaryAction: {
            actions.saveStill()
        }
        .plateButtonStyle(prominent: true)
        .tint(Theme.brass)
        .accessibilityLabel("Save to Photos")
        .accessibilityHint("Touch and hold for more ways to save")
    }

    // MARK: - The sheet

    private var sheet: some View {
        PlateGlassContainer(spacing: 18) {
            VStack(spacing: 0) {
                grabber

                if studio.sheetExpanded {
                    ScrollView {
                        CategoryPanel(studio: studio, thumbs: thumbs, actions: actions)
                            .padding(.horizontal, 16)
                            .padding(.top, 4)
                            // Enough that the last control can scroll clear
                            // of the fade above rather than ending inside it.
                            .padding(.bottom, 26)
                    }
                    .scrollIndicators(.hidden)
                    .scrollBounceBehavior(.basedOnSize)
                    .frame(height: sheetHeight - 84 - indicatorClearance)
                    // Whatever is still below the fold dissolves into the
                    // glass instead of being guillotined by the clip edge.
                    // A control cut through by a hard line looks like a bug;
                    // the same control fading out reads as "keep scrolling".
                    .mask {
                        LinearGradient(
                            stops: [.init(color: .black, location: 0),
                                    .init(color: .black, location: 0.86),
                                    .init(color: .black.opacity(0), location: 1)],
                            startPoint: .top, endPoint: .bottom)
                    }
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                categoryBar
                    .padding(.bottom, indicatorClearance)
            }
            .plateGlass(in: panelShape)
            // The glass draws itself in this shape, but its *contents* were
            // not bound by it, so the outer category tabs rendered past the
            // curve and out of the panel entirely. Nothing here should ever
            // paint outside the panel it lives in.
            .clipShape(panelShape)
            .plateGlassID("sheet", in: glass)
            .padding(.horizontal, bezel)
            .padding(.bottom, bezel)
        }
        .frame(height: sheetHeight)
    }

    /// The panel's bottom corners are concentric with the display's, so they
    /// follow the screen's curve instead of cutting across it. At the old
    /// uniform 30pt they cleared the corner by roughly -2pt on a 16 Pro --
    /// which is to say they did not, and the corners visibly clipped. The top
    /// corners are nowhere near an edge and stay at the panel's own radius.
    private var panelShape: UnevenRoundedRectangle {
        let outer = max(Theme.panelRadius, Theme.screenRadius - bezel)
        return UnevenRoundedRectangle(
            topLeadingRadius: Theme.panelRadius,
            bottomLeadingRadius: outer,
            bottomTrailingRadius: outer,
            topTrailingRadius: Theme.panelRadius,
            style: .continuous)
    }

    /// Trades the controls for more picture. The category strip never leaves,
    /// so collapsing does not cost you your place.
    private var grabber: some View {
        Button {
            studio.sheetExpanded.toggle()
            Haptics.tick()
        } label: {
            Capsule()
                .fill(Theme.mute.opacity(0.55))
                .frame(width: 38, height: 4.5)
                .padding(.vertical, 9)
                .frame(maxWidth: .infinity)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(studio.sheetExpanded ? "Collapse the controls" : "Show the controls")
        .simultaneousGesture(
            DragGesture(minimumDistance: 12)
                .onEnded { value in
                    let expand = value.translation.height < 0
                    if expand != studio.sheetExpanded {
                        studio.sheetExpanded = expand
                        Haptics.tick()
                    }
                }
        )
    }

    private func historyButton(_ symbol: String, label: String, enabled: Bool,
                               action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(enabled ? Theme.text : Theme.mute.opacity(0.4))
                .frame(width: 42, height: 42)
                .plateGlass(in: .circle)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(label)
    }

    private var categoryBar: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(Studio.Category.allCases) { category in
                        let on = studio.category == category
                        Button {
                            if !studio.sheetExpanded { studio.sheetExpanded = true }
                            studio.category = category
                            Haptics.select()
                        } label: {
                            VStack(spacing: 3) {
                                Image(systemName: category.symbol)
                                    .font(.system(size: 15, weight: .medium))
                                Text(category.title)
                                    .font(.system(size: 9.5, weight: on ? .semibold : .regular))
                            }
                            .frame(width: 58, height: 42)
                            .foregroundStyle(on ? Theme.brass : Theme.mute)
                            .background {
                                if on {
                                    RoundedRectangle(cornerRadius: 13)
                                        .fill(Theme.brass.opacity(0.13))
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .id(category)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.bottom, 8)
            }
            .scrollIndicators(.hidden)
            .onChange(of: studio.category) { _, new in
                withAnimation(.snappy) { proxy.scrollTo(new, anchor: .center) }
            }
            .onAppear {
                // Only onChange existed, so the selected tab was centred when
                // you moved to it but not when the bar first appeared -- open
                // on a category past the fold and it sat half-cut against the
                // edge. No animation: it should already be there.
                proxy.scrollTo(studio.category, anchor: .center)
            }
        }
        .frame(height: 54)
        // The bottom corners are concentric with the display now, so their
        // radius is large (54pt on a 16 Pro) and the corner curve eats into
        // this row from both ends. At the labels' height that curve is worth
        // about 12pt a side; 16 keeps the first and last tab clear of it with
        // a little to spare. It scrolls, so the inset costs nothing.
        .padding(.horizontal, 16)
    }

    // MARK: - Overlays

    private var overlays: some View {
        ZStack {
            if let progress = actions.progress {
                VStack(spacing: 14) {
                    if let fraction = actions.fraction {
                        ProgressView(value: fraction)
                            .progressViewStyle(.linear)
                            .tint(Theme.brass)
                            .frame(width: 190)
                    } else {
                        ProgressView().controlSize(.large).tint(Theme.brass)
                    }
                    Text(progress)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .tracking(1.4)
                        .foregroundStyle(Theme.brass)
                        .multilineTextAlignment(.center)
                    Button("Cancel") { actions.cancel() }
                        .font(.system(size: 13, weight: .medium))
                        .plateButtonStyle()
                }
                .padding(26)
                .plateGlass(in: .rect(cornerRadius: 24))
                .transition(.opacity.combined(with: .scale(scale: 0.94)))
            } else if let result = actions.result {
                ZStack {
                    Color.black.opacity(0.35)
                        .ignoresSafeArea()
                        .onTapGesture { actions.result = nil }
                    ResultCard(result: result,
                               openPhotos: { actions.openPhotos() },
                               adopt: { actions.adopt(seed: $0) },
                               dismiss: { actions.result = nil })
                        .padding(.horizontal, 22)
                }
                .transition(.opacity.combined(with: .scale(scale: 0.96)))
            } else if let caption = studio.caption {
                VStack {
                    Spacer()
                    Text(caption)
                        .plateCaption()
                        .padding(.horizontal, 16)
                        .padding(.vertical, 9)
                        .plateGlass(in: .capsule)
                        .padding(.bottom, studio.immersive ? 54 : sheetHeight + bezel + 64)
                }
                .ignoresSafeArea(edges: .bottom)
                .transition(.opacity)
                .allowsHitTesting(false)
            }

            if !studio.immersive, actions.progress == nil, actions.result == nil,
               let hint = hints.showing {
                VStack {
                    Spacer()
                    HintBubble(text: hint.text) { hints.retire(hint) }
                        .padding(.horizontal, 60)
                        .padding(.bottom, sheetHeight + bezel + 64)
                }
                .ignoresSafeArea(edges: .bottom)
            }

            if studio.immersive {
                LockScreenClock()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .transition(.opacity)
                VStack {
                    Spacer()
                    Text("Tap to leave fullscreen")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.mute)
                        .padding(.bottom, 18)
                }
                .allowsHitTesting(false)
                .transition(.opacity)
            }
        }
        .animation(.snappy(duration: 0.25), value: actions.progress)
        .animation(.snappy(duration: 0.25), value: actions.result?.id)
        .animation(.snappy(duration: 0.25), value: studio.caption)
    }

    // MARK: - Behaviour

    private func toggleImmersive() {
        studio.immersive.toggle()
        hints.retire(.fullscreen)
        Haptics.tick()
    }

    /// Shape tiles are expensive and only visible in Form, so they are only
    /// asked for when that panel is open.
    private func refreshThumbs() {
        thumbs.refresh(studio.params,
                       includeShapes: studio.category == .form,
                       scale: displayScale)
    }
}
