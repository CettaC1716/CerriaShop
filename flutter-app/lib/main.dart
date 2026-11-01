import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'data/repositories/store_repository.dart';
import 'data/services/local_web_asset_server.dart';
import 'data/services/supabase_config.dart';
import 'ui/features/town/view_models/town_view_model.dart';
import 'ui/features/town/views/cerria_town_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

  // 1. Initialize Supabase with zero-crash fallback when offline
  try {
    await Supabase.initialize(
      url: CerriaSupabaseConfig.url,
      // ignore: deprecated_member_use
      anonKey: CerriaSupabaseConfig.anonKey,
    );
  } catch (_) {
    // Offline mode: StoreRepository automatically falls back to assets/data/stores-data.json
  }

  // 2. Start offline loopback HTTP server for Three.js ES modules (`?mode=flutter-3d-canvas`)
  final webServer = LocalWebAssetServer();
  String canvasUrl = 'http://127.0.0.1:8080/index.html?mode=flutter-3d-canvas';
  try {
    canvasUrl = await webServer.start();
  } catch (_) {
    // Fallback URL if running in test environment
  }

  // 3. Initialize Repository & ViewModel
  final storeRepository = StoreRepository();
  final townViewModel = TownViewModel(storeRepository: storeRepository);
  await townViewModel.initialize();

  runApp(
    CerriaTownApp(
      viewModel: townViewModel,
      canvasUrl: canvasUrl,
    ),
  );
}

class CerriaTownApp extends StatelessWidget {
  const CerriaTownApp({
    super.key,
    required this.viewModel,
    required this.canvasUrl,
  });

  final TownViewModel viewModel;
  final String canvasUrl;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cerria Town',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFE07A5F),
          brightness: Brightness.light,
        ),
        textTheme: GoogleFonts.dmSansTextTheme(),
      ),
      home: CerriaTownScreen(
        viewModel: viewModel,
        canvasUrl: canvasUrl,
      ),
    );
  }
}
