// lib/main.dart
//
// App 入口（app-deeplink-backend-arch plan T18）。
//
// 审查修复（luban-review R2）：
// - Dio 加 BaseOptions 超时（connect 8s / receive 10s），防弱网无限等待
// - 深链订阅为 App 进程级：app_links 的 uriLinkStream 绑定平台 channel，
//   App 进程存活期间有效，进程销毁时随 Flutter 引擎一起释放，无需手动 cancel。
//   （R2 审查 B1：detached 生命周期回调在实际设备上不可靠，observer 是空转死代码，已移除）

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
  // Dio 配置超时（审查修复：裸 Dio 弱网无限等待 → 卡死加载态）
  final dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 8),
    receiveTimeout: const Duration(seconds: 10),
  ));

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

  // 深链监听：App 进程级订阅，随引擎释放（审查 R2 B1：无需手动 cancel）
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
