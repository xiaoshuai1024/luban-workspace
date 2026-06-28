// test/widgets/text_renderer_page_test.dart
//
// TextRendererPage 四态 widget test（app-deeplink-backend-arch 测试框架）。
// 覆盖加载/空/错(notFound/inactive/network)/成功。

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luban_flutter/deeplink/deeplink_resolver.dart';
import 'package:luban_flutter/models/page_payload.dart';
import 'package:luban_flutter/models/page_schema.dart';
import 'package:luban_flutter/pages/text_renderer_page.dart';

/// 构造一个立即完成的 Future（成功/失败）
Future<ResolvedPage> _successLoader() async {
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
            NodeSchema(id: 'h1', type: 'LubanHeading', props: {'content': '标题', 'level': 2}),
            NodeSchema(id: 't1', type: 'LubanText', props: {'content': '正文'}),
          ],
        ),
      ),
    ),
  );
}

Future<ResolvedPage> _emptyLoader() async {
  return ResolvedPage(
    siteSlug: 'acme',
    pagePath: '/home',
    payload: PublicPagePayload(
      id: 'p1',
      siteId: 's1',
      name: '空页',
      path: '/home',
      status: 'published',
      schema: const PageSchema(root: NodeSchema(id: 'r', type: 'LubanPage')),
    ),
  );
}

Future<ResolvedPage> _notFoundLoader() async =>
    throw const ResolveException(ResolveError.notFound, '短链不存在');
Future<ResolvedPage> _inactiveLoader() async =>
    throw const ResolveException(ResolveError.inactive, '短链已停用');
Future<ResolvedPage> _networkLoader() async =>
    throw const ResolveException(ResolveError.network, '网络失败');

void main() {
  group('TextRendererPage - 成功态', () {
    testWidgets('渲染 Heading + Text 内容 + channel 调试条', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: TextRendererPage(loader: _successLoader, channelCode: 'promo'),
      ));
      await tester.pumpAndSettle();

      expect(find.text('标题'), findsOneWidget);
      expect(find.text('正文'), findsOneWidget);
      expect(find.textContaining('channel=promo'), findsOneWidget);
    });

    testWidgets('返回按钮存在', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: TextRendererPage(loader: _successLoader),
      ));
      await tester.pumpAndSettle();
      // TextRendererPage 用 IconButton(Icons.arrow_back) 作返回（非标准 BackButton widget）
      expect(find.byIcon(Icons.arrow_back), findsOneWidget);
    });
  });

  group('TextRendererPage - 空态', () {
    testWidgets('schema.root 无 children → 空文案', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: TextRendererPage(loader: _emptyLoader),
      ));
      await tester.pumpAndSettle();
      expect(find.textContaining('暂无可显示'), findsOneWidget);
    });
  });

  group('TextRendererPage - 错态', () {
    testWidgets('notFound → "链接不存在"，无重试按钮', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: TextRendererPage(loader: _notFoundLoader),
      ));
      await tester.pumpAndSettle();
      expect(find.textContaining('链接不存在'), findsOneWidget);
      expect(find.text('重试'), findsNothing); // 终态不重试
    });

    testWidgets('inactive → "链接已失效"，无重试按钮', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: TextRendererPage(loader: _inactiveLoader),
      ));
      await tester.pumpAndSettle();
      expect(find.text('链接已失效'), findsOneWidget);
      expect(find.text('重试'), findsNothing);
    });

    testWidgets('network → 网络文案 + 重试按钮', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: TextRendererPage(loader: _networkLoader),
      ));
      await tester.pumpAndSettle();
      expect(find.textContaining('网络连接失败'), findsOneWidget);
      expect(find.text('重试'), findsOneWidget);
    });
  });

  group('TextRendererPage - 加载态', () {
    testWidgets('Future 未完成时显示 CircularProgressIndicator', (tester) async {
      // 用 Completer 让 loader 永不完成（可控，不依赖 timer）
      final completer = Completer<ResolvedPage>();
      await tester.pumpWidget(MaterialApp(
        home: TextRendererPage(loader: () => completer.future),
      ));
      await tester.pump(); // 触发 build，不 settle
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });
}
