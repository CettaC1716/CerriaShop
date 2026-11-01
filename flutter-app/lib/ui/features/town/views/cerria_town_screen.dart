import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../../../domain/models/cerria_models.dart';
import '../../../core/glass_container.dart';
import '../../settings/views/town_settings_sheet.dart';
import '../../store_modal/views/native_store_modal.dart';
import '../view_models/town_view_model.dart';

/// Main Screen of the Hybrid Native Flutter UI + Three.js 3D Canvas architecture.
/// Renders the Three.js 3D WebGL canvas (`?mode=flutter-3d-canvas`) at the base of a
/// `Stack`, with 60 FPS Native Flutter `BackdropFilter` Glassmorphism HUD widgets on top.
class CerriaTownScreen extends StatefulWidget {
  const CerriaTownScreen({
    super.key,
    required this.viewModel,
    required this.canvasUrl,
  });

  final TownViewModel viewModel;
  final String canvasUrl;

  @override
  State<CerriaTownScreen> createState() => _CerriaTownScreenState();
}

class _CerriaTownScreenState extends State<CerriaTownScreen> {
  WebViewController? _controller;
  Timer? _fallbackReadyTimer;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  @override
  void dispose() {
    _fallbackReadyTimer?.cancel();
    super.dispose();
  }

  void _initWebView() {
    try {
      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFFF5EFE4))
        ..setOnConsoleMessage((JavaScriptConsoleMessage msg) {
          debugPrint('[WebView JS] ${msg.message}');
        })
        ..addJavaScriptChannel(
          'FlutterBridgeChannel',
          onMessageReceived: (JavaScriptMessage message) {
            // Security guard: ignore oversized payloads (>64 KB)
            if (message.message.length > 65536) return;
            widget.viewModel.handleWebViewBridgeMessage(message.message);
          },
        )
        ..setNavigationDelegate(
          NavigationDelegate(
            onNavigationRequest: (NavigationRequest request) {
              // Strict Origin Whitelist: Only allow our local loopback 3D canvas server
              final uri = Uri.tryParse(request.url);
              if (uri != null &&
                  uri.scheme == 'http' &&
                  (uri.host == '127.0.0.1' || uri.host == 'localhost')) {
                return NavigationDecision.navigate;
              }
              if (request.url == 'about:blank') {
                return NavigationDecision.navigate;
              }
              if (uri != null && (uri.scheme == 'https' || uri.scheme == 'http')) {
                widget.viewModel.launchAffiliateUrl(request.url);
                return NavigationDecision.prevent;
              }
              debugPrint('[Security] Blocked external WebView navigation: ${request.url}');
              return NavigationDecision.prevent;
            },
            onPageStarted: (_) {
              widget.viewModel.updateLoadingProgress(25);
            },
            onPageFinished: (_) {
              widget.viewModel.updateLoadingProgress(60);
              _fallbackReadyTimer?.cancel();
              _fallbackReadyTimer = Timer(const Duration(milliseconds: 1200), () {
                if (mounted) {
                  widget.viewModel.markSceneReadyFallback();
                }
              });
            },
          ),
        )
        ..loadRequest(Uri.parse(widget.canvasUrl));

      widget.viewModel.attachWebViewController(controller);
      _controller = controller;
      // Extra safety timer in case onPageFinished is delayed
      _fallbackReadyTimer = Timer(const Duration(milliseconds: 3000), () {
        if (mounted) {
          widget.viewModel.markSceneReadyFallback();
        }
      });
    } catch (_) {
      // Safe fallback when running in widget test environment without platform WebView
      _controller = null;
      widget.viewModel.markSceneReadyFallback();
    }
  }

  @override
  Widget build(BuildContext context) {
    final vm = widget.viewModel;
    return ListenableBuilder(
      listenable: vm,
      builder: (context, webViewLayer) {
        final store = vm.currentStore;
        final leftNeighbor = vm.leftNeighbor;
        final rightNeighbor = vm.rightNeighbor;
        final bool canPopDirectly = !vm.isStoreInteriorOpen &&
            !vm.isCatalogModalOpen &&
            !vm.isStoreSummaryExpanded;

        return PopScope(
          canPop: canPopDirectly,
          onPopInvokedWithResult: (bool didPop, Object? result) {
            if (didPop) return;
            if (vm.isStoreInteriorOpen) {
              vm.exitStoreInterior();
            } else if (vm.isCatalogModalOpen) {
              vm.closeStoreCatalogModal();
            } else if (vm.isStoreSummaryExpanded) {
              vm.closeStoreSummaryCard();
            }
          },
          child: Scaffold(
            backgroundColor: const Color(0xFFF5EFE4),
            body: Stack(
              fit: StackFit.expand,
              children: <Widget>[
                // 1. Base Layer: Three.js 3D WebGL Canvas (cached & isolated from HUD rebuilds!)
                webViewLayer!,

                // 1B. Smooth Native Loading Indicator (0% -> 25% -> 60% -> 100%, auto-hides on SCENE_READY)
                if (!vm.isSceneReady)
                  IgnorePointer(
                    child: Center(
                      child: CerriaGlassContainer(
                        borderRadius: BorderRadius.circular(22),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 22,
                          vertical: 16,
                        ),
                        backgroundColor: const Color(0xF2FAF5ED),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 260),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: <Widget>[
                              const Text(
                                'Strawberry Corner',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Color(0xFF2B1E18),
                                  fontSize: 18,
                                  fontStyle: FontStyle.italic,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Preparing the Corner... ${vm.loadingProgress}%',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Color(0xFF6B503F),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 8),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(99),
                                child: LinearProgressIndicator(
                                  value: vm.loadingProgress / 100.0,
                                  minHeight: 5,
                                  backgroundColor: const Color(0xFFE4D7C3),
                                  valueColor: const AlwaysStoppedAnimation<Color>(
                                    Color(0xFFD84B4B),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),

                // 2. Native Flutter Glassmorphism HUD Layer (Hidden when 3D Store / Gedung Mayor interior is active)
                if (!vm.isStoreInteriorOpen)
                  SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          // 2A. Top Header: Orange Rounded `C` Icon + Serif `Cerria Town`
                          _TopBrandHeader(
                            onTapHome: () => vm.goToStore(0),
                          ),

                          const SizedBox(height: 12),

                          // 2B. Left & Right Neighbor Store Glass Cards Flanking the 3D Building
                          if (!vm.isStoreSummaryExpanded)
                            _NeighborStoreCardsRow(
                              leftNeighbor: leftNeighbor,
                              rightNeighbor: rightNeighbor,
                              onSelectStore: vm.goToStore,
                            ),

                          const Spacer(),

                          // 2C. Expandable Store Info Summary Sheet (when `Info ↑` is long-pressed or building tapped)
                          if (vm.isStoreSummaryExpanded)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _StoreInfoSummarySheet(
                                store: store,
                                storeNumber: vm.displayStoreNumber,
                                totalStores: vm.totalStores,
                                onClose: vm.closeStoreSummaryCard,
                                onEnterCatalog: () => vm.openStoreCatalogModal(),
                              ),
                            ),

                          // 2D. Thumb-Zone Row: [Strawberry Corner · Info ↑] (Expanded) + [← 5 / 7 →]
                          _ThumbZoneNavigationRow(
                            store: store,
                            storeNumber: vm.displayStoreNumber,
                            totalStores: vm.totalStores,
                            isSummaryOpen: vm.isStoreSummaryExpanded,
                            onTapStoreInfo: () => vm.openStoreCatalogModal(),
                            onLongPressStoreInfo: vm.toggleStoreSummaryCard,
                            onPrevStore: vm.prevStore,
                            onNextStore: vm.nextStore,
                          ),

                          const SizedBox(height: 8),

                          // 2E. Proportional Bottom Dock Bar (Anti-Terpotong + Tabular Figures Clock!)
                          _BottomCozyDockBar(
                            viewModel: vm,
                            onOpenSettings: () => _openSettingsModal(context),
                          ),
                        ],
                      ),
                    ),
                  ),

                // 3. Fallback Native Store Modal (for unit/widget test environments without WebView)
                if (vm.isCatalogModalOpen && !vm.isStoreInteriorOpen)
                  NativeStoreModal(viewModel: vm),
              ],
            ),
          ),
        );
      },
      child: RepaintBoundary(
        child: _controller != null
            ? WebViewWidget(controller: _controller!)
            : const ColoredBox(color: Color(0xFF223029)),
      ),
    );
  }

  void _openSettingsModal(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => TownSettingsSheet(viewModel: widget.viewModel),
    );
  }
}

/// Top Header: Orange circular `C` icon + Serif `Cerria Town` (`Interactive Fun Shopping & Lifestyle Town`).
class _TopBrandHeader extends StatelessWidget {
  const _TopBrandHeader({required this.onTapHome});

  final VoidCallback onTapHome;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topLeft,
      child: GestureDetector(
        onTap: onTapHome,
        child: CerriaGlassContainer(
          borderRadius: BorderRadius.circular(99),
          padding: const EdgeInsets.fromLTRB(8, 6, 16, 6),
          backgroundColor: const Color(0xB319221D),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const CerriaBrandLogo(size: 36),
              const SizedBox(width: 10),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      'Cerria Town',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.cormorantGaramond(
                        color: const Color(0xFFFFFDF9),
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        height: 1.0,
                      ),
                    ),
                    const SizedBox(height: 1),
                    const Text(
                      'Interactive Fun Shopping & Lifestyle Town',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Color(0xCCEDE3D5),
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Two dark frosted glass cards (`Circuit & Byte` & `Apex Sport`, or active store's neighbors)
/// flanking the 3D building cleanly on the left and right edges.
class _NeighborStoreCardsRow extends StatelessWidget {
  const _NeighborStoreCardsRow({
    required this.leftNeighbor,
    required this.rightNeighbor,
    required this.onSelectStore,
  });

  final CerriaNeighborSummary leftNeighbor;
  final CerriaNeighborSummary rightNeighbor;
  final ValueChanged<int> onSelectStore;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Flexible(
          child: _NeighborGlassPill(
            neighbor: leftNeighbor,
            isRight: false,
            onTap: () => onSelectStore(leftNeighbor.storeIndex),
          ),
        ),
        const SizedBox(width: 24),
        Flexible(
          child: Align(
            alignment: Alignment.topRight,
            child: _NeighborGlassPill(
              neighbor: rightNeighbor,
              isRight: true,
              onTap: () => onSelectStore(rightNeighbor.storeIndex),
            ),
          ),
        ),
      ],
    );
  }
}

class _NeighborGlassPill extends StatelessWidget {
  const _NeighborGlassPill({
    required this.neighbor,
    required this.isRight,
    required this.onTap,
  });

  final CerriaNeighborSummary neighbor;
  final bool isRight;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: CerriaGlassContainer(
        borderRadius: BorderRadius.circular(16),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        backgroundColor: const Color(0xAD18201C),
        child: Column(
          crossAxisAlignment:
              isRight ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: neighbor.accentColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Flexible(
                  child: Text(
                    neighbor.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFFFFFDF9),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              neighbor.summary,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Color(0xB8EDE3D5),
                fontSize: 9.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Optional Store Info Summary Card above the thumb-zone row.
class _StoreInfoSummarySheet extends StatelessWidget {
  const _StoreInfoSummarySheet({
    required this.store,
    required this.storeNumber,
    required this.totalStores,
    required this.onClose,
    required this.onEnterCatalog,
  });

  final CerriaStore store;
  final int storeNumber;
  final int totalStores;
  final VoidCallback onClose;
  final VoidCallback onEnterCatalog;

  @override
  Widget build(BuildContext context) {
    final primary = store.primaryColor;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFDF8F3),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE6D7C3), width: 1.2),
        boxShadow: const <BoxShadow>[
          BoxShadow(
            color: Color(0x40000000),
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: primary,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  store.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF7D5E49),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: primary.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  store.badge,
                  style: TextStyle(
                    color: primary,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              InkWell(
                onTap: onClose,
                child: const Icon(
                  Icons.close_rounded,
                  size: 18,
                  color: Color(0xFF6B503F),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  store.title,
                  style: GoogleFonts.cormorantGaramond(
                    color: const Color(0xFF2B1E17),
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                '${store.metric} ${store.unit}',
                style: TextStyle(
                  color: primary,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onEnterCatalog,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2B1E17),
                foregroundColor: const Color(0xFFFFFDF9),
                padding: const EdgeInsets.symmetric(vertical: 11),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(13),
                ),
              ),
              child: Text(
                store.ctaLabel,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Baris Jempol Bawah (Thumb-Zone):
/// Left (`Expanded`): Capsule button `[Strawberry Corner · Info ↑]`
/// Right: Capsule navigation with circular buttons `[←]  5 / 7  [→]`
class _ThumbZoneNavigationRow extends StatelessWidget {
  const _ThumbZoneNavigationRow({
    required this.store,
    required this.storeNumber,
    required this.totalStores,
    required this.isSummaryOpen,
    required this.onTapStoreInfo,
    required this.onLongPressStoreInfo,
    required this.onPrevStore,
    required this.onNextStore,
  });

  final CerriaStore store;
  final int storeNumber;
  final int totalStores;
  final bool isSummaryOpen;
  final VoidCallback onTapStoreInfo;
  final VoidCallback onLongPressStoreInfo;
  final VoidCallback onPrevStore;
  final VoidCallback onNextStore;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        // Left: Capsule `[Strawberry Corner · Info ↑]` (Expanded)
        Expanded(
          child: GestureDetector(
            onTap: onTapStoreInfo,
            onLongPress: onLongPressStoreInfo,
            child: CerriaGlassContainer(
              borderRadius: BorderRadius.circular(99),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              backgroundColor: const Color(0xCC18211C),
              child: Row(
                children: <Widget>[
                  Container(
                    width: 9,
                    height: 9,
                    decoration: BoxDecoration(
                      color: store.primaryColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${store.title} · Info ↑',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFFFFFDF9),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),

        // Right: Capsule `[←]  5 / 7  [→]`
        CerriaGlassContainer(
          borderRadius: BorderRadius.circular(99),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
          backgroundColor: const Color(0xCC18211C),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              _RoundThumbIconButton(
                label: '←',
                tooltip: 'Toko Sebelumnya',
                onTap: onPrevStore,
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 9),
                child: Text(
                  '$storeNumber / $totalStores',
                  style: const TextStyle(
                    color: Color(0xFFFFFDF9),
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    fontFeatures: <FontFeature>[FontFeature.tabularFigures()],
                  ),
                ),
              ),
              _RoundThumbIconButton(
                label: '→',
                tooltip: 'Toko Berikutnya',
                onTap: onNextStore,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RoundThumbIconButton extends StatelessWidget {
  const _RoundThumbIconButton({
    required this.label,
    required this.tooltip,
    required this.onTap,
  });

  final String label;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(99),
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0x28FFF8EE),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0x38FFF8EE)),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: Color(0xFFFFFDF9),
            fontSize: 13,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

/// Bottom Dock Bar Proporsional (Anti-Terpotong!):
/// Uses `Row` with `Expanded` and `FontFeature.tabularFigures()` on the clock
/// so the bar is 100% stable when minutes change and the `⚙️` button on the
/// right is NEVER clipped on any screen width.
class _BottomCozyDockBar extends StatelessWidget {
  const _BottomCozyDockBar({
    required this.viewModel,
    required this.onOpenSettings,
  });

  final TownViewModel viewModel;
  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final cw = viewModel.clockWeather;

    return CerriaGlassContainer(
      borderRadius: BorderRadius.circular(99),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      backgroundColor: const Color(0xD6161E1A),
      child: Row(
        children: <Widget>[
          // 1. Radio Play/Pause + Track Name (`Expanded` so it shrinks gracefully on narrow screens)
          Expanded(
            flex: 4,
            child: InkWell(
              borderRadius: BorderRadius.circular(99),
              onTap: viewModel.toggleMusic,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
                child: Row(
                  children: <Widget>[
                    Container(
                      width: 24,
                      height: 24,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: cw.musicEnabled
                            ? const Color(0xFFFF8E53)
                            : const Color(0x2EFFF8EE),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        cw.musicEnabled
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                        size: 14,
                        color: cw.musicEnabled
                            ? const Color(0xFF1D140E)
                            : const Color(0xFFFFFDF9),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        cw.track,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFFEAE0D2),
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 2. Time-of-Day Mood Pill (`🌙 Night` / `☀️ Day`)
          InkWell(
            borderRadius: BorderRadius.circular(99),
            onTap: viewModel.cycleTimeOfDayMood,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0x24FFF8EE),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(
                cw.mood,
                style: const TextStyle(
                  color: Color(0xFFFFF8EE),
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),

          const SizedBox(width: 6),

          // 3. Anti-Goyang Tabular-Nums Clock & Weather Widget
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => viewModel.setWeather('cycle'),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 106),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      '${cw.clock} · ${cw.date}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFFFFFDF9),
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        fontFeatures: <FontFeature>[
                          FontFeature.tabularFigures(),
                        ],
                      ),
                    ),
                    Text(
                      cw.climate,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xCCEDE3D5),
                        fontSize: 9.5,
                        fontWeight: FontWeight.w600,
                        fontFeatures: <FontFeature>[
                          FontFeature.tabularFigures(),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(width: 6),

          // 4. Settings Button `⚙️` (Fixed 32x32 so it is NEVER clipped!)
          InkWell(
            borderRadius: BorderRadius.circular(99),
            onTap: onOpenSettings,
            child: Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0x28FFF8EE),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0x40FFF8EE)),
              ),
              child: const Text(
                '⚙️',
                style: TextStyle(fontSize: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
