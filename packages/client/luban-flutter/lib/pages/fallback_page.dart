// lib/pages/fallback_page.dart
//
// 兜底页（app-deeplink-backend-arch plan T21）。
// Q5=A 硬约束：直接打开 App（无深链参数）时展示，禁止任何站点 API 调用、
// 不展示站点列表/选择器。纯静态品牌引导页。

import 'package:flutter/material.dart';

class FallbackPage extends StatelessWidget {
  const FallbackPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              // 品牌 Logo（占位：用 Material icon，生产替换为品牌资源）
              Icon(
                Icons.widgets_outlined,
                size: 72,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: 24),
              Text(
                'Luban 低代码',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '请通过分享链接打开指定页面',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              TextButton(
                onPressed: () {
                  // 占位：可跳转外部网站或帮助页；本期不实现外部跳转逻辑
                  // （plan §10：运营 UI/帮助页延后）
                },
                child: const Text('了解详情'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
