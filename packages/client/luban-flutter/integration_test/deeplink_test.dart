// integration_test/deeplink_test.dart
//
// 端到端测试框架（app-deeplink-backend-arch plan Group D E2E）。
// 跑在真机/模拟器：`flutter test integration_test/`
//
// 覆盖 plan §7.3 场景 5（兜底页）+ 场景 4（深链命中）的 widget 级模拟。
// 完整 Universal Link 唤起需真机，此处用路由直接 push 模拟。

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:go_router/go_router.dart';

import 'package:luban_flutter/app.dart';
import 'package:luban_flutter/deeplink/deeplink_resolver.dart';
import 'package:luban_flutter/pages/fallback_page.dart';
import 'package:luban_flutter/pages/text_renderer_page.dart';
import 'package:luban_flutter/models/page_payload.dart';
import 'package:luban_flutter/models/page_schema.dart';

/// 测试用 resolver：固定返回成功 payload，不调真实后端
class _StubResolver implements DeeplinkResolver {
  @override
  Future<ResolvedPage> resolve(String shortCode) async {
    return ResolvedPage(
      siteSlug: 'acme',
      pagePath: '/home',
      payload: PublicPagePayload(
        id: 'p1',
        siteId: 's1',
        name: '首页',
        path: '/home',
        status: 'published',
        schema: PageSchema(
          root: NodeSchema(
            id: 'root',
            type: 'LubanPage',
            children: const [
              NodeSchema(id: 'h1', type: 'LubanHeading', props: {'content': 'E2E 标题', 'level': 1}),
              NodeSchema(id: 't1', type: 'LubanText', props: {'content': 'E2E 正文'}),
            ],
          ),
        ),
      ),
    );
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late GoRouter router;

  setUp(() {
    router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const FallbackPage(),
        ),
        GoRoute(
          path: '/page/:code',
          builder: (_, state) {
            final code = state.pathParameters['code']!;
            return TextRendererPage(
              loader: () => _StubResolver().resolve(code),
              channelCode: code,
            );
          },
        ),
      ],
    );
  });

  group('E2E: 兜底页（plan §7.3 场景 5）', () {
    testWidgets('App 直接打开 → FallbackPage，无站点 API', (tester) async {
      await tester.pumpWidget(LubanApp(router: router));
      await tester.pumpAndSettle();

      // Q5=A 硬约束：兜底页展示品牌引导，不调站点 API
      expect(find.byType(FallbackPage), findsOneWidget);
      expect(find.text('Luban 低代码'), findsOneWidget);
      expect(find.text('请通过分享链接打开指定页面'), findsOneWidget);
    });
  });

  group('E2E: 深链命中（plan §7.3 场景 4）', () {
    testWidgets('路由 push /page/:code → TextRendererPage 渲染 schema', (tester) async {
      await tester.pumpWidget(LubanApp(router: router));
      await tester.pumpAndSettle();

      // 模拟深链命中：push 到 /page/promo
      router.push('/page/promo');
      await tester.pumpAndSettle();

      expect(find.byType(TextRendererPage), findsOneWidget);
      expect(find.text('E2E 标题'), findsOneWidget);
      expect(find.text('E2E 正文'), findsOneWidget);
      expect(find.textContaining('channel=promo'), findsOneWidget);
    });
  });

  group('E2E: 返回兜底页', () {
    testWidgets('从渲染页返回 → 回到 FallbackPage', (tester) async {
      await tester.pumpWidget(LubanApp(router: router));
      await tester.pumpAndSettle();

      router.push('/page/promo');
      await tester.pumpAndSettle();

      router.pop();
      await tester.pumpAndSettle();

      expect(find.byType(FallbackPage), findsOneWidget);
    });
  });
}
