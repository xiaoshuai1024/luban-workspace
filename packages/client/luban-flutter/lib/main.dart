// lib/main.dart
//
// App 入口（app-deeplink-backend-arch plan T18）。
// 初始化 DI（env/handler/resolver）→ 绑定深链监听 → runApp。
//
// 深链处理流程：
// 1. AppLinksDeeplinkHandler 监听 initialLink/links
// 2. 收到 shortCode → go_router push 到 /page/:code
// 3. 无 incoming link → 保持兜底页（/）

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'app.dart';
import 'config/env.dart';
import 'router/app_router.dart';
import 'deeplink/deeplink_handler.dart';
import 'deeplink/deeplink_resolver.dart';

void main() {
  final env = Env.fromEnvironment();
  final dio = Dio();

  // 后端基地址（直调 /public/short/:code）：复用 BFF 的 backend host
  // 决策 1=A：App 直调后端 JSON 端点，不经过 BFF 302
  final backendBaseUrl = const String.fromEnvironment(
    'BACKEND_BASE_URL',
    defaultValue: 'http://127.0.0.1:8080/backend',
  );

  final resolver = HttpDeeplinkResolver(
    dio: dio,
    backendBaseUrl: backendBaseUrl,
    bffBaseUrl: env.bffBaseUrl,
  );
  final router = buildAppRouter(env: env, deeplinkResolver: resolver);

  final handler = AppLinksDeeplinkHandler(
    universalLinkDomain: env.universalLinkDomain,
    urlScheme: env.urlScheme,
  );

  runApp(LubanApp(router: router));

  // 监听深链：initialLink + 运行态 links
  if (env.deeplinkEnabled) {
    handler.initialLink.listen((payload) => _handleDeeplink(router, payload));
    handler.links.listen((payload) => _handleDeeplink(router, payload));
  }
}

void _handleDeeplink(GoRouter router, DeeplinkPayload? payload) {
  if (payload?.shortCode != null) {
    router.push('/page/${payload!.shortCode}');
  }
}
