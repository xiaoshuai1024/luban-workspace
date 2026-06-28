// lib/config/env.dart
//
// 环境配置（app-deeplink-backend-arch plan T18）。
// 通过 --dart-define 注入，生产/测试/开发分离。

class Env {
  /// BFF 基地址（拉 page schema + 短链解析）
  /// 默认指向本机 dev BFF（与 website 同源）
  final String bffBaseUrl;

  /// Universal Link / App Link 域名（用于识别 incoming link 是否为本站）
  final String universalLinkDomain;

  /// 自定义 URL scheme（luban://open?shortCode=xxx）
  final String urlScheme;

  /// 是否启用深链解析（本地 FeatureGate，plan §6.5 App 端开关）
  /// 关闭时 App 直接进兜底页，不尝试解析 incoming link
  final bool deeplinkEnabled;

  const Env({
    required this.bffBaseUrl,
    required this.universalLinkDomain,
    required this.urlScheme,
    required this.deeplinkEnabled,
  });

  /// 从 --dart-define 读取，缺省用 dev 默认值
  factory Env.fromEnvironment() {
    const bff = String.fromEnvironment(
      'BFF_BASE_URL',
      defaultValue: 'http://127.0.0.1:3100',
    );
    const domain = String.fromEnvironment(
      'UNIVERSAL_LINK_DOMAIN',
      defaultValue: 'app.luban.dev',
    );
    const scheme = String.fromEnvironment(
      'URL_SCHEME',
      defaultValue: 'luban',
    );
    const enabled = bool.fromEnvironment(
      'DEEPLINK_ENABLED',
      defaultValue: true,
    );
    return const Env(
      bffBaseUrl: bff,
      universalLinkDomain: domain,
      urlScheme: scheme,
      deeplinkEnabled: enabled,
    );
  }

  /// 测试用工厂（注入固定值）
  const Env.test({
    this.bffBaseUrl = 'http://test:3100',
    this.universalLinkDomain = 'test.luban.dev',
    this.urlScheme = 'luban',
    this.deeplinkEnabled = true,
  });
}
