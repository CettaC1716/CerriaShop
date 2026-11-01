import 'package:cerria_town_flutter/data/repositories/store_repository.dart';
import 'package:cerria_town_flutter/main.dart';
import 'package:cerria_town_flutter/ui/features/town/view_models/town_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Cerria Town Hybrid HUD renders header, thumb-zone & dock bar', (
    WidgetTester tester,
  ) async {
    final repo = StoreRepository();
    final vm = TownViewModel(storeRepository: repo);
    await vm.initialize();

    await tester.pumpWidget(
      CerriaTownApp(
        viewModel: vm,
        canvasUrl: 'about:blank',
      ),
    );
    await tester.pump();

    expect(find.text('Cerria Town'), findsOneWidget);
    expect(find.textContaining('Info ↑'), findsOneWidget);
    expect(find.text('5 / 7'), findsOneWidget);
  });
}
