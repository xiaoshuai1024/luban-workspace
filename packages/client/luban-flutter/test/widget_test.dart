// 真实单元测试（app-deeplink-backend-arch plan T22 验证）。
// flutter create 生成的 MyApp 测试已随样板删除，改为测我们自己的组件。

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:luban_flutter/pages/fallback_page.dart';
import 'package:luban_flutter/render/node_renderer.dart';
import 'package:luban_flutter/models/page_schema.dart';

void main() {
  group('FallbackPage', () {
    testWidgets('renders brand + guidance without site API calls', (tester) async {
      // Q5=A 硬约束：兜底页是纯静态，不应触发任何网络/站点 API 调用。
      // 此测试验证它能正常渲染（若有平台 channel 调用会 fail）。
      await tester.pumpWidget(const MaterialApp(home: FallbackPage()));
      expect(find.text('Luban 低代码'), findsOneWidget);
      expect(find.text('请通过分享链接打开指定页面'), findsOneWidget);
    });
  });

  group('NodeRenderer', () {
    testWidgets('renders LubanHeading with content + level', (tester) async {
      final node = NodeSchema(
        id: 'h1',
        type: 'LubanHeading',
        props: const {'level': 1, 'content': '欢迎'},
      );
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: NodeRenderer(node: node)),
      ));
      expect(find.text('欢迎'), findsOneWidget);
    });

    testWidgets('renders LubanText content', (tester) async {
      final node = NodeSchema(
        id: 't1',
        type: 'LubanText',
        props: const {'content': '正文段落'},
      );
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: NodeRenderer(node: node)),
      ));
      expect(find.text('正文段落'), findsOneWidget);
    });

    testWidgets('unknown type renders honest placeholder, not real content', (tester) async {
      // 铁律：未知类型诚实降级，不冒充已接入
      final node = NodeSchema(
        id: 'b1',
        type: 'LubanButton',
        props: const {'label': '不应该显示'},
      );
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: NodeRenderer(node: node)),
      ));
      expect(find.textContaining('待支持'), findsOneWidget);
      expect(find.text('不应该显示'), findsNothing);
    });

    testWidgets('LubanText with children renders children over content', (tester) async {
      final node = NodeSchema(
        id: 't2',
        type: 'LubanText',
        props: const {'content': 'fallback'},
        children: const [
          NodeSchema(id: 'c1', type: 'LubanText', props: {'content': '嵌套'}),
        ],
      );
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: NodeRenderer(node: node)),
      ));
      expect(find.text('嵌套'), findsOneWidget);
      expect(find.text('fallback'), findsNothing);
    });
  });
}
