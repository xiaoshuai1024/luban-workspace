// lib/router/app_router.dart
//
// 应用路由（app-deeplink-backend-arch plan T18）。
// 用 go_router 声明路由 + 深链 redirect 钩子。
//
// 路由：
// - /               → 兜底页（直接打开，无深链）
// - /page/:code     → 文本渲染页（深链命中 shortCode）

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../config/env.dart';
import '../pages/fallback_page.dart';
import '../pages/text_renderer_page.dart';
import '../deeplink/deeplink_resolver.dart';

/// 构建应用路由。
/// [deeplinkResolver] 用于 /page/:code 的加载器；测试可注入 mock。
GoRouter buildAppRouter({
  required Env env,
  required DeeplinkResolver deeplinkResolver,
}) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const FallbackPage(),
      ),
      GoRoute(
        path: '/page/:code',
        builder: (context, state) {
          final code = state.pathParameters['code']!;
          return TextRendererPage(
            loader: () => deeplinkResolver.resolve(code),
            channelCode: code,
          );
        },
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const Text('错误')),
      body: Center(child: Text('页面不存在: ${state.error?.message ?? "未知错误"}')),
    ),
  );
}
