import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../domain/models/cerria_models.dart';
import '../../../core/glass_container.dart';
import '../../town/view_models/town_view_model.dart';

/// Native Flutter Store Modal & E-Commerce Catalog.
/// Specifically engineered for Smartphone Portrait ergonomics:
/// - Clean top without duplicate headers
/// - Season Special Banner at top with 3D Isometric Building on the right of the banner
/// - Proportional 2x2 Product Grid (anti-gepeng) in the middle
/// - Affiliate Buy buttons (Shopee / Tokopedia via `LaunchMode.externalApplication`)
/// - Bottom Navigation Bar with `← Kembali ke Kota` + 5 icon tabs
class NativeStoreModal extends StatelessWidget {
  const NativeStoreModal({
    super.key,
    required this.viewModel,
  });

  final TownViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: viewModel,
      builder: (context, _) {
        final store = viewModel.currentStore;
        final tab = viewModel.activeCatalogTab;

        return Material(
          color: const Color(0xCC121916),
          child: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final bool isWide = constraints.maxWidth >= 768;

                return Align(
                  alignment: Alignment.bottomCenter,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: isWide ? 880 : double.infinity,
                      maxHeight: constraints.maxHeight * (isWide ? 0.92 : 0.96),
                    ),
                    child: Container(
                      margin: EdgeInsets.symmetric(
                        horizontal: isWide ? 20 : 0,
                        vertical: isWide ? 12 : 0,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDF8F3),
                        borderRadius: BorderRadius.vertical(
                          top: const Radius.circular(28),
                          bottom: Radius.circular(isWide ? 28 : 0),
                        ),
                        border: Border.all(
                          color: const Color(0xFFE6D7C3),
                          width: 1.2,
                        ),
                        boxShadow: const <BoxShadow>[
                          BoxShadow(
                            color: Color(0x4D000000),
                            blurRadius: 32,
                            offset: Offset(0, -6),
                          ),
                        ],
                      ),
                      child: Column(
                        children: <Widget>[
                          // Subtle drag handle pill
                          Container(
                            width: 42,
                            height: 4,
                            margin: const EdgeInsets.only(top: 10, bottom: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFD5C4B0),
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),

                          // 1. Season Special Banner + Isometric 3D Building on Right
                          Padding(
                            padding: const EdgeInsets.fromLTRB(14, 2, 14, 10),
                            child: _SeasonSpecialBanner(store: store),
                          ),

                          // 2. Main Tab Content (2x2 Proportional Grid / Detail / Events / Bag)
                          Expanded(
                            child: AnimatedSwitcher(
                              duration: const Duration(milliseconds: 220),
                              child: _buildTabBody(context, store, tab, isWide),
                            ),
                          ),

                          // 3. Bottom Bar: `← Kembali ke Kota` + 5 Navigation Icons
                          _StoreModalBottomBar(
                            viewModel: viewModel,
                            store: store,
                            activeTab: tab,
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  Widget _buildTabBody(
    BuildContext context,
    CerriaStore store,
    String tab,
    bool isWide,
  ) {
    switch (tab) {
      case 'HOME':
        return _StoreHomeOverviewTab(
          key: const ValueKey<String>('tab_home'),
          store: store,
          viewModel: viewModel,
        );
      case 'DETAIL':
        return _ProductDetailTab(
          key: const ValueKey<String>('tab_detail'),
          store: store,
          product: viewModel.activeDetailProduct,
          viewModel: viewModel,
        );
      case 'EVENTS':
        return _StoreEventsTab(
          key: const ValueKey<String>('tab_events'),
          store: store,
        );
      case 'BAG':
        return _StoreBagTab(
          key: const ValueKey<String>('tab_bag'),
          viewModel: viewModel,
        );
      case 'CATALOG':
      default:
        return _ProductGridTab(
          key: const ValueKey<String>('tab_catalog'),
          store: store,
          viewModel: viewModel,
          isWide: isWide,
        );
    }
  }
}

class _SeasonSpecialBanner extends StatelessWidget {
  const _SeasonSpecialBanner({required this.store});

  final CerriaStore store;

  @override
  Widget build(BuildContext context) {
    final primary = store.primaryColor;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[
            const Color(0xFFFFF6EC),
            Color.lerp(const Color(0xFFFFF6EC), primary, 0.16)!,
          ],
        ),
        border: Border.all(
          color: primary.withValues(alpha: 0.28),
          width: 1.1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    store.heroEyebrow.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: primary,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.7,
                    ),
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  store.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.cormorantGaramond(
                    color: const Color(0xFF2B1E17),
                    fontSize: 23,
                    fontWeight: FontWeight.w700,
                    height: 1.05,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${store.badge} · ${store.metric} ${store.unit} · ${store.visitors} pengunjung',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF6E5544),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          // 3D Isometric Building Badge on the Right of Banner
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFDF9),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFEADBC8)),
            ),
            child: CerriaIsometricBuildingBadge(
              primaryColor: primary,
              storeSign: store.sign,
              size: 76,
            ),
          ),
        ],
      ),
    );
  }
}

/// Proportional 2-Column Product Grid (Anti-Gepeng!) for Smartphone Portrait,
/// scaling cleanly to 3 columns on wider tablet/desktop windows.
class _ProductGridTab extends StatelessWidget {
  const _ProductGridTab({
    super.key,
    required this.store,
    required this.viewModel,
    required this.isWide,
  });

  final CerriaStore store;
  final TownViewModel viewModel;
  final bool isWide;

  @override
  Widget build(BuildContext context) {
    final products = store.products;
    final int crossAxisCount = isWide ? 3 : 2;

    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(14, 2, 14, 14),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        // Proportional aspect ratio so cards never look squashed/gepeng on portrait phones
        childAspectRatio: isWide ? 0.78 : 0.69,
      ),
      itemCount: products.length,
      itemBuilder: (context, index) {
        final product = products[index];
        return _ProductGridCard(
          store: store,
          product: product,
          viewModel: viewModel,
        );
      },
    );
  }
}

class _ProductGridCard extends StatelessWidget {
  const _ProductGridCard({
    required this.store,
    required this.product,
    required this.viewModel,
  });

  final CerriaStore store;
  final CerriaProduct product;
  final TownViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final primary = store.primaryColor;
    final firstShade = product.shades.isNotEmpty
        ? product.shades.first.color
        : primary;

    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () => viewModel.setCatalogTab('DETAIL', product: product),
      child: Container(
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFDF9),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE8DAC8), width: 1.1),
          boxShadow: const <BoxShadow>[
            BoxShadow(
              color: Color(0x0F382218),
              blurRadius: 10,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            // Top Visual Preview Box with Category Pill & Color Swatches
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(13),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: <Color>[
                      firstShade.withValues(alpha: 0.22),
                      primary.withValues(alpha: 0.10),
                    ],
                  ),
                ),
                child: Stack(
                  children: <Widget>[
                    Align(
                      alignment: Alignment.topLeft,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xE6FFFDF9),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          product.category,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: primary,
                            fontSize: 8.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                    Center(
                      child: Icon(
                        Icons.auto_awesome_rounded,
                        size: 32,
                        color: primary.withValues(alpha: 0.82),
                      ),
                    ),
                    if (product.shades.isNotEmpty)
                      Align(
                        alignment: Alignment.bottomRight,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: product.shades.take(4).map((sh) {
                            return Container(
                              width: 11,
                              height: 11,
                              margin: const EdgeInsets.only(left: 3),
                              decoration: BoxDecoration(
                                color: sh.color,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 1.2,
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              product.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Color(0xFF2B1E17),
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              product.sub,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Color(0xFF8C6D58),
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              product.formattedPrice,
              style: TextStyle(
                color: primary,
                fontSize: 13.5,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 7),
            // Action Row: External Affiliate Buy Button (Shopee) + Add to Bag
            Row(
              children: <Widget>[
                Expanded(
                  child: SizedBox(
                    height: 30,
                    child: ElevatedButton(
                      onPressed: () =>
                          viewModel.launchAffiliateUrl(product.shopeeUrl),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEE4D2D),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(9),
                        ),
                      ),
                      child: const Text(
                        'Beli Shopee ↗',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                SizedBox(
                  width: 30,
                  height: 30,
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    tooltip: 'Tambah ke Tas Belanja',
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xFFF3E8DA),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(9),
                      ),
                    ),
                    icon: const Icon(
                      Icons.shopping_bag_outlined,
                      size: 15,
                      color: Color(0xFF382218),
                    ),
                    onPressed: () {
                      viewModel.addToCart(product);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('${product.name} ditambahkan ke My Bag'),
                          duration: const Duration(seconds: 1),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductDetailTab extends StatefulWidget {
  const _ProductDetailTab({
    super.key,
    required this.store,
    required this.product,
    required this.viewModel,
  });

  final CerriaStore store;
  final CerriaProduct product;
  final TownViewModel viewModel;

  @override
  State<_ProductDetailTab> createState() => _ProductDetailTabState();
}

class _ProductDetailTabState extends State<_ProductDetailTab> {
  int _sizeIdx = 0;
  int _shadeIdx = 0;

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final primary = widget.store.primaryColor;
    final sizes = p.sizes;
    final shades = p.shades;
    final safeSizeIdx = _sizeIdx.clamp(0, sizes.isEmpty ? 0 : sizes.length - 1);
    final safeShadeIdx =
        _shadeIdx.clamp(0, shades.isEmpty ? 0 : shades.length - 1);
    final double mult =
        sizes.isNotEmpty ? sizes[safeSizeIdx].multiplier : 1.0;
    final int finalPrice = (p.priceIdr * mult).round();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      children: <Widget>[
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFDF9),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE8DAC8)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: primary.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      p.category,
                      style: TextStyle(
                        color: primary,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    formatRupiah(finalPrice),
                    style: TextStyle(
                      color: primary,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                p.name,
                style: GoogleFonts.cormorantGaramond(
                  color: const Color(0xFF2B1E17),
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                p.sub,
                style: const TextStyle(
                  color: Color(0xFF8C6D58),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                p.description,
                style: const TextStyle(
                  color: Color(0xFF4F3B2F),
                  fontSize: 13,
                  height: 1.45,
                ),
              ),
              if (shades.isNotEmpty) ...<Widget>[
                const SizedBox(height: 14),
                const Text(
                  'PILIH VARIAN WARNA / SHADE',
                  style: TextStyle(
                    color: Color(0xFF7D5E49),
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: List<Widget>.generate(shades.length, (i) {
                    final sh = shades[i];
                    final selected = i == safeShadeIdx;
                    return ChoiceChip(
                      label: Text(sh.name),
                      selected: selected,
                      onSelected: (_) => setState(() => _shadeIdx = i),
                      avatar: CircleAvatar(backgroundColor: sh.color),
                    );
                  }),
                ),
              ],
              if (sizes.isNotEmpty) ...<Widget>[
                const SizedBox(height: 14),
                const Text(
                  'PILIH UKURAN / PAKET',
                  style: TextStyle(
                    color: Color(0xFF7D5E49),
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: List<Widget>.generate(sizes.length, (i) {
                    final sz = sizes[i];
                    final selected = i == safeSizeIdx;
                    return ChoiceChip(
                      label: Text(sz.label),
                      selected: selected,
                      onSelected: (_) => setState(() => _sizeIdx = i),
                    );
                  }),
                ),
              ],
              const SizedBox(height: 18),
              // Direct Affiliate E-Commerce Buttons (Shopee & Tokopedia)
              Row(
                children: <Widget>[
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () =>
                          widget.viewModel.launchAffiliateUrl(p.shopeeUrl),
                      icon: const Icon(Icons.open_in_new_rounded, size: 16),
                      label: const Text('Beli di Shopee'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEE4D2D),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(13),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () =>
                          widget.viewModel.launchAffiliateUrl(p.tokopediaUrl),
                      icon: const Icon(Icons.storefront_rounded, size: 16),
                      label: const Text('Tokopedia'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF03AC0E),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(13),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    widget.viewModel.addToCart(
                      p,
                      size: sizes.isNotEmpty ? sizes[safeSizeIdx].label : null,
                      shade:
                          shades.isNotEmpty ? shades[safeShadeIdx].name : null,
                    );
                    widget.viewModel.setCatalogTab('BAG');
                  },
                  icon: const Icon(Icons.shopping_bag_outlined, size: 17),
                  label: const Text('Simpan ke My Bag Cerria Town'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF2B1E17),
                    side: const BorderSide(color: Color(0xFFD5C1AA)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(13),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StoreHomeOverviewTab extends StatelessWidget {
  const _StoreHomeOverviewTab({
    super.key,
    required this.store,
    required this.viewModel,
  });

  final CerriaStore store;
  final TownViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      children: <Widget>[
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFDF9),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE8DAC8)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                store.heroHeadline,
                style: GoogleFonts.cormorantGaramond(
                  color: const Color(0xFF2B1E17),
                  fontSize: 25,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                store.heroDesc,
                style: const TextStyle(
                  color: Color(0xFF5D4637),
                  fontSize: 13,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: store.checks.map((ch) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 11,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5ECE0),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      '✓ $ch',
                      style: const TextStyle(
                        color: Color(0xFF382218),
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => viewModel.setCatalogTab('CATALOG'),
                  icon: const Icon(Icons.grid_view_rounded, size: 17),
                  label: const Text('Lihat Seluruh Katalog Produk (2x2 Grid)'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: store.primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(13),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StoreEventsTab extends StatelessWidget {
  const _StoreEventsTab({
    super.key,
    required this.store,
  });

  final CerriaStore store;

  @override
  Widget build(BuildContext context) {
    final events = store.events.isNotEmpty
        ? store.events
        : <CerriaStoreEvent>[
            CerriaStoreEvent(
              dateLabel: 'Sabtu & Minggu',
              title: '${store.title} Weekend Showcase',
              time: '15:00 – 20:00 WIB',
              desc: 'Sesi kurasi produk spesial dan promo warga Cerria Town.',
              tag: 'WEEKEND SPECIAL',
            ),
          ];

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      itemCount: events.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final ev = events[index];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFDF9),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE8DAC8)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: store.primaryColor.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      ev.tag,
                      style: TextStyle(
                        color: store.primaryColor,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${ev.dateLabel} · ${ev.time}',
                    style: const TextStyle(
                      color: Color(0xFF8C6D58),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                ev.title,
                style: const TextStyle(
                  color: Color(0xFF2B1E17),
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                ev.desc,
                style: const TextStyle(
                  color: Color(0xFF5D4637),
                  fontSize: 12.5,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _StoreBagTab extends StatelessWidget {
  const _StoreBagTab({
    super.key,
    required this.viewModel,
  });

  final TownViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final items = viewModel.cartItems;
    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const Icon(
                Icons.shopping_bag_outlined,
                size: 46,
                color: Color(0xFFB39B84),
              ),
              const SizedBox(height: 10),
              const Text(
                'Tas Belanja Masih Kosong',
                style: TextStyle(
                  color: Color(0xFF2B1E17),
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Pilih produk favoritmu di tab Katalog untuk disimpan atau dibeli langsung via Shopee/Tokopedia.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFF7D5E49),
                  fontSize: 12.5,
                ),
              ),
              const SizedBox(height: 14),
              ElevatedButton(
                onPressed: () => viewModel.setCatalogTab('CATALOG'),
                child: const Text('Jelajahi Katalog Produk'),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: <Widget>[
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final item = items[index];
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFDF9),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE8DAC8)),
                ),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            item.product.name,
                            style: const TextStyle(
                              color: Color(0xFF2B1E17),
                              fontSize: 13.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            '${item.selectedShade} · ${item.selectedSize} (x${item.quantity})',
                            style: const TextStyle(
                              color: Color(0xFF7D5E49),
                              fontSize: 11.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            formatRupiah(item.subtotalIdr),
                            style: const TextStyle(
                              color: Color(0xFFC84B31),
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () =>
                          viewModel.launchAffiliateUrl(item.product.shopeeUrl),
                      child: const Text('Checkout ↗'),
                    ),
                    IconButton(
                      onPressed: () => viewModel.removeFromCartAt(index),
                      icon: const Icon(Icons.delete_outline, size: 18),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          decoration: const BoxDecoration(
            color: Color(0xFFFFFDF9),
            border: Border(top: BorderSide(color: Color(0xFFE8DAC8))),
          ),
          child: Row(
            children: <Widget>[
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Text(
                    'TOTAL ESTIMASI',
                    style: TextStyle(
                      color: Color(0xFF8C6D58),
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    formatRupiah(viewModel.cartTotalIdr),
                    style: const TextStyle(
                      color: Color(0xFF2B1E17),
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: () => viewModel.launchAffiliateUrl(
                  items.first.product.shopeeUrl,
                ),
                icon: const Icon(Icons.shopping_cart_checkout_rounded, size: 16),
                label: const Text('Beli via Shopee ↗'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEE4D2D),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Bottom Navigation Bar inside the Store Modal:
/// Left: `← Kembali ke Kota` button
/// Right: 5 Navigation Icons (`Beranda`, `Katalog`, `3D & Detail`, `Events`, `My Bag`)
class _StoreModalBottomBar extends StatelessWidget {
  const _StoreModalBottomBar({
    required this.viewModel,
    required this.store,
    required this.activeTab,
  });

  final TownViewModel viewModel;
  final CerriaStore store;
  final String activeTab;

  @override
  Widget build(BuildContext context) {
    final primary = store.primaryColor;
    final bagCount = viewModel.cartItemCount;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
      decoration: const BoxDecoration(
        color: Color(0xFFF7EFE4),
        border: Border(
          top: BorderSide(color: Color(0xFFE4D4C0), width: 1.0),
        ),
      ),
      child: Row(
        children: <Widget>[
          // `← Kembali ke Kota` Pill Button
          InkWell(
            borderRadius: BorderRadius.circular(99),
            onTap: viewModel.closeStoreCatalogModal,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
              decoration: BoxDecoration(
                color: const Color(0xFF2B1E17),
                borderRadius: BorderRadius.circular(99),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(
                    Icons.arrow_back_rounded,
                    size: 15,
                    color: Color(0xFFFFFDF9),
                  ),
                  SizedBox(width: 5),
                  Text(
                    'Kembali ke Kota',
                    style: TextStyle(
                      color: Color(0xFFFFFDF9),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          // 5 Store Navigation Icon Buttons
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: <Widget>[
                _NavIconButton(
                  icon: Icons.home_outlined,
                  label: 'Beranda',
                  selected: activeTab == 'HOME',
                  activeColor: primary,
                  onTap: () => viewModel.setCatalogTab('HOME'),
                ),
                _NavIconButton(
                  icon: Icons.grid_view_rounded,
                  label: 'Katalog',
                  selected: activeTab == 'CATALOG',
                  activeColor: primary,
                  onTap: () => viewModel.setCatalogTab('CATALOG'),
                ),
                _NavIconButton(
                  icon: Icons.view_in_ar_rounded,
                  label: 'Detail',
                  selected: activeTab == 'DETAIL',
                  activeColor: primary,
                  onTap: () => viewModel.setCatalogTab('DETAIL'),
                ),
                _NavIconButton(
                  icon: Icons.event_available_outlined,
                  label: 'Events',
                  selected: activeTab == 'EVENTS',
                  activeColor: primary,
                  onTap: () => viewModel.setCatalogTab('EVENTS'),
                ),
                _NavIconButton(
                  icon: Icons.shopping_bag_outlined,
                  label: 'My Bag',
                  badgeCount: bagCount,
                  selected: activeTab == 'BAG',
                  activeColor: primary,
                  onTap: () => viewModel.setCatalogTab('BAG'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NavIconButton extends StatelessWidget {
  const _NavIconButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.activeColor,
    required this.onTap,
    this.badgeCount = 0,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final Color activeColor;
  final VoidCallback onTap;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: selected ? activeColor : const Color(0xFFFFFDF9),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? activeColor : const Color(0xFFE0D0BC),
          ),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: <Widget>[
            Icon(
              icon,
              size: 18,
              color: selected ? Colors.white : const Color(0xFF4A3528),
            ),
            if (badgeCount > 0)
              Positioned(
                top: -4,
                right: -4,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 4.5,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEE4D2D),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    '$badgeCount',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
