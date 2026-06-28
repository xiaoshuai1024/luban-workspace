// lib/pages/text_renderer_page.dart
//
// 文本渲染页（app-deeplink-backend-arch plan T22）。
// 消费 PublicPagePayload，渲染 PageSchema 的 Heading/Text 子集；
// 完整 61 物料渲染器延后独立 plan（plan §10）。
// 四态：加载 / 空 / 错（重试） / 成功。

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../models/page_payload.dart';
import '../render/node_renderer.dart';
import '../deeplink/deeplink_resolver.dart';

class TextRendererPage extends StatefulWidget {
  final Future<ResolvedPage> Function() loader;
  final String? channelCode; // debug build 底部调试条（归因展示）

  const TextRendererPage({super.key, required this.loader, this.channelCode});

  @override
  State<TextRendererPage> createState() => _TextRendererPageState();
}

class _TextRendererPageState extends State<TextRendererPage> {
  late Future<ResolvedPage> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.loader();
  }

  void _retry() {
    setState(() {
      _future = widget.loader();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Luban'),
      ),
      body: FutureBuilder<ResolvedPage>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            // 类型安全：非 ResolveException 的异常（CastError/TypeError 等）归为 unknown，不红屏
            final err = snapshot.error;
            final resolveException = err is ResolveException
                ? err
                : const ResolveException(ResolveError.unknown, '加载失败');
            return _ErrorView(error: resolveException, onRetry: _retry);
          }
          final payload = snapshot.data!.payload;
          if (payload.schema.root.children == null ||
              payload.schema.root.children!.isEmpty) {
            return _EmptyView(pageName: payload.name);
          }
          return _SuccessView(payload: payload, channelCode: widget.channelCode);
        },
      ),
    );
  }
}

class _SuccessView extends StatelessWidget {
  final PublicPagePayload payload;
  final String? channelCode;
  const _SuccessView({required this.payload, this.channelCode});

  @override
  Widget build(BuildContext context) {
    final children = payload.schema.root.children ?? const [];
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: children.length,
            itemBuilder: (context, i) =>
                NodeRenderer(key: ValueKey(children[i].id), node: children[i]),
          ),
        ),
        // debug 调试条：渠道归因（仅展示，不影响发布版可去掉）
        if (kDebugMode && channelCode != null)
          Container(
            width: double.infinity,
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Text(
              '渠道归因: channel=$channelCode',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
      ],
    );
  }
}

class _EmptyView extends StatelessWidget {
  final String pageName;
  const _EmptyView({required this.pageName});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          '页面"$pageName"暂无可显示的文本内容',
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final ResolveException error;
  final VoidCallback onRetry;
  const _ErrorView({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    String message;
    switch (error.type) {
      case ResolveError.notFound:
        message = '链接不存在，请确认链接是否正确';
        break;
      case ResolveError.inactive:
        message = '链接已失效';
        break;
      case ResolveError.network:
        message = '网络连接失败，请检查网络后重试';
        break;
      case ResolveError.unknown:
        message = '加载失败，请稍后重试';
        break;
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(
              message,
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            // 网络错/未知错提供重试；notFound/inactive 是终态不重试
            if (error.type == ResolveError.network ||
                error.type == ResolveError.unknown)
              FilledButton(onPressed: onRetry, child: const Text('重试')),
          ],
        ),
      ),
    );
  }
}
