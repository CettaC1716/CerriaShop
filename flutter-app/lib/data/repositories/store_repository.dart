import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/models/cerria_models.dart';
import '../services/supabase_config.dart';

/// Single source of truth for Cerria Town stores & e-commerce products.
/// 1. Loads bundled `assets/data/stores-data.json` immediately for 100% offline zero-latency UI.
/// 2. Revalidates against Supabase (`public.stores` & `public.products`) in the background when online.
class StoreRepository {
  final Map<String, CerriaStore> _storesById = <String, CerriaStore>{};
  bool _initialized = false;

  List<CerriaStore> get orderedStores => kCerriaStoreIds
      .map((id) => _storesById[id])
      .whereType<CerriaStore>()
      .toList(growable: false);

  CerriaStore? getStoreById(String id) => _storesById[id];

  CerriaStore getStoreByNavIndex(int index) {
    final list = orderedStores;
    if (list.isEmpty) {
      return _buildPlaceholderStore('toko1', 1);
    }
    final safeIdx = ((index % list.length) + list.length) % list.length;
    return list[safeIdx];
  }

  Future<List<CerriaStore>> loadStores({bool refreshFromSupabase = true}) async {
    if (!_initialized) {
      await _loadFromBundledJson();
      _initialized = true;
    }
    if (refreshFromSupabase) {
      await _refreshFromSupabaseSafely();
    }
    return orderedStores;
  }

  Future<void> _loadFromBundledJson() async {
    try {
      final rawJson = await rootBundle.loadString('assets/data/stores-data.json');
      final Map<String, dynamic> decoded =
          jsonDecode(rawJson) as Map<String, dynamic>;
      final Map<String, dynamic> storesMap =
          (decoded['stores'] as Map<String, dynamic>?) ?? <String, dynamic>{};

      for (int i = 0; i < kCerriaStoreIds.length; i++) {
        final storeId = kCerriaStoreIds[i];
        final storeObj = storesMap[storeId] as Map<String, dynamic>?;
        if (storeObj != null) {
          _storesById[storeId] = _parseStoreJson(storeId, i + 1, storeObj);
        } else {
          _storesById[storeId] = _buildPlaceholderStore(storeId, i + 1);
        }
      }
    } catch (_) {
      for (int i = 0; i < kCerriaStoreIds.length; i++) {
        final storeId = kCerriaStoreIds[i];
        _storesById[storeId] = _buildPlaceholderStore(storeId, i + 1);
      }
    }
  }

  Future<void> _refreshFromSupabaseSafely() async {
    try {
      final client = Supabase.instance.client;
      final List<dynamic> productRows = await client
          .from('products')
          .select()
          .eq('is_active', true)
          .order('sort_order', ascending: true)
          .timeout(const Duration(seconds: 5));

      if (productRows.isEmpty) return;

      final Map<String, List<Map<String, dynamic>>> byStore =
          <String, List<Map<String, dynamic>>>{};
      for (final row in productRows) {
        if (row is Map<String, dynamic>) {
          final sid = (row['store_id'] ?? '').toString();
          if (sid.isNotEmpty) {
            byStore.putIfAbsent(sid, () => <Map<String, dynamic>>[]).add(row);
          }
        }
      }

      for (final entry in byStore.entries) {
        final existing = _storesById[entry.key];
        if (existing == null) continue;
        final updatedProducts = _mergeSupabaseProducts(existing, entry.value);
        if (updatedProducts.isNotEmpty) {
          _storesById[entry.key] = CerriaStore(
            id: existing.id,
            displayOrder: existing.displayOrder,
            sign: existing.sign,
            title: existing.title,
            subtitle: existing.subtitle,
            badge: existing.badge,
            metric: existing.metric,
            unit: existing.unit,
            delta: existing.delta,
            visitors: existing.visitors,
            colorHex: existing.colorHex,
            gradHex: existing.gradHex,
            checks: existing.checks,
            specs: existing.specs,
            ctaLabel: existing.ctaLabel,
            heroEyebrow: existing.heroEyebrow,
            heroHeadline: existing.heroHeadline,
            heroSub: existing.heroSub,
            heroDesc: existing.heroDesc,
            products: updatedProducts,
            events: existing.events,
          );
        }
      }
    } catch (_) {
      // Zero-crash offline fallback: bundled JSON remains active when offline.
    }
  }

  List<CerriaProduct> _mergeSupabaseProducts(
    CerriaStore store,
    List<Map<String, dynamic>> rows,
  ) {
    final List<CerriaProduct> result = <CerriaProduct>[];
    for (final r in rows) {
      final section = (r['section'] ?? '').toString().toLowerCase();
      if (section == 'events' || section == 'faqs') continue;

      final meta = (r['metadata'] is Map<String, dynamic>)
          ? (r['metadata'] as Map<String, dynamic>)
          : <String, dynamic>{};
      final kind = (meta['kind'] ?? '').toString();
      if (kind == 'sc_event' || kind == 'mayor_faq') continue;

      final rawName = (r['name'] ?? meta['name'] ?? meta['title'] ?? '').toString();
      if (rawName.isEmpty) continue;

      final num rawPrice = (r['price'] is num)
          ? (r['price'] as num)
          : (meta['basePrice'] is num ? (meta['basePrice'] as num) : 125000);
      final int priceIdr = rawPrice > 0 && rawPrice < 1000
          ? (rawPrice * 10000).round()
          : rawPrice.round();

      final String itemId =
          (meta['item_id'] ?? meta['id'] ?? r['id'] ?? rawName).toString();
      final String sub =
          (meta['sub'] ?? meta['subtitle'] ?? meta['cat'] ?? store.badge)
              .toString();
      final String category =
          (r['category'] ?? meta['cat'] ?? store.badge).toString().toUpperCase();
      final String desc =
          (r['description'] ?? meta['desc'] ?? 'Koleksi pilihan ${store.title}.')
              .toString();

      final List<String> tags = (meta['tags'] is List)
          ? (meta['tags'] as List).map((e) => e.toString()).toList()
          : <String>['ORIGINAL', 'CERRIA EXCLUSIVE'];

      final String shopeeUrl = (r['affiliate_url'] ??
              meta['shopeeUrl'] ??
              meta['affiliateUrl'] ??
              CerriaSupabaseConfig.buildShopeeAffiliateUrl(store.title, rawName))
          .toString();
      final String tokopediaUrl = (meta['tokopediaUrl'] ??
              CerriaSupabaseConfig.buildTokopediaAffiliateUrl(store.title, rawName))
          .toString();

      result.add(
        CerriaProduct(
          id: itemId,
          storeId: store.id,
          name: rawName,
          sub: sub,
          category: category,
          priceIdr: priceIdr > 0 ? priceIdr : 95000,
          description: desc,
          tags: tags,
          badge: (meta['badge'] ?? 'Best Seller').toString(),
          sizes: _parseSizes(meta['sizes']),
          shades: _parseShades(meta['shades'], store.colorHex),
          shopeeUrl: shopeeUrl,
          tokopediaUrl: tokopediaUrl,
          stock: (r['stock'] is num) ? (r['stock'] as num).toInt() : 100,
        ),
      );
    }
    return result.isNotEmpty ? result : store.products;
  }

  CerriaStore _parseStoreJson(
    String storeId,
    int displayOrder,
    Map<String, dynamic> storeObj,
  ) {
    final Map<String, dynamic> card =
        (storeObj['card'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    final Map<String, dynamic> catalog =
        (storeObj['catalog'] as Map<String, dynamic>?) ?? <String, dynamic>{};

    final String title = (card['title'] ?? card['sign'] ?? storeId).toString();
    final String sign = (card['sign'] ?? title).toString();
    final String subtitle =
        (card['subtitle'] ?? 'Store #$displayOrder dari 7').toString();
    final String badge = (card['badge'] ?? 'Lifestyle').toString();
    final String colorHex = (card['color'] ?? '#C87D72').toString();

    final List<String> gradHex = (card['grad'] is List)
        ? (card['grad'] as List).map((e) => e.toString()).toList()
        : <String>[colorHex, '#382218'];

    final List<String> checks = (card['checks'] is List)
        ? (card['checks'] as List).map((e) => e.toString()).toList()
        : <String>[title];

    final List<CerriaStoreSpec> specs = <CerriaStoreSpec>[];
    if (card['specs'] is List) {
      for (final sp in card['specs'] as List) {
        if (sp is Map<String, dynamic>) {
          specs.add(
            CerriaStoreSpec(
              icon: (sp['icon'] ?? 'star').toString(),
              value: (sp['value'] ?? '').toString(),
              label: (sp['label'] ?? '').toString(),
            ),
          );
        }
      }
    }

    final List<CerriaProduct> products =
        _extractCatalogProducts(storeId, title, badge, colorHex, card, catalog);
    final List<CerriaStoreEvent> events = _extractCatalogEvents(catalog);

    return CerriaStore(
      id: storeId,
      displayOrder: displayOrder,
      sign: sign,
      title: title,
      subtitle: subtitle,
      badge: badge,
      metric: (card['metric'] ?? '${products.length}').toString(),
      unit: (card['unit'] ?? 'koleksi kurasi').toString(),
      delta: (card['delta'] ?? '+100% original').toString(),
      visitors: (card['friends'] is num) ? (card['friends'] as num).toInt() : 42,
      colorHex: colorHex,
      gradHex: gradHex,
      checks: checks,
      specs: specs,
      ctaLabel: (card['ctaLabel'] ?? 'Masuk Toko →').toString(),
      heroEyebrow:
          (catalog['heroEyebrow'] ?? 'SEASON SPECIAL · ${badge.toUpperCase()}')
              .toString(),
      heroHeadline: (catalog['heroHeadline'] ?? title).toString(),
      heroSub: (catalog['heroSub'] ?? subtitle).toString(),
      heroDesc: (catalog['heroDesc'] ??
              'Koleksi kurasi eksklusif dari $title di Cerria Town.')
          .toString(),
      products: products,
      events: events,
    );
  }

  List<CerriaProduct> _extractCatalogProducts(
    String storeId,
    String storeTitle,
    String storeBadge,
    String storeColorHex,
    Map<String, dynamic> card,
    Map<String, dynamic> catalog,
  ) {
    final List<CerriaProduct> products = <CerriaProduct>[];

    void addFromRawList(List<dynamic>? rawList, {String defaultCat = ''}) {
      if (rawList == null) return;
      for (final item in rawList) {
        if (item is! Map<String, dynamic>) continue;
        final String name =
            (item['name'] ?? item['title'] ?? item['role'] ?? '').toString();
        if (name.isEmpty) continue;

        int priceIdr = 129000;
        if (item['basePrice'] is num) {
          final num bp = item['basePrice'] as num;
          priceIdr = bp > 0 && bp < 1000 ? (bp * 10000).round() : bp.round();
        } else if (item['price'] != null) {
          final digits = item['price']
              .toString()
              .replaceAll(RegExp(r'[^0-9]'), '');
          final parsed = int.tryParse(digits);
          if (parsed != null && parsed > 0) {
            priceIdr = parsed < 1000 ? parsed * 10000 : parsed;
          }
        }

        final String sub = (item['sub'] ??
                item['subtitle'] ??
                item['meta'] ??
                item['cat'] ??
                defaultCat)
            .toString();
        final String cat =
            (item['cat'] ?? item['category'] ?? defaultCat ?? storeBadge)
                .toString()
                .toUpperCase();
        final String desc = (item['desc'] ??
                item['description'] ??
                item['perk'] ??
                'Produk unggulan dari $storeTitle di Cerria Town.')
            .toString();
        final List<String> tags = (item['tags'] is List)
            ? (item['tags'] as List).map((e) => e.toString()).toList()
            : <String>['CERRIA CURATED', storeBadge.toUpperCase()];

        products.add(
          CerriaProduct(
            id: (item['id'] ?? name).toString(),
            storeId: storeId,
            name: name,
            sub: sub,
            category: cat.isEmpty ? storeBadge.toUpperCase() : cat,
            priceIdr: priceIdr,
            description: desc,
            tags: tags,
            badge: (item['badge'] ?? item['state'] ?? 'Featured').toString(),
            sizes: _parseSizes(item['sizes']),
            shades: _parseShades(item['shades'] ?? item['colors'], storeColorHex),
            shopeeUrl: (item['shopeeUrl'] ??
                    item['affiliateUrl'] ??
                    CerriaSupabaseConfig.buildShopeeAffiliateUrl(storeTitle, name))
                .toString(),
            tokopediaUrl: (item['tokopediaUrl'] ??
                    CerriaSupabaseConfig.buildTokopediaAffiliateUrl(
                        storeTitle, name))
                .toString(),
            stock: 100,
          ),
        );
      }
    }

    addFromRawList(catalog['items'] as List<dynamic>?, defaultCat: storeBadge);
    addFromRawList(catalog['menu'] as List<dynamic>?, defaultCat: 'FRESH MENU');
    addFromRawList(catalog['goods'] as List<dynamic>?, defaultCat: 'ARTISAN GOODS');
    addFromRawList(catalog['treatments'] as List<dynamic>?, defaultCat: 'STUDIO');
    addFromRawList(catalog['roles'] as List<dynamic>?, defaultCat: 'CITIZEN PASS');

    if (products.isEmpty && card['modules'] is List) {
      addFromRawList(card['modules'] as List<dynamic>?, defaultCat: storeBadge);
    }

    return products;
  }

  List<CerriaSizeOption> _parseSizes(dynamic rawSizes) {
    if (rawSizes is List && rawSizes.isNotEmpty) {
      return rawSizes.whereType<Map<String, dynamic>>().map((m) {
        return CerriaSizeOption(
          label: (m['label'] ?? m['name'] ?? 'Regular').toString(),
          spec: (m['spec'] ?? '').toString(),
          multiplier: (m['mult'] is num) ? (m['mult'] as num).toDouble() : 1.0,
        );
      }).toList();
    }
    return const <CerriaSizeOption>[
      CerriaSizeOption(label: 'Regular', spec: 'Ukuran Standar Cerria'),
      CerriaSizeOption(label: 'Deluxe Pack', spec: 'Paket Gift Eksklusif', multiplier: 1.25),
    ];
  }

  List<CerriaShadeOption> _parseShades(dynamic rawShades, String fallbackHex) {
    if (rawShades is List && rawShades.isNotEmpty) {
      return rawShades.whereType<Map<String, dynamic>>().map((m) {
        return CerriaShadeOption(
          name: (m['name'] ?? m['label'] ?? 'Classic').toString(),
          hex: (m['hex'] ?? fallbackHex).toString(),
          accentHex: (m['accent'] ?? '#FAF3EB').toString(),
        );
      }).toList();
    }
    return <CerriaShadeOption>[
      CerriaShadeOption(name: 'Signature', hex: fallbackHex),
      const CerriaShadeOption(name: 'Warm Cream', hex: '#FAF3EB'),
      const CerriaShadeOption(name: 'Terracotta', hex: '#E07A5F'),
    ];
  }

  List<CerriaStoreEvent> _extractCatalogEvents(Map<String, dynamic> catalog) {
    final List<CerriaStoreEvent> out = <CerriaStoreEvent>[];
    if (catalog['events'] is List) {
      for (final ev in catalog['events'] as List) {
        if (ev is Map<String, dynamic>) {
          out.add(
            CerriaStoreEvent(
              dateLabel: (ev['date'] ?? ev['day'] ?? 'Akhir Pekan').toString(),
              title: (ev['title'] ?? ev['name'] ?? 'Cerria Gathering').toString(),
              time: (ev['time'] ?? '16:00 - 20:00 WIB').toString(),
              desc: (ev['desc'] ?? 'Acara komunitas hangat di Cerria Town.').toString(),
              tag: (ev['tag'] ?? ev['badge'] ?? 'LIVE EVENT').toString(),
            ),
          );
        }
      }
    } else if (catalog['eventsByMonth'] is Map<String, dynamic>) {
      final map = catalog['eventsByMonth'] as Map<String, dynamic>;
      for (final entry in map.entries) {
        if (entry.value is List) {
          for (final ev in entry.value as List) {
            if (ev is Map<String, dynamic>) {
              out.add(
                CerriaStoreEvent(
                  dateLabel: '${entry.key}-${ev['day'] ?? '15'}',
                  title: (ev['title'] ?? 'Festival Cerria').toString(),
                  time: (ev['time'] ?? '15:00 WIB').toString(),
                  desc: (ev['desc'] ?? 'Kegiatan seru warga Cerria Town.').toString(),
                  tag: (ev['tag'] ?? 'COMMUNITY').toString(),
                ),
              );
            }
          }
        }
      }
    }
    return out;
  }

  CerriaStore _buildPlaceholderStore(String id, int order) {
    return CerriaStore(
      id: id,
      displayOrder: order,
      sign: 'Cerria Store #$order',
      title: 'Cerria Store #$order',
      subtitle: 'Store #$order dari 7',
      badge: 'Lifestyle',
      metric: '24',
      unit: 'koleksi pilihan',
      delta: '+100% original',
      visitors: 48,
      colorHex: '#C87D72',
      gradHex: const <String>['#EBBFB7', '#C87D72'],
      checks: const <String>['24 Koleksi Pilihan'],
      specs: const <CerriaStoreSpec>[],
      ctaLabel: 'Masuk Toko →',
      heroEyebrow: 'SEASON SPECIAL',
      heroHeadline: 'Cerria Store #$order',
      heroSub: 'Interactive Fun Shopping & Lifestyle Town',
      heroDesc: 'Temukan produk kurasi terbaik di Cerria Town.',
      products: const <CerriaProduct>[],
      events: const <CerriaStoreEvent>[],
    );
  }
}
