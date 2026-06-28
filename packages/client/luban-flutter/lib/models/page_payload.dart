// lib/models/page_payload.dart
//
// PublicPagePayload（app-deeplink-backend-arch plan T20）。
// BFF GET /api/public/sites/:slug/pages/by-path?path= 响应体。
// 来源：packages/web/luban-website/types/page.ts

import 'page_schema.dart';

class PublicPagePayload {
  final String id;
  final String siteId;
  final String name;
  final String path;
  final String status;
  final PageSchema schema;
  final PageSeo? seo;
  final String? createdAt;
  final String? updatedAt;

  const PublicPagePayload({
    required this.id,
    required this.siteId,
    required this.name,
    required this.path,
    required this.status,
    required this.schema,
    this.seo,
    this.createdAt,
    this.updatedAt,
  });

  factory PublicPagePayload.fromJson(Map<String, dynamic> json) {
    // 脏数据防御：schema 缺失/非 Map 时构造空 root，不抛 TypeError（避免 UI 红屏）
    final schemaRaw = json['schema'];
    final Map<String, dynamic> schemaJson = schemaRaw is Map<String, dynamic>
        ? schemaRaw
        : const {'root': <String, dynamic>{}};
    // seo 可能在 schema.seo 或顶层 seo（website 两种位置都兼容）
    final PageSeo? seo = _parseSeo(schemaJson['seo']) ?? _parseSeo(json['seo']);
    return PublicPagePayload(
      id: json['id'] as String? ?? '',
      siteId: json['siteId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      path: json['path'] as String? ?? '',
      status: json['status'] as String? ?? '',
      schema: PageSchema.fromJson(schemaJson),
      seo: seo,
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  /// 脏数据防御：seo 非 Map 时返回 null
  static PageSeo? _parseSeo(Object? raw) =>
      raw is Map<String, dynamic> ? PageSeo.fromJson(raw) : null;
}
