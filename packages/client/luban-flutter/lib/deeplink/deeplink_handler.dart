// lib/deeplink/deeplink_handler.dart
//
// 深链接收器（app-deeplink-backend-arch plan T19）。
// 统一封装 app_links（iOS Universal Link / Android App Link），
// 暴露 initialLink / links 两个 Stream，不做业务解析。

import 'dart:async';
import 'package:app_links/app_links.dart';

/// 深链解析结果：从 incoming link 提取出的 shortCode（或 null=非本站链接）。
class DeeplinkPayload {
  /// 短码（channel.short_url）；null 表示 incoming link 非本站深链（忽略）
  final String? shortCode;

  const DeeplinkPayload({this.shortCode});

  @override
  String toString() => 'DeeplinkPayload(shortCode: $shortCode)';
}

/// 深链接收器抽象（便于单测 mock）
abstract class DeeplinkHandler {
  /// App 冷启动时系统传递的初始 link（无则不发射任何事件）
  Stream<DeeplinkPayload?> get initialLink;

  /// App 运行态被唤起时的 link 事件流
  Stream<DeeplinkPayload?> get links;
}

/// app_links 实现：识别 Universal Link（`https://domain/s/shortCode`）
/// 与自定义 scheme（`luban://open?shortCode=code`）。
class AppLinksDeeplinkHandler implements DeeplinkHandler {
  final String _universalLinkDomain;
  final String _urlScheme;
  final AppLinks _appLinks;

  AppLinksDeeplinkHandler({
    required String universalLinkDomain,
    required String urlScheme,
    AppLinks? appLinks,
  })  : _universalLinkDomain = universalLinkDomain,
        _urlScheme = urlScheme,
        _appLinks = appLinks ?? AppLinks();

  @override
  Stream<DeeplinkPayload?> get initialLink async* {
    final uri = await _appLinks.getInitialLink();
    yield _parse(uri);
  }

  @override
  Stream<DeeplinkPayload?> get links =>
      _appLinks.uriLinkStream.map(_parse);

  /// 从 incoming URI 解析出 shortCode。
  /// - Universal Link: `https://domain/s/shortCode` → 取 path 第 2 段
  /// - Scheme: `luban://open?shortCode=code` → 取 query shortCode
  /// - 其他/非法 → null（忽略）
  DeeplinkPayload? _parse(Uri? uri) {
    if (uri == null) return null;

    // Universal Link: host = domain, pathSegments = ['s', '<code>']
    if (uri.host == _universalLinkDomain && uri.scheme == 'https') {
      if (uri.pathSegments.length >= 2 && uri.pathSegments[0] == 's') {
        final code = uri.pathSegments[1];
        if (_isValidCode(code)) return DeeplinkPayload(shortCode: code);
      }
      return null;
    }

    // 自定义 scheme: luban://...?shortCode=<code>
    if (uri.scheme == _urlScheme) {
      final code = uri.queryParameters['shortCode'];
      if (code != null && _isValidCode(code)) {
        return DeeplinkPayload(shortCode: code);
      }
      return null;
    }

    return null;
  }

  /// 短码格式白名单（对齐后端 CampaignAggregate.CODE_PATTERN）
  static bool _isValidCode(String code) =>
      RegExp(r'^[a-zA-Z0-9_-]{1,32}$').hasMatch(code);
}
