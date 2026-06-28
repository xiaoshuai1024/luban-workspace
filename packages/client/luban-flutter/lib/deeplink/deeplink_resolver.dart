// lib/deeplink/deeplink_resolver.dart
//
// 深链解析服务（app-deeplink-backend-arch plan T20，决策 1=A 直调后端 JSON）。
// shortCode → GET /public/short/:code 取 {siteSlug,pagePath} → 再调 page by-path 拉 schema。

import 'package:dio/dio.dart';
import '../models/page_payload.dart';

/// 解析失败类型（供 UI 区分错误文案）
enum ResolveError { notFound, inactive, network, unknown }

class ResolveException implements Exception {
  final ResolveError type;
  final String message;
  const ResolveException(this.type, [this.message = '']);
  @override
  String toString() => 'ResolveException($type): $message';
}

/// 解析结果（plan T20 ResolvedPage）
class ResolvedPage {
  final String siteSlug;
  final String pagePath;
  final PublicPagePayload payload;

  const ResolvedPage({
    required this.siteSlug,
    required this.pagePath,
    required this.payload,
  });
}

/// 深链解析抽象（便于单测 mock）
abstract class DeeplinkResolver {
  /// shortCode → 解析为可渲染的页面数据。
  /// 失败分支：404(notFound)/410(inactive)/网络错 抛 ResolveException。
  Future<ResolvedPage> resolve(String shortCode);
}

/// 默认实现：直调后端 /public/short/:code（plan 决策 1=A），再调 BFF by-path。
class HttpDeeplinkResolver implements DeeplinkResolver {
  final Dio _dio;
  final String _backendBaseUrl;
  final String _bffBaseUrl;

  HttpDeeplinkResolver({
    required Dio dio,
    required String backendBaseUrl,
    required String bffBaseUrl,
  })  : _dio = dio,
        _backendBaseUrl = backendBaseUrl,
        _bffBaseUrl = bffBaseUrl;

  @override
  Future<ResolvedPage> resolve(String shortCode) async {
    // Step 1: 短链解析（直调后端公开 JSON 端点）
    late final String siteSlug;
    late final String pagePath;
    try {
      final resp = await _dio.get('$_backendBaseUrl/public/short/$shortCode');
      final data = resp.data as Map<String, dynamic>;
      siteSlug = data['siteSlug'] as String;
      pagePath = data['pagePath'] as String;
    } on DioException catch (e) {
      throw _mapDioError(e);
    }

    // Step 2: 拉目标页面 schema（BFF by-path）
    try {
      final resp = await _dio.get(
        '$_bffBaseUrl/api/public/sites/$siteSlug/pages/by-path',
        queryParameters: {'path': pagePath},
      );
      final payload = PublicPagePayload.fromJson(resp.data as Map<String, dynamic>);
      return ResolvedPage(siteSlug: siteSlug, pagePath: pagePath, payload: payload);
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
  }

  ResolveException _mapDioError(DioException e) {
    final status = e.response?.statusCode;
    if (status == 404) return const ResolveException(ResolveError.notFound, '短链不存在');
    if (status == 410) return const ResolveException(ResolveError.inactive, '短链已停用');
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.receiveTimeout) {
      return const ResolveException(ResolveError.network, '网络连接失败');
    }
    return const ResolveException(ResolveError.unknown, '解析失败');
  }
}
