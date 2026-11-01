import 'package:flutter/material.dart';

/// Permanent store navigation order in Cerria Town (`toko1` .. `toko7`).
const List<String> kCerriaStoreIds = <String>[
  'toko1',
  'toko2',
  'toko3',
  'toko4',
  'toko5',
  'toko6',
  'toko7',
];

Color parseHexColor(String? hex, {Color fallback = const Color(0xFFE07A5F)}) {
  if (hex == null || hex.trim().isEmpty) return fallback;
  final cleaned = hex.trim().replaceFirst('#', '');
  if (cleaned.length == 6) {
    final val = int.tryParse('FF$cleaned', radix: 16);
    if (val != null) return Color(val);
  } else if (cleaned.length == 8) {
    final val = int.tryParse(cleaned, radix: 16);
    if (val != null) return Color(val);
  }
  return fallback;
}

String formatRupiah(int amount) {
  final str = amount.abs().toString();
  final buffer = StringBuffer();
  for (int i = 0; i < str.length; i++) {
    if (i > 0 && (str.length - i) % 3 == 0) {
      buffer.write('.');
    }
    buffer.write(str[i]);
  }
  return 'Rp $buffer';
}

class CerriaShadeOption {
  const CerriaShadeOption({
    required this.name,
    required this.hex,
    this.accentHex = '#FAF3EB',
  });

  final String name;
  final String hex;
  final String accentHex;

  Color get color => parseHexColor(hex);
}

class CerriaSizeOption {
  const CerriaSizeOption({
    required this.label,
    required this.spec,
    this.multiplier = 1.0,
  });

  final String label;
  final String spec;
  final double multiplier;
}

class CerriaProduct {
  const CerriaProduct({
    required this.id,
    required this.storeId,
    required this.name,
    required this.sub,
    required this.category,
    required this.priceIdr,
    required this.description,
    required this.tags,
    required this.badge,
    required this.sizes,
    required this.shades,
    required this.shopeeUrl,
    required this.tokopediaUrl,
    required this.stock,
  });

  final String id;
  final String storeId;
  final String name;
  final String sub;
  final String category;
  final int priceIdr;
  final String description;
  final List<String> tags;
  final String badge;
  final List<CerriaSizeOption> sizes;
  final List<CerriaShadeOption> shades;
  final String shopeeUrl;
  final String tokopediaUrl;
  final int stock;

  String get formattedPrice => formatRupiah(priceIdr);
}

class CerriaStoreSpec {
  const CerriaStoreSpec({
    required this.icon,
    required this.value,
    required this.label,
  });

  final String icon;
  final String value;
  final String label;
}

class CerriaStoreEvent {
  const CerriaStoreEvent({
    required this.dateLabel,
    required this.title,
    required this.time,
    required this.desc,
    required this.tag,
  });

  final String dateLabel;
  final String title;
  final String time;
  final String desc;
  final String tag;
}

class CerriaNeighborSummary {
  const CerriaNeighborSummary({
    required this.storeIndex,
    required this.storeId,
    required this.name,
    required this.pillTitle,
    required this.summary,
    required this.visitors,
    required this.colorHex,
  });

  final int storeIndex;
  final String storeId;
  final String name;
  final String pillTitle;
  final String summary;
  final int visitors;
  final String colorHex;

  Color get accentColor => parseHexColor(colorHex);
}

class CerriaStore {
  const CerriaStore({
    required this.id,
    required this.displayOrder,
    required this.sign,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.metric,
    required this.unit,
    required this.delta,
    required this.visitors,
    required this.colorHex,
    required this.gradHex,
    required this.checks,
    required this.specs,
    required this.ctaLabel,
    required this.heroEyebrow,
    required this.heroHeadline,
    required this.heroSub,
    required this.heroDesc,
    required this.products,
    required this.events,
  });

  final String id;
  final int displayOrder;
  final String sign;
  final String title;
  final String subtitle;
  final String badge;
  final String metric;
  final String unit;
  final String delta;
  final int visitors;
  final String colorHex;
  final List<String> gradHex;
  final List<String> checks;
  final List<CerriaStoreSpec> specs;
  final String ctaLabel;
  final String heroEyebrow;
  final String heroHeadline;
  final String heroSub;
  final String heroDesc;
  final List<CerriaProduct> products;
  final List<CerriaStoreEvent> events;

  Color get primaryColor => parseHexColor(colorHex);

  List<Color> get gradientColors {
    if (gradHex.length >= 2) {
      return gradHex.map((h) => parseHexColor(h, fallback: primaryColor)).toList();
    }
    return <Color>[
      primaryColor.withValues(alpha: 0.85),
      primaryColor,
    ];
  }
}

class CerriaCartItem {
  const CerriaCartItem({
    required this.product,
    required this.selectedSize,
    required this.selectedShade,
    required this.quantity,
  });

  final CerriaProduct product;
  final String selectedSize;
  final String selectedShade;
  final int quantity;

  int get subtotalIdr => product.priceIdr * quantity;

  CerriaCartItem copyWith({int? quantity}) {
    return CerriaCartItem(
      product: product,
      selectedSize: selectedSize,
      selectedShade: selectedShade,
      quantity: quantity ?? this.quantity,
    );
  }
}

class CerriaTownClockWeatherState {
  const CerriaTownClockWeatherState({
    this.daytime = 17.5,
    this.clock = '17:30',
    this.date = 'Kam, 29 Okt',
    this.mood = '🌅 Dusk',
    this.climate = '25°C · Cerah',
    this.track = 'Sunny Morning Bossa · Gentle Town Stroll — Cerria Town Radio',
    this.weatherId = 'sunny',
    this.weatherIndex = 0,
    this.cityLightMult = 1.2,
    this.simSpeed = 8.0,
    this.paused = false,
    this.cycleOn = true,
    this.dofEnabled = false,
    this.shutter = 0.18,
    this.musicEnabled = false,
    this.musicVolume = 0.42,
    this.fps = 60,
  });

  final double daytime;
  final String clock;
  final String date;
  final String mood;
  final String climate;
  final String track;
  final String weatherId;
  final int weatherIndex;
  final double cityLightMult;
  final double simSpeed;
  final bool paused;
  final bool cycleOn;
  final bool dofEnabled;
  final double shutter;
  final bool musicEnabled;
  final double musicVolume;
  final int fps;

  CerriaTownClockWeatherState copyWith({
    double? daytime,
    String? clock,
    String? date,
    String? mood,
    String? climate,
    String? track,
    String? weatherId,
    int? weatherIndex,
    double? cityLightMult,
    double? simSpeed,
    bool? paused,
    bool? cycleOn,
    bool? dofEnabled,
    double? shutter,
    bool? musicEnabled,
    double? musicVolume,
    int? fps,
  }) {
    return CerriaTownClockWeatherState(
      daytime: daytime ?? this.daytime,
      clock: clock ?? this.clock,
      date: date ?? this.date,
      mood: mood ?? this.mood,
      climate: climate ?? this.climate,
      track: track ?? this.track,
      weatherId: weatherId ?? this.weatherId,
      weatherIndex: weatherIndex ?? this.weatherIndex,
      cityLightMult: cityLightMult ?? this.cityLightMult,
      simSpeed: simSpeed ?? this.simSpeed,
      paused: paused ?? this.paused,
      cycleOn: cycleOn ?? this.cycleOn,
      dofEnabled: dofEnabled ?? this.dofEnabled,
      shutter: shutter ?? this.shutter,
      musicEnabled: musicEnabled ?? this.musicEnabled,
      musicVolume: musicVolume ?? this.musicVolume,
      fps: fps ?? this.fps,
    );
  }
}
