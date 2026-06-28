// lib/deeplink/deeplink_handler.dart
//
// 深链接收器（app-deeplink-backend-arch plan T19）。
// 统一封装 app_links（iOS Universal Link / Android App Link），
// 暴露 initialLink / links 两个 Stream，不做业务解析。
//
// 解析逻辑抽成顶层纯函数 [parseDeeplink]（可单测，不依赖平台 channel）。

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

/// 短码格式白名单（对齐后端 CampaignAggregate.CODE_PATTERN）
final RegExp _codePattern = RegExp(r'^[a-zA-Z0-9_-]{1,32}$');
bool isValidShortCode(String code) => _codePattern.hasMatch(code);

/// 从 incoming URI 解析出 shortCode（纯函数，可单测，不依赖平台）。
///
/// 识别规则：
/// - Universal Link: `https://<domain>/s/<shortCode>` → 取 pathSegments[1]
/// - 自定义 scheme: `luban://open?shortCode=<code>` → 取 query shortCode
/// - 其他/非法/不匹配 → null（忽略）
DeeplinkPayload? parseDeeplink(
  Uri? uri, {
  required String universalLinkDomain,
  required String urlScheme,
}) {
  if (uri == null) return null;

  // Universal Link: host = domain, pathSegments = ['s', '<code>']
  if (uri.host == universalLinkDomain && uri.scheme == 'https') {
    if (uri.pathSegments.length >= 2 && uri.pathSegments[0] == 's') {
      final code = uri.pathSegments[1];
      if (isValidShortCode(code)) return DeeplinkPayload(shortCode: code);
    }
    return null;
  }

  // 自定义 scheme: luban://...?shortCode=<code>
  if (uri.scheme == urlScheme) {
    final code = uri.queryParameters['shortCode'];
    if (code != null && isValidShortCode(code)) {
      return DeeplinkPayload(shortCode: code);
    }
    return null;
  }

  return null;
}

/// 深链接收器抽象（便于单测 mock）
abstract class DeeplinkHandler {
  /// App 冷启动时系统传递的初始 link（无则不发射任何事件）
  Stream<DeeplinkPayload?> get initialLink;

  /// App 运行态被唤起时的 link 事件流
  Stream<DeeplinkPayload?> get links;
}

/// app_links 实现：调用 [parseDeeplink] 解析 incoming link。
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
    yield parseDeeplink(uri,
        universalLinkDomain: _universalLinkDomain, urlScheme: _urlScheme);
  }

  @override
  Stream<DeeplinkPayload?> get links => _appLinks.uriLinkStream.map((uri) =>
      parseDeeplink(uri,
          universalLinkDomain: _universalLinkDomain, urlScheme: _urlScheme));
}
