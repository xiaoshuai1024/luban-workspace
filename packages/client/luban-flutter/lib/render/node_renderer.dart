// lib/render/node_renderer.dart
//
// 节点渲染器（app-deeplink-backend-arch plan T22）。
// 消费 PageSchema/NodeSchema，真实渲染 LubanHeading/LubanText 节点；
// 未知类型诚实降级为"该组件类型待支持"占位卡片（非冒充已接入）。
//
// 字段来源（subagent 调研修正）：
// - LubanHeading props: { level: 1-6, content: string }
// - LubanText props: { content, tag, variant, secondary }
// 注意字段名是 content（不是 text）。

import 'package:flutter/material.dart';
import '../models/page_schema.dart';

/// 单节点 → Widget。
/// type=LubanHeading/LubanText 实渲染；其余 → 占位卡片（诚实降级）。
class NodeRenderer extends StatelessWidget {
  final NodeSchema node;

  const NodeRenderer({super.key, required this.node});

  @override
  Widget build(BuildContext context) {
    switch (node.type) {
      case 'LubanHeading':
        return _renderHeading(context);
      case 'LubanText':
        return _renderText(context);
      default:
        return _UnsupportedTypeCard(type: node.type);
    }
  }

  Widget _renderHeading(BuildContext context) {
    final content = node.propString('content') ?? '';
    final level = (node.propInt('level') ?? 2).clamp(1, 6);
    // H1=32 / H2=26 / H3=22 / H4=18 / H5=16 / H6=14（对齐 luban-ui heading 字号）
    const sizes = [32.0, 26.0, 22.0, 18.0, 16.0, 14.0];
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        content,
        style: TextStyle(
          fontSize: sizes[level - 1],
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _renderText(BuildContext context) {
    final theme = Theme.of(context);
    // LubanText default slot：有 children 则渲染 children，否则回退 content
    if (node.children != null && node.children!.isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: node.children!
              .map((c) => NodeRenderer(key: ValueKey(c.id), node: c))
              .toList(),
        ),
      );
    }
    final content = node.propString('content') ?? '';
    final secondary = node.propBool('secondary') ?? false;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(
        content,
        style: TextStyle(
          fontSize: 14,
          color: secondary ? theme.colorScheme.onSurfaceVariant : null,
        ),
      ),
    );
  }
}

/// 未知物料类型的诚实降级占位（非冒充已接入）。
/// 显示"该组件类型（Xxx）待支持，完整物料渲染在后续版本"。
class _UnsupportedTypeCard extends StatelessWidget {
  final String type;
  const _UnsupportedTypeCard({required this.type});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: theme.colorScheme.outlineVariant,
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.extension_outlined,
            size: 18,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '该组件类型（$type）待支持',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
