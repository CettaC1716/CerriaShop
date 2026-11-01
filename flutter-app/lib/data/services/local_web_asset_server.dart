import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Hardened loopback HTTP asset server (`http://127.0.0.1:<port>`) that serves
/// `assets/web/...` from Flutter's bundled assets (`rootBundle`) with strict
/// path-traversal protection, read-only method whitelisting, and same-origin headers.
class LocalWebAssetServer {
  HttpServer? _server;
  int _port = 0;

  int get port => _port;
  bool get isRunning => _server != null && _port > 0;

  String get canvasEntryUrl =>
      'http://127.0.0.1:$_port/index.html?mode=flutter-3d-canvas';

  Future<String> start() async {
    if (isRunning) return canvasEntryUrl;

    // Bind strictly to IPv4 loopback (127.0.0.1) — unreachable from external Wi-Fi/LAN
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server = server;
    _port = server.port;

    server.listen(_handleRequest, onError: (_) {});
    return canvasEntryUrl;
  }

  Future<void> _handleRequest(HttpRequest request) async {
    try {
      // 1. Only allow read-only GET / HEAD requests
      if (request.method != 'GET' && request.method != 'HEAD') {
        request.response.statusCode = HttpStatus.methodNotAllowed;
        await request.response.close();
        return;
      }

      // 2. Verify request originates from loopback interface
      final remoteAddr = request.connectionInfo?.remoteAddress.address ?? '';
      if (remoteAddr.isNotEmpty && remoteAddr != '127.0.0.1' && remoteAddr != '::1') {
        request.response.statusCode = HttpStatus.forbidden;
        await request.response.close();
        return;
      }

      String reqPath = Uri.decodeComponent(request.uri.path);
      if (reqPath == '/' || reqPath.isEmpty) {
        reqPath = '/index.html';
      }

      // 3. Strict Path-Traversal & Null-Byte Guard
      if (reqPath.contains('..') ||
          reqPath.contains('\\') ||
          reqPath.contains('\u0000') ||
          reqPath.contains('//')) {
        request.response.statusCode = HttpStatus.forbidden;
        await request.response.close();
        return;
      }

      // Normalize path strictly inside `assets/web/`
      final cleanRel = reqPath.replaceFirst(RegExp(r'^/+'), '');
      final segments = cleanRel.split('/').where((s) => s.isNotEmpty).toList();
      if (segments.any((s) => s == '.' || s == '..' || s.startsWith('.env'))) {
        request.response.statusCode = HttpStatus.forbidden;
        await request.response.close();
        return;
      }

      final assetKey = 'assets/web/${segments.join('/')}';

      final ByteData data = await rootBundle.load(assetKey);
      final bytes = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);

      request.response.statusCode = HttpStatus.ok;
      request.response.headers.set(
        HttpHeaders.contentTypeHeader,
        _mimeTypeForPath(cleanRel),
      );
      // Hardened security headers (no wildcard CORS)
      request.response.headers.set('X-Content-Type-Options', 'nosniff');
      request.response.headers.set('X-Frame-Options', 'DENY');
      request.response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
      request.response.headers.set(
        'Access-Control-Allow-Origin',
        'http://127.0.0.1:$_port',
      );
      request.response.headers.set(HttpHeaders.cacheControlHeader, 'no-cache');

      if (request.method == ' GET' || request.method == 'GET') {
        request.response.add(bytes);
      }
      await request.response.close();
    } catch (e) {
      debugPrint('[LocalWebAssetServer] 404 for ${request.uri.path}: $e');
      request.response.statusCode = HttpStatus.notFound;
      await request.response.close();
    }
  }

  String _mimeTypeForPath(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
    if (lower.endsWith('.js') || lower.endsWith('.mjs')) {
      return 'application/javascript; charset=utf-8';
    }
    if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
    if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.glb')) return 'model/gltf-binary';
    if (lower.endsWith('.gltf')) return 'model/gltf+json';
    if (lower.endsWith('.obj')) return 'text/plain; charset=utf-8';
    if (lower.endsWith('.woff2')) return 'font/woff2';
    return 'application/octet-stream';
  }

  Future<void> dispose() async {
    await _server?.close(force: true);
    _server = null;
    _port = 0;
  }
}
