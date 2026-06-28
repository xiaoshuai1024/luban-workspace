// test/deeplink/deeplink_handler_test.dart
//
// parseDeeplink 纯函数单测（app-deeplink-backend-arch 测试框架核心）。
// 覆盖 Universal Link / scheme / 非法 / 边界。不依赖平台 channel。

import 'package:flutter_test/flutter_test.dart';
import 'package:luban_flutter/deeplink/deeplink_handler.dart';

void main() {
  const domain = 'app.luban.dev';
  const scheme = 'luban';

  group('parseDeeplink - Universal Link', () {
    test('https://domain/s/<code> → code', () {
      final r = parseDeeplink(
        Uri.parse('https://app.luban.dev/s/promo2026'),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r?.shortCode, 'promo2026');
    });

    test('https://domain/s/<code>/ 末尾斜杠仍取 code', () {
      final r = parseDeeplink(
        Uri.parse('https://app.luban.dev/s/spring/'),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r?.shortCode, 'spring');
    });

    test('https://domain/s/ 无 code → null', () {
      final r = parseDeeplink(
        Uri.parse('https://app.luban.dev/s/'),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r, isNull);
    });

    test('https://domain/other/<code> 非 /s/ 前缀 → null', () {
      final r = parseDeeplink(
        Uri.parse('https://app.luban.dev/p/promo'),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r, isNull);
    });

    test('https://其他域名/s/<code> → null', () {
      final r = parseDeeplink(
        Uri.parse('https://evil.com/s/promo'),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r, isNull);
    });
  });

  group('parseDeeplink - 自定义 scheme', () {
    test('luban://open?shortCode=<code> → code', () {
      final r = parseDeeplink(
        Uri.parse('luban://open?shortCode=abc123'),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r?.shortCode, 'abc123');
    });

    test('luban://open 无 shortCode → null', () {
      final r = parseDeeplink(
        Uri.parse('luban://open'),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r, isNull);
    });

    test('luban://open?shortCode= (空值) → null', () {
      final r = parseDeeplink(
        Uri.parse('luban://open?shortCode='),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r, isNull);
    });
  });

  group('parseDeeplink - 短码格式白名单', () {
    test('合法 code：字母数字下划线连字符', () {
      for (final code in ['a', 'A1', 'spring_sale-2026', 'x_y-z']) {
        final r = parseDeeplink(
          Uri.parse('luban://open?shortCode=$code'),
          universalLinkDomain: domain,
          urlScheme: scheme,
        );
        expect(r?.shortCode, code, reason: '$code 应合法');
      }
    });

    test('非法 code：含特殊字符 → null', () {
      for (final code in ['a b', 'a/b', 'a.b', 'a#b', '中文']) {
        final r = parseDeeplink(
          Uri.parse('luban://open?shortCode=${Uri.encodeComponent(code)}'),
          universalLinkDomain: domain,
          urlScheme: scheme,
        );
        expect(r, isNull, reason: '$code 应被拒绝');
      }
    });

    test('超长 code（>32 字符）→ null', () {
      final longCode = 'a' * 33;
      final r = parseDeeplink(
        Uri.parse('luban://open?shortCode=$longCode'),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r, isNull);
    });
  });

  group('parseDeeplink - 边界', () {
    test('null uri → null', () {
      expect(
        parseDeeplink(null, universalLinkDomain: domain, urlScheme: scheme),
        isNull,
      );
    });

    test('http 非 https Universal Link → null', () {
      final r = parseDeeplink(
        Uri.parse('http://app.luban.dev/s/promo'),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r, isNull);
    });

    test('无关 scheme（如 mailto）→ null', () {
      final r = parseDeeplink(
        Uri.parse('mailto:test@test.com'),
        universalLinkDomain: domain,
        urlScheme: scheme,
      );
      expect(r, isNull);
    });
  });

  group('isValidShortCode', () {
    test('合法', () {
      expect(isValidShortCode('a'), isTrue);
      expect(isValidShortCode('A1-_'), isTrue);
      expect(isValidShortCode('a' * 32), isTrue);
    });
    test('非法', () {
      expect(isValidShortCode(''), isFalse);
      expect(isValidShortCode('a b'), isFalse);
      expect(isValidShortCode('a' * 33), isFalse);
      expect(isValidShortCode('a.b'), isFalse);
    });
  });
}
