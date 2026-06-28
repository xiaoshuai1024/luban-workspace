// lib/app.dart
//
// 应用根 Widget（app-deeplink-backend-arch plan T18）。
// 绑定 go_router 路由 + Material 主题。

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class LubanApp extends StatelessWidget {
  final GoRouter router;
  const LubanApp({super.key, required this.router});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Luban',
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF2ECC71), // 占位品牌色（plan §6 待 UI_SPEC 回填）
        useMaterial3: true,
      ),
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
