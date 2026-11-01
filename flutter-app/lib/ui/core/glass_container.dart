import 'dart:ui';
import 'package:flutter/material.dart';

/// Reusable Native Flutter Glassmorphism container using `ClipRRect` +
/// `BackdropFilter(filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16))`.
class CerriaGlassContainer extends StatelessWidget {
  const CerriaGlassContainer({
    super.key,
    required this.child,
    this.borderRadius = const BorderRadius.all(Radius.circular(20)),
    this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    this.backgroundColor = const Color(0xB81B241F),
    this.borderColor = const Color(0x38FFF8EE),
    this.blurSigma = 16.0,
    this.boxShadow,
  });

  final Widget child;
  final BorderRadius borderRadius;
  final EdgeInsetsGeometry padding;
  final Color backgroundColor;
  final Color borderColor;
  final double blurSigma;
  final List<BoxShadow>? boxShadow;

  @override
  Widget build(BuildContext context) {
    // Hardware-accelerated zero-readback frosted surface over Android PlatformView (WebViewWidget).
    // Avoids BackdropFilter over Hybrid Composition SurfaceTexture which causes GPU pipeline stalls on mobile.
    final Color opaqueTinted = backgroundColor.withValues(
      alpha: (backgroundColor.a + 0.14).clamp(0.84, 0.96),
    );
    return RepaintBoundary(
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          color: opaqueTinted,
          borderRadius: borderRadius,
          border: Border.all(color: borderColor, width: 1.1),
          boxShadow: boxShadow ??
              const <BoxShadow>[
                BoxShadow(
                  color: Color(0x36000000),
                  blurRadius: 14,
                  offset: Offset(0, 6),
                ),
              ],
        ),
        child: child,
      ),
    );
  }
}

/// Iconic Orange Rounded `C` Logo Badge of Cerria Town.
class CerriaBrandLogo extends StatelessWidget {
  const CerriaBrandLogo({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.34),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[
            Color(0xFFFF6B6B),
            Color(0xFFFF8E53),
            Color(0xFFFFB86C),
          ],
        ),
        border: Border.all(
          color: const Color(0x8CFFFFFF),
          width: 1.4,
        ),
        boxShadow: const <BoxShadow>[
          BoxShadow(
            color: Color(0x4DFF7A50),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Center(
        child: Text(
          'C',
          style: TextStyle(
            color: const Color(0xFFFFFDF9),
            fontSize: size * 0.54,
            fontWeight: FontWeight.w900,
            height: 1.0,
          ),
        ),
      ),
    );
  }
}

/// Isometric 3D Mini Building illustration rendered on the right side of the
/// Store Banner (`Season Special`) in Smartphone Portrait & Desktop modals.
class CerriaIsometricBuildingBadge extends StatelessWidget {
  const CerriaIsometricBuildingBadge({
    super.key,
    required this.primaryColor,
    required this.storeSign,
    this.size = 86,
  });

  final Color primaryColor;
  final String storeSign;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _IsometricBuildingPainter(primaryColor: primaryColor),
        child: Align(
          alignment: Alignment.topCenter,
          child: Container(
            margin: const EdgeInsets.only(top: 4),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFF2B1E17),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              storeSign.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Color(0xFFFFFDF8),
                fontSize: 8.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.4,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _IsometricBuildingPainter extends CustomPainter {
  const _IsometricBuildingPainter({required this.primaryColor});

  final Color primaryColor;

  @override
  void paint(Canvas canvas, Size size) {
    final double cx = size.width * 0.5;
    final double baseY = size.height * 0.84;
    final double bw = size.width * 0.34;
    final double bh = size.height * 0.36;
    final double isoY = size.height * 0.13;

    // Ground plaza shadow
    final shadowPaint = Paint()..color = const Color(0x28000000);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(cx, baseY + 2),
        width: bw * 2.1,
        height: isoY * 1.9,
      ),
      shadowPaint,
    );

    // Left facade wall
    final leftWall = Path()
      ..moveTo(cx - bw, baseY - isoY)
      ..lineTo(cx, baseY)
      ..lineTo(cx, baseY - bh)
      ..lineTo(cx - bw, baseY - bh - isoY)
      ..close();
    canvas.drawPath(leftWall, Paint()..color = const Color(0xFFFAF3EB));

    // Right facade wall
    final rightWall = Path()
      ..moveTo(cx, baseY)
      ..lineTo(cx + bw, baseY - isoY)
      ..lineTo(cx + bw, baseY - bh - isoY)
      ..lineTo(cx, baseY - bh)
      ..close();
    canvas.drawPath(rightWall, Paint()..color = const Color(0xFFEDE0D0));

    // Isometric Roof Deck
    final roof = Path()
      ..moveTo(cx, baseY - bh)
      ..lineTo(cx + bw + 3, baseY - bh - isoY)
      ..lineTo(cx, baseY - bh - isoY * 2)
      ..lineTo(cx - bw - 3, baseY - bh - isoY)
      ..close();
    canvas.drawPath(roof, Paint()..color = primaryColor);

    // Warm glowing storefront windows
    final winPaint = Paint()..color = const Color(0xFFFFE5A3);
    final leftWin = Path()
      ..moveTo(cx - bw * 0.72, baseY - isoY * 0.72 - 6)
      ..lineTo(cx - bw * 0.18, baseY - isoY * 0.18 - 6)
      ..lineTo(cx - bw * 0.18, baseY - isoY * 0.18 - bh * 0.56)
      ..lineTo(cx - bw * 0.72, baseY - isoY * 0.72 - bh * 0.56)
      ..close();
    canvas.drawPath(leftWin, winPaint);

    final rightWin = Path()
      ..moveTo(cx + bw * 0.18, baseY - isoY * 0.18 - 6)
      ..lineTo(cx + bw * 0.72, baseY - isoY * 0.72 - 6)
      ..lineTo(cx + bw * 0.72, baseY - isoY * 0.72 - bh * 0.56)
      ..lineTo(cx + bw * 0.18, baseY - isoY * 0.18 - bh * 0.56)
      ..close();
    canvas.drawPath(rightWin, winPaint);
  }

  @override
  bool shouldRepaint(covariant _IsometricBuildingPainter oldDelegate) {
    return oldDelegate.primaryColor != primaryColor;
  }
}
