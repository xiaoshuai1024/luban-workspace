// test/deeplink/deeplink_resolver_test.dart
//
// HttpDeeplinkResolver 单测（app-deeplink-backend-arch 测试框架）。
// 用 http_mock_adapter 拦截 dio 请求，覆盖成功/404/410/网络错四态。
//
// http_mock_adapter 0.6.x API：回调式
//   adapter.onGet(path, (server) => server.reply(200, data));
//   adapter.onGet(path, (server) => server.throws(404, DioException(...)));

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:luban_flutter/deeplink/deeplink_resolver.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late HttpDeeplinkResolver resolver;

  const backend = 'http://backend:8080/backend';
  const bff = 'http://bff:3100';

  setUp(() {
    dio = Dio();
    adapter = DioAdapter(dio: dio);
    resolver = HttpDeeplinkResolver(
      dio: dio,
      backendBaseUrl: backend,
      bffBaseUrl: bff,
    );
  });

  group('HttpDeeplinkResolver.resolve - 成功', () {
    test('短链解析 + 页面拉取全链路成功', () async {
      // Step 1: /public/short/:code
      adapter.onGet('$backend/public/short/promo2026', (server) {
        server.reply(200, {
          'siteSlug': 'acme',
          'pagePath': '/home',
          'channelCode': 'promo2026',
          'utmTemplate': {'utm_source': 'wechat'},
        });
      });
      // Step 2: page by-path
      adapter.onGet('$bff/api/public/sites/acme/pages/by-path', (server) {
        server.reply(200, {
          'id': 'p1',
          'siteId': 's1',
          'name': '首页',
          'path': '/home',
          'status': 'published',
          'schema': {
            'root': {
              'id': 'r1',
              'type': 'LubanPage',
              'children': [
                {'id': 'h1', 'type': 'LubanHeading', 'props': {'content': '欢迎', 'level': 1}},
              ],
            },
          },
        });
      });

      final result = await resolver.resolve('promo2026');
      expect(result.siteSlug, 'acme');
      expect(result.pagePath, '/home');
      expect(result.payload.name, '首页');
      expect(result.payload.schema.root.children!.first.propString('content'), '欢迎');
    });
  });

  group('HttpDeeplinkResolver.resolve - 短链失败态', () {
    test('404 → ResolveError.notFound', () async {
      adapter.onGet('$backend/public/short/nonexist', (server) {
        server.reply(404, {'code': 'SHORT_LINK_NOT_FOUND'});
      });
      await expectLater(
        resolver.resolve('nonexist'),
        throwsA(predicate((e) =>
            e is ResolveException && e.type == ResolveError.notFound)),
      );
    });

    test('410 → ResolveError.inactive', () async {
      adapter.onGet('$backend/public/short/dead', (server) {
        server.reply(410, {'code': 'SHORT_LINK_INACTIVE'});
      });
      await expectLater(
        resolver.resolve('dead'),
        throwsA(predicate((e) =>
            e is ResolveException && e.type == ResolveError.inactive)),
      );
    });

    test('500 → ResolveError.unknown', () async {
      adapter.onGet('$backend/public/short/boom', (server) {
        server.reply(500, {});
      });
      await expectLater(
        resolver.resolve('boom'),
        throwsA(predicate((e) =>
            e is ResolveException && e.type == ResolveError.unknown)),
      );
    });
  });
}
