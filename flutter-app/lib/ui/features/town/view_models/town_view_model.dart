import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../../../data/repositories/store_repository.dart';
import '../../../../domain/models/cerria_models.dart';

/// ViewModel managing the Hybrid Native Flutter UI + Three.js 3D Canvas state.
/// Handles two-way communication over `window.FlutterBridge` and Supabase e-commerce catalog.
class TownViewModel extends ChangeNotifier {
  TownViewModel({required StoreRepository storeRepository})
      : _storeRepository = storeRepository;

  final StoreRepository _storeRepository;
  WebViewController? _webViewController;

  List<CerriaStore> _stores = const <CerriaStore>[];
  int _selectedStoreIndex = 4; // Starts at Pos 5/7 Strawberry Corner (or updates from 3D)
  int _loadingProgress = 25;
  bool _isSceneReady = false;
  bool _isStoreSummaryExpanded = false;
  bool _isCatalogModalOpen = false;
  bool _isStoreInteriorOpen = true;
  String _activeCatalogTab = 'CATALOG'; // 'HOME', 'CATALOG', 'DETAIL', 'EVENTS', 'BAG'
  CerriaProduct? _selectedProductForDetail;

  CerriaNeighborSummary? _leftNeighborOverride;
  CerriaNeighborSummary? _rightNeighborOverride;

  CerriaTownClockWeatherState _clockWeather = const CerriaTownClockWeatherState();
  final List<CerriaCartItem> _cart = <CerriaCartItem>[];

  List<CerriaStore> get stores => _stores;
  int get selectedStoreIndex => _selectedStoreIndex;
  int get totalStores => _stores.isNotEmpty ? _stores.length : 7;
  int get displayStoreNumber => _selectedStoreIndex + 1;
  int get loadingProgress => _loadingProgress;
  bool get isSceneReady => _isSceneReady;

  bool get isStoreSummaryExpanded => _isStoreSummaryExpanded;
  bool get isCatalogModalOpen => _isCatalogModalOpen;
  bool get isStoreInteriorOpen => _isStoreInteriorOpen;
  String get activeCatalogTab => _activeCatalogTab;

  CerriaStore get currentStore =>
      _storeRepository.getStoreByNavIndex(_selectedStoreIndex);

  CerriaProduct get activeDetailProduct {
    final store = currentStore;
    if (_selectedProductForDetail != null &&
        _selectedProductForDetail!.storeId == store.id) {
      return _selectedProductForDetail!;
    }
    if (store.products.isNotEmpty) {
      return store.products.first;
    }
    return CerriaProduct(
      id: 'default',
      storeId: store.id,
      name: store.title,
      sub: store.badge,
      category: store.badge.toUpperCase(),
      priceIdr: 149000,
      description: store.heroDesc,
      tags: const <String>['ORIGINAL', 'CERRIA EXCLUSIVE'],
      badge: 'Best Seller',
      sizes: const <CerriaSizeOption>[
        CerriaSizeOption(label: 'Regular', spec: 'Standar Cerria Town'),
      ],
      shades: <CerriaShadeOption>[
        CerriaShadeOption(name: 'Signature', hex: store.colorHex),
      ],
      shopeeUrl: 'https://shopee.co.id',
      tokopediaUrl: 'https://www.tokopedia.com',
      stock: 100,
    );
  }

  CerriaNeighborSummary get leftNeighbor {
    if (_leftNeighborOverride != null) return _leftNeighborOverride!;
    final prevIdx = (_selectedStoreIndex - 1 + totalStores) % totalStores;
    final st = _storeRepository.getStoreByNavIndex(prevIdx);
    final shortUnit = st.unit.split(' ').first;
    return CerriaNeighborSummary(
      storeIndex: prevIdx,
      storeId: st.id,
      name: st.title,
      pillTitle: '${st.sign} · ${st.badge}',
      summary: '${st.metric} $shortUnit · ${st.visitors} pengunjung',
      visitors: st.visitors,
      colorHex: st.colorHex,
    );
  }

  CerriaNeighborSummary get rightNeighbor {
    if (_rightNeighborOverride != null) return _rightNeighborOverride!;
    final nextIdx = (_selectedStoreIndex + 1) % totalStores;
    final st = _storeRepository.getStoreByNavIndex(nextIdx);
    final shortUnit = st.unit.split(' ').first;
    return CerriaNeighborSummary(
      storeIndex: nextIdx,
      storeId: st.id,
      name: st.title,
      pillTitle: '${st.sign} · ${st.badge}',
      summary: '${st.metric} $shortUnit · ${st.visitors} pengunjung',
      visitors: st.visitors,
      colorHex: st.colorHex,
    );
  }

  CerriaTownClockWeatherState get clockWeather => _clockWeather;
  List<CerriaCartItem> get cartItems => List<CerriaCartItem>.unmodifiable(_cart);

  int get cartItemCount =>
      _cart.fold<int>(0, (sum, item) => sum + item.quantity);

  int get cartTotalIdr =>
      _cart.fold<int>(0, (sum, item) => sum + item.subtotalIdr);

  Future<void> initialize() async {
    _stores = await _storeRepository.loadStores(refreshFromSupabase: false);
    notifyListeners();
    // Revalidate against live Supabase `products` table in background
    _stores = await _storeRepository.loadStores(refreshFromSupabase: true);
    notifyListeners();
  }

  void attachWebViewController(WebViewController controller) {
    _webViewController = controller;
  }

  void updateLoadingProgress(int pct) {
    final clamped = pct.clamp(0, 100);
    if (clamped > _loadingProgress) {
      _loadingProgress = clamped;
      if (_loadingProgress >= 100) _isSceneReady = true;
      notifyListeners();
    }
  }

  void markSceneReadyFallback() {
    if (_isSceneReady && _loadingProgress >= 100) return;
    _loadingProgress = 100;
    _isSceneReady = true;
    notifyListeners();
  }

  /// Sends a JavaScript call to `window.FlutterBridge` inside the Three.js 3D WebView.
  Future<void> _evalBridge(String jsCall) async {
    final ctl = _webViewController;
    if (ctl == null) return;
    try {
      await ctl.runJavaScript(
        'window.FlutterBridge && window.FlutterBridge.$jsCall;',
      );
    } catch (_) {
      // Ignore if page is still warming up
    }
  }

  /// Handles JSON messages posted by Three.js (`FlutterBridge.postMessage(JSON.stringify(...))`).
  void handleWebViewBridgeMessage(String rawJson) {
    try {
      final dynamic decoded = jsonDecode(rawJson);
      if (decoded is! Map<String, dynamic>) return;
      final String type = (decoded['type'] ?? '').toString();

      if (type == 'LOADING_PROGRESS') {
        if (decoded['pct'] is num) {
          final pct = (decoded['pct'] as num).toInt().clamp(0, 100);
          if (pct > _loadingProgress) _loadingProgress = pct;
          if (pct >= 100) _isSceneReady = true;
        }
        notifyListeners();
        return;
      }

      if (type == 'SCENE_READY') {
        _loadingProgress = 100;
        _isSceneReady = true;
        notifyListeners();
        return;
      }

      if (type == 'INITIAL_STATE' ||
          type == 'STORE_CHANGED' ||
          type == 'BUILDING_CLICKED') {
        _loadingProgress = 100;
        _isSceneReady = true;
        if (decoded['storeIndex'] is num) {
          _selectedStoreIndex =
              ((decoded['storeIndex'] as num).toInt() % totalStores +
                      totalStores) %
                  totalStores;
        }
        if (decoded['leftNeighbor'] is Map<String, dynamic>) {
          final ln = decoded['leftNeighbor'] as Map<String, dynamic>;
          _leftNeighborOverride = CerriaNeighborSummary(
            storeIndex: (ln['storeIndex'] is num)
                ? (ln['storeIndex'] as num).toInt()
                : (_selectedStoreIndex - 1 + totalStores) % totalStores,
            storeId: (ln['storeId'] ?? 'toko1').toString(),
            name: (ln['name'] ?? 'Store').toString(),
            pillTitle: (ln['pillTitle'] ?? ln['name'] ?? '').toString(),
            summary: (ln['summary'] ?? '').toString(),
            visitors: (ln['visitors'] is num) ? (ln['visitors'] as num).toInt() : 42,
            colorHex: (ln['color'] ?? '#3D7EA6').toString(),
          );
        }
        if (decoded['rightNeighbor'] is Map<String, dynamic>) {
          final rn = decoded['rightNeighbor'] as Map<String, dynamic>;
          _rightNeighborOverride = CerriaNeighborSummary(
            storeIndex: (rn['storeIndex'] is num)
                ? (rn['storeIndex'] as num).toInt()
                : (_selectedStoreIndex + 1) % totalStores,
            storeId: (rn['storeId'] ?? 'toko6').toString(),
            name: (rn['name'] ?? 'Store').toString(),
            pillTitle: (rn['pillTitle'] ?? rn['name'] ?? '').toString(),
            summary: (rn['summary'] ?? '').toString(),
            visitors: (rn['visitors'] is num) ? (rn['visitors'] as num).toInt() : 48,
            colorHex: (rn['color'] ?? '#C95B3C').toString(),
          );
        }
        if (type == 'BUILDING_CLICKED') {
          final bool openCat = decoded['openCatalog'] == true;
          if (openCat) {
            enterStoreInterior();
          } else {
            _isStoreSummaryExpanded = true;
          }
        }
        notifyListeners();
        return;
      }

      if (type == 'STORE_INTERIOR_CHANGED') {
        final bool isOpen = decoded['isOpen'] == true;
        if (_isStoreInteriorOpen != isOpen || _isStoreSummaryExpanded || _isCatalogModalOpen) {
          _isStoreInteriorOpen = isOpen;
          if (isOpen) {
            _isStoreSummaryExpanded = false;
            _isCatalogModalOpen = false;
          }
          notifyListeners();
        }
        return;
      }

      if (type == 'OPEN_EXTERNAL_URL') {
        final String url = (decoded['url'] ?? '').toString().trim();
        if (url.isNotEmpty) {
          launchAffiliateUrl(url);
        }
        return;
      }

      if (type == 'INITIAL_STATE' || type == 'CLOCK_WEATHER_CHANGED') {
        final prev = _clockWeather;
        final nextCw = _clockWeather.copyWith(
          daytime: (decoded['daytime'] is num)
              ? (decoded['daytime'] as num).toDouble()
              : null,
          clock: decoded['clock']?.toString(),
          date: decoded['date']?.toString(),
          mood: decoded['mood']?.toString(),
          climate: decoded['climate']?.toString(),
          track: decoded['track']?.toString(),
          weatherId: decoded['weatherId']?.toString(),
          weatherIndex: (decoded['weatherIndex'] is num)
              ? (decoded['weatherIndex'] as num).toInt()
              : null,
          cityLightMult: (decoded['cityLightMult'] is num)
              ? (decoded['cityLightMult'] as num).toDouble()
              : null,
          simSpeed: (decoded['timeScale'] is num)
              ? (decoded['timeScale'] as num).toDouble()
              : null,
          paused: (decoded['paused'] is bool) ? decoded['paused'] as bool : null,
          cycleOn:
              (decoded['cycleOn'] is bool) ? decoded['cycleOn'] as bool : null,
          dofEnabled: (decoded['dofEnabled'] is bool)
              ? decoded['dofEnabled'] as bool
              : null,
          musicEnabled: (decoded['musicEnabled'] is bool)
              ? decoded['musicEnabled'] as bool
              : null,
          musicVolume: (decoded['musicVolume'] is num)
              ? (decoded['musicVolume'] as num).toDouble()
              : null,
          fps: (decoded['fps'] is num) ? (decoded['fps'] as num).toInt() : null,
        );
        _clockWeather = nextCw;
        final bool visibleHudChanged = type == 'INITIAL_STATE' ||
            prev.clock != nextCw.clock ||
            prev.date != nextCw.date ||
            prev.mood != nextCw.mood ||
            prev.climate != nextCw.climate ||
            prev.track != nextCw.track ||
            prev.weatherIndex != nextCw.weatherIndex ||
            prev.paused != nextCw.paused ||
            prev.cycleOn != nextCw.cycleOn ||
            prev.musicEnabled != nextCw.musicEnabled;
        if (visibleHudChanged) {
          notifyListeners();
        }
        return;
      }

      if (type == 'AUDIO_CHANGED') {
        _clockWeather = _clockWeather.copyWith(
          musicEnabled: (decoded['enabled'] is bool)
              ? decoded['enabled'] as bool
              : _clockWeather.musicEnabled,
          musicVolume: (decoded['volume'] is num)
              ? (decoded['volume'] as num).toDouble()
              : _clockWeather.musicVolume,
        );
        notifyListeners();
        return;
      }

      if (type == 'PERF_SCALER' && decoded['fps'] is num) {
        _clockWeather = _clockWeather.copyWith(
          fps: (decoded['fps'] as num).toInt(),
        );
        return;
      }
    } catch (_) {
      // Ignore malformed JSON messages
    }
  }

  // ===========================================================================
  // Two-Way Commands from Flutter Native UI -> Three.js 3D Canvas
  // ===========================================================================

  void goToStore(int storeIndex) {
    final nextIdx = ((storeIndex % totalStores) + totalStores) % totalStores;
    _selectedStoreIndex = nextIdx;
    _leftNeighborOverride = null;
    _rightNeighborOverride = null;
    _selectedProductForDetail = null;
    notifyListeners();
    _evalBridge('goToStore($nextIdx)');
  }

  void prevStore() {
    goToStore(_selectedStoreIndex - 1);
  }

  void nextStore() {
    goToStore(_selectedStoreIndex + 1);
  }

  void toggleStoreSummaryCard() {
    _isStoreSummaryExpanded = !_isStoreSummaryExpanded;
    notifyListeners();
  }

  void closeStoreSummaryCard() {
    if (!_isStoreSummaryExpanded) return;
    _isStoreSummaryExpanded = false;
    notifyListeners();
  }

  void enterStoreInterior() {
    _isStoreSummaryExpanded = false;
    _isCatalogModalOpen = false;
    _isStoreInteriorOpen = true;
    notifyListeners();
    _evalBridge('enterStore($_selectedStoreIndex)');
  }

  void exitStoreInterior() {
    if (!_isStoreInteriorOpen && !_isCatalogModalOpen) return;
    _isStoreInteriorOpen = false;
    _isCatalogModalOpen = false;
    notifyListeners();
    _evalBridge('exitStore()');
  }

  void openStoreCatalogModal({String initialTab = 'CATALOG', CerriaProduct? product}) {
    _isStoreSummaryExpanded = false;
    if (_webViewController != null) {
      enterStoreInterior();
      return;
    }
    _isCatalogModalOpen = true;
    _activeCatalogTab = initialTab;
    if (product != null) {
      _selectedProductForDetail = product;
    }
    notifyListeners();
  }

  void closeStoreCatalogModal() {
    _isCatalogModalOpen = false;
    if (_isStoreInteriorOpen) {
      _isStoreInteriorOpen = false;
      _evalBridge('exitStore()');
    }
    notifyListeners();
  }

  void setCatalogTab(String tab, {CerriaProduct? product}) {
    _activeCatalogTab = tab;
    if (product != null) {
      _selectedProductForDetail = product;
    }
    notifyListeners();
  }

  void cycleTimeOfDayMood() {
    final wh = _clockWeather.daytime % 24;
    String nextMode;
    double nextHour;
    String nextMood;
    if (wh >= 19.0 || wh < 5.2) {
      nextMode = 'dawn';
      nextHour = 6.4;
      nextMood = '🌄 Dawn';
    } else if (wh < 7.5) {
      nextMode = 'day';
      nextHour = 13.0;
      nextMood = '☀️ Day';
    } else if (wh < 16.5) {
      nextMode = 'dusk';
      nextHour = 17.6;
      nextMood = '🌅 Dusk';
    } else {
      nextMode = 'night';
      nextHour = 20.5;
      nextMood = '🌙 Night';
    }
    _clockWeather = _clockWeather.copyWith(
      daytime: nextHour,
      clock: _formatClock(nextHour),
      mood: nextMood,
    );
    notifyListeners();
    _evalBridge("setTimeOfDay('$nextMode')");
  }

  void setTimeOfDayHour(double hour) {
    final clamped = hour.clamp(0.0, 23.95);
    _clockWeather = _clockWeather.copyWith(
      daytime: clamped,
      clock: _formatClock(clamped),
      cycleOn: false,
    );
    notifyListeners();
    _evalBridge('setTimeOfDay($clamped)');
  }

  void setWeather(String type) {
    final clean = type.trim().toLowerCase();
    int wIdx = 0;
    String label = '25°C · Cerah';
    if (clean == 'rain' || clean == 'hujan') {
      wIdx = 4;
      label = '21°C · Hujan Ringan';
    } else if (clean == 'fog' || clean == 'kabut') {
      wIdx = 3;
      label = '22°C · Kabut Syahdu';
    } else if (clean == 'cycle') {
      if (_clockWeather.weatherIndex == 0 ||
          _clockWeather.weatherIndex == 1 ||
          _clockWeather.weatherIndex == 2) {
        return setWeather('rain');
      } else if (_clockWeather.weatherIndex == 4) {
        return setWeather('fog');
      } else {
        return setWeather('clear');
      }
    }
    _clockWeather = _clockWeather.copyWith(
      weatherId: clean,
      weatherIndex: wIdx,
      climate: label,
    );
    notifyListeners();
    _evalBridge("setWeather('$clean')");
  }

  void setCityLightIntensity(double val) {
    final clamped = val.clamp(0.5, 2.5);
    _clockWeather = _clockWeather.copyWith(cityLightMult: clamped);
    notifyListeners();
    _evalBridge('setCityLightIntensity($clamped)');
  }

  void setSimSpeed(double mult) {
    if (mult <= 0) {
      _clockWeather = _clockWeather.copyWith(paused: !_clockWeather.paused);
      notifyListeners();
      _evalBridge('setSimSpeed(${_clockWeather.paused ? 0 : _clockWeather.simSpeed})');
      return;
    }
    _clockWeather = _clockWeather.copyWith(paused: false, simSpeed: mult);
    notifyListeners();
    _evalBridge('setSimSpeed($mult)');
  }

  void toggleAutoCycle(bool enabled) {
    _clockWeather = _clockWeather.copyWith(cycleOn: enabled);
    notifyListeners();
    _evalBridge('setAutoCycle(${enabled ? "true" : "false"})');
  }

  void toggleMusic() {
    final next = !_clockWeather.musicEnabled;
    _clockWeather = _clockWeather.copyWith(musicEnabled: next);
    notifyListeners();
    _evalBridge('toggleMusic(${next ? "true" : "false"})');
  }

  void setMusicVolume(double volume) {
    final clamped = volume.clamp(0.0, 1.0);
    _clockWeather = _clockWeather.copyWith(
      musicVolume: clamped,
      musicEnabled: clamped > 0.01 ? true : _clockWeather.musicEnabled,
    );
    notifyListeners();
    _evalBridge('setMusicVolume($clamped)');
  }

  void setMacroDOF(bool enabled, {double? shutter}) {
    final nextShutter = (shutter ?? _clockWeather.shutter).clamp(0.0, 0.45);
    _clockWeather = _clockWeather.copyWith(
      dofEnabled: enabled,
      shutter: nextShutter,
    );
    notifyListeners();
    _evalBridge('setMacroDOF(${enabled ? nextShutter : "false"})');
  }

  // ===========================================================================
  // Shopping Bag & External E-Commerce Affiliate Launcher (Shopee / Tokopedia)
  // ===========================================================================

  void addToCart(
    CerriaProduct product, {
    String? size,
    String? shade,
  }) {
    final chosenSize = size ??
        (product.sizes.isNotEmpty ? product.sizes.first.label : 'Regular');
    final chosenShade = shade ??
        (product.shades.isNotEmpty ? product.shades.first.name : 'Signature');

    final existingIdx = _cart.indexWhere(
      (item) =>
          item.product.id == product.id &&
          item.selectedSize == chosenSize &&
          item.selectedShade == chosenShade,
    );
    if (existingIdx >= 0) {
      final current = _cart[existingIdx];
      _cart[existingIdx] = current.copyWith(quantity: current.quantity + 1);
    } else {
      _cart.add(
        CerriaCartItem(
          product: product,
          selectedSize: chosenSize,
          selectedShade: chosenShade,
          quantity: 1,
        ),
      );
    }
    notifyListeners();
  }

  void removeFromCartAt(int index) {
    if (index < 0 || index >= _cart.length) return;
    _cart.removeAt(index);
    notifyListeners();
  }

  Future<void> launchAffiliateUrl(String urlString) async {
    final Uri? uri = Uri.tryParse(urlString);
    if (uri == null) return;
    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (_) {
      // Fallback if external app is unavailable
    }
  }

  String _formatClock(double h) {
    final wh = ((h % 24) + 24) % 24;
    final hh = wh.floor();
    final mm = ((wh - hh) * 60).floor();
    return '${hh.toString().padLeft(2, '0')}:${mm.toString().padLeft(2, '0')}';
  }
}
