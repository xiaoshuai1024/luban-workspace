// test/models/page_schema_test.dart
//
// PageSchema/NodeSchema 反序列化单测（app-deeplink-backend-arch 测试框架）。
// 验证从 BFF JSON → Dart 模型的字段映射，含字段名 content（非 text）。

import 'package:flutter_test/flutter_test.dart';
import 'package:luban_flutter/models/page_schema.dart';

void main() {
  group('NodeSchema.fromJson', () {
    test('minimal node with id + type', () {
      final n = NodeSchema.fromJson({'id': 'n1', 'type': 'LubanHeading'});
      expect(n.id, 'n1');
      expect(n.type, 'LubanHeading');
      expect(n.props, isNull);
      expect(n.children, isNull);
    });

    test('LubanHeading props: level + content', () {
      final n = NodeSchema.fromJson({
        'id': 'h1',
        'type': 'LubanHeading',
        'props': {'level': 1, 'content': '欢迎'},
      });
      expect(n.propInt('level'), 1);
      expect(n.propString('content'), '欢迎');
    });

    test('LubanText props: content + variant + secondary', () {
      final n = NodeSchema.fromJson({
        'id': 't1',
        'type': 'LubanText',
        'props': {
          'content': '正文',
          'variant': 'body2',
          'secondary': true,
        },
      });
      expect(n.propString('content'), '正文');
      expect(n.propString('variant'), 'body2');
      expect(n.propBool('secondary'), isTrue);
    });

    test('children recursive parse', () {
      final n = NodeSchema.fromJson({
        'id': 'root',
        'type': 'LubanContainer',
        'children': [
          {'id': 'c1', 'type': 'LubanText', 'props': {'content': '子节点'}},
          {'id': 'c2', 'type': 'LubanHeading'},
        ],
      });
      expect(n.children, hasLength(2));
      expect(n.children![0].propString('content'), '子节点');
      expect(n.children![1].type, 'LubanHeading');
    });

    test('level as string is coerced to int', () {
      final n = NodeSchema.fromJson({
        'id': 'h2',
        'type': 'LubanHeading',
        'props': {'level': '3', 'content': 'x'},
      });
      expect(n.propInt('level'), 3);
    });

    test('missing id/type defaults to empty string (no crash)', () {
      final n = NodeSchema.fromJson({});
      expect(n.id, '');
      expect(n.type, '');
    });
  });

  group('PageSchema.fromJson', () {
    test('parses root + optional seo', () {
      final s = PageSchema.fromJson({
        'root': {'id': 'r1', 'type': 'LubanPage'},
        'seo': {'title': '首页', 'noIndex': true},
      });
      expect(s.root.id, 'r1');
      expect(s.seo?.title, '首页');
      expect(s.seo?.noIndex, isTrue);
    });

    test('seo null when absent', () {
      final s = PageSchema.fromJson({
        'root': {'id': 'r1', 'type': 'LubanPage'},
      });
      expect(s.seo, isNull);
    });
  });
}
