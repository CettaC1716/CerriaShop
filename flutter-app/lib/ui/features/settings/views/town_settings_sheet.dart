import 'package:flutter/material.dart';
import '../../../core/glass_container.dart';
import '../../town/view_models/town_view_model.dart';

/// Native Flutter Settings Bottom Sheet (`⚙️ Pengaturan Kota & Suasana`),
/// including the `📖 Buka Panduan Kota` action button inside Settings.
class TownSettingsSheet extends StatelessWidget {
  const TownSettingsSheet({
    super.key,
    required this.viewModel,
  });

  final TownViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: viewModel,
      builder: (context, _) {
        final state = viewModel.clockWeather;
        final isRain = state.weatherIndex == 4 || state.weatherId == 'rain';
        final isFog = state.weatherIndex == 3 || state.weatherId == 'fog';
        final isClear = !isRain && !isFog;

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: CerriaGlassContainer(
              borderRadius: BorderRadius.circular(26),
              backgroundColor: const Color(0xEB18211C),
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 16),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    // Header
                    Row(
                      children: <Widget>[
                        const Text(
                          '⚙️ Pengaturan Kota & Suasana',
                          style: TextStyle(
                            color: Color(0xFFFFF8EE),
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const Spacer(),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(
                            Icons.close_rounded,
                            color: Color(0xCCFFF8EE),
                            size: 20,
                          ),
                        ),
                      ],
                    ),
                    const Divider(color: Color(0x26FFF8EE), height: 16),

                    // 1. Radio & Volume
                    Row(
                      children: <Widget>[
                        const Text(
                          '🎵 Radio & Suara Kota',
                          style: TextStyle(
                            color: Color(0xFFEAE0D2),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Spacer(),
                        TextButton.icon(
                          onPressed: viewModel.toggleMusic,
                          icon: Icon(
                            state.musicEnabled
                                ? Icons.volume_up_rounded
                                : Icons.volume_off_rounded,
                            size: 16,
                            color: const Color(0xFFFFB86C),
                          ),
                          label: Text(
                            state.musicEnabled ? 'Aktif' : 'Mute',
                            style: const TextStyle(
                              color: Color(0xFFFFB86C),
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Slider(
                      value: state.musicVolume.clamp(0.0, 1.0),
                      min: 0.0,
                      max: 1.0,
                      activeColor: const Color(0xFFFF8E53),
                      onChanged: viewModel.setMusicVolume,
                    ),

                    // 2. Penerangan Kota
                    Row(
                      children: <Widget>[
                        const Text(
                          '💡 Penerangan Lampu Kota',
                          style: TextStyle(
                            color: Color(0xFFEAE0D2),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${(state.cityLightMult * 100).round()}%',
                          style: const TextStyle(
                            color: Color(0xFFFFB86C),
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    Slider(
                      value: state.cityLightMult.clamp(0.5, 2.5),
                      min: 0.5,
                      max: 2.5,
                      activeColor: const Color(0xFFFFB86C),
                      onChanged: viewModel.setCityLightIntensity,
                    ),

                    // 3. Kecepatan Waktu & Jalan (SimSpeed)
                    const Text(
                      '🏃 Kecepatan Waktu & Jalan',
                      style: TextStyle(
                        color: Color(0xFFEAE0D2),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: <Widget>[
                        _SpeedChip(
                          label: state.paused ? '▶ Jalan' : '⏸ Jeda',
                          selected: state.paused,
                          onTap: () => viewModel.setSimSpeed(0),
                        ),
                        const SizedBox(width: 6),
                        for (final spd in const <double>[1, 2, 4, 8]) ...<Widget>[
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(right: 4),
                              child: _SpeedChip(
                                label: '${spd.toInt()}×',
                                selected:
                                    !state.paused && (state.simSpeed - spd).abs() < 0.2,
                                onTap: () => viewModel.setSimSpeed(spd),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 14),

                    // 4. Waktu & Siklus Siang/Malam + Cuaca Visual
                    Row(
                      children: <Widget>[
                        Text(
                          '🌗 Waktu Kota (${state.clock})',
                          style: const TextStyle(
                            color: Color(0xFFEAE0D2),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Spacer(),
                        FilterChip(
                          label: const Text(
                            'Siklus Otomatis',
                            style: TextStyle(fontSize: 11),
                          ),
                          selected: state.cycleOn,
                          onSelected: viewModel.toggleAutoCycle,
                        ),
                      ],
                    ),
                    Slider(
                      value: state.daytime.clamp(0.0, 23.95),
                      min: 0.0,
                      max: 23.95,
                      activeColor: const Color(0xFF7BC8A4),
                      onChanged: viewModel.setTimeOfDayHour,
                    ),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: _SpeedChip(
                            label: '☀️ Cerah',
                            selected: isClear,
                            onTap: () => viewModel.setWeather('clear'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _SpeedChip(
                            label: '🌧️ Hujan',
                            selected: isRain,
                            onTap: () => viewModel.setWeather('rain'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _SpeedChip(
                            label: '🌫️ Kabut',
                            selected: isFog,
                            onTap: () => viewModel.setWeather('fog'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // 5. Kamera & Macro DOF
                    SwitchListTile.adaptive(
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        '📷 Lensa Kamera Macro DOF',
                        style: TextStyle(
                          color: Color(0xFFEAE0D2),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      subtitle: Text(
                        'Auto-Scaler aktif · ${state.fps} FPS stabil',
                        style: const TextStyle(
                          color: Color(0x99FFF8EE),
                          fontSize: 11,
                        ),
                      ),
                      value: state.dofEnabled,
                      onChanged: (v) => viewModel.setMacroDOF(v),
                    ),
                    const SizedBox(height: 8),

                    // 6. Tombol 📖 Buka Panduan Kota di dalam Pengaturan
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(context).pop();
                          _showTownGuideDialog(context);
                        },
                        icon: const Text('📖', style: TextStyle(fontSize: 15)),
                        label: const Text('Buka Panduan Kota'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFFF8E53),
                          foregroundColor: const Color(0xFF1F1610),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void _showTownGuideDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFFFDF8F3),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          title: const Text(
            '📖 Panduan Cerria Town',
            style: TextStyle(
              color: Color(0xFF2B1E17),
              fontWeight: FontWeight.w900,
            ),
          ),
          content: const SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  '1. Navigasi 7 Toko Ikonik\n'
                  'Gunakan tombol kapsul [← 1/7 →] di area jempol bawah atau ketuk kartu tetangga kiri/kanan untuk berpindah antar 7 gedung.\n\n'
                  '2. Katalog Produk & Affiliate Link\n'
                  'Ketuk tombol [Info ↑] atau ketuk langsung bangunan 3D untuk membuka katalog produk 2x2 dan membeli langsung via aplikasi Shopee / Tokopedia.\n\n'
                  '3. Suasana Waktu & Cuaca 3D\n'
                  'Ketuk kapsul waktu (🌙 Night / ☀️ Day) atau suhu cuaca di bar bawah untuk mengubah atmosfer kota 3D secara langsung.',
                  style: TextStyle(
                    color: Color(0xFF4F3B2F),
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Mengerti'),
            ),
          ],
        );
      },
    );
  }
}

class _SpeedChip extends StatelessWidget {
  const _SpeedChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFFF8E53) : const Color(0x22FFF8EE),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? const Color(0xFFFFB86C) : const Color(0x33FFF8EE),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? const Color(0xFF1E140E) : const Color(0xFFFFF8EE),
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
