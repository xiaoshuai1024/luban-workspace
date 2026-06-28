// lib/models/page_schema.dart
//
// PageSchema / NodeSchema Dart 模型（app-deeplink-backend-arch plan T22）。
//
// 来源：手工翻译自 packages/ui/luban-ui/packages/luban-low-code/src/lib/schema.ts
// （quicktype codegen 的等价手工版；本期 TextRenderer 仅消费 type/props/children，
//  其余字段保留为可选以保持与 TS 契约一致，供后续完整物料渲染器复用。）
//
// PublicPagePayload（BFF GET /api/public/sites/:slug/pages/by-path 响应）见 page_payload.dart。

/// 页面树节点（对应 TS NodeSchema）。
///
/// TextRenderer（T22）消费：
/// - [type]：路由渲染分支（'LubanHeading' / 'LubanText' / 其他→占位）
/// - [props]：取 content / level / tag / variant / secondary
/// - [children]：递归渲染子节点（LubanText 的 default slot）
class NodeSchema {
  final String id;
  final String type;
  final Map<String, dynamic>? props;
  final List<NodeSchema>? children;
  // 以下字段 T22 暂不消费，保留以对齐 TS 契约
  final Object? visible;
  final Object? loop;
  final Map<String, String>? events;
  final Object? datasource;
  final bool? locked;
  final bool? hidden;
  final Map<String, String>? style;
  final String? className;
  final Object? responsive;
  final Object? animation;
  final Object? cmsBinding;

  const NodeSchema({
    required this.id,
    required this.type,
    this.props,
    this.children,
    this.visible,
    this.loop,
    this.events,
    this.datasource,
    this.locked,
    this.hidden,
    this.style,
    this.className,
    this.responsive,
    this.animation,
    this.cmsBinding,
  });

  factory NodeSchema.fromJson(Map<String, dynamic> json) {
    return NodeSchema(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? '',
      props: json['props'] as Map<String, dynamic>?,
      children: (json['children'] as List<dynamic>?)
          ?.map((e) => NodeSchema.fromJson(e as Map<String, dynamic>))
          .toList(),
      visible: json['visible'],
      loop: json['loop'],
      events: (json['events'] as Map<String, dynamic>?)?.map(
        (k, v) => MapEntry(k, v.toString()),
      ),
      datasource: json['datasource'],
      locked: json['locked'] as bool?,
      hidden: json['hidden'] as bool?,
      style: (json['style'] as Map<String, dynamic>?)?.map(
        (k, v) => MapEntry(k, v.toString()),
      ),
      className: json['className'] as String?,
      responsive: json['responsive'],
      animation: json['animation'],
      cmsBinding: json['cmsBinding'],
    );
  }

  /// 取 prop 字符串值（TextRenderer 取 content 用）
  String? propString(String key) => props?[key]?.toString();

  /// 取 prop 整数值（TextRenderer 取 level 用）
  int? propInt(String key) {
    final v = props?[key];
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }

  /// 取 prop 布尔值（TextRenderer 取 secondary 用）
  bool? propBool(String key) {
    final v = props?[key];
    if (v is bool) return v;
    return null;
  }
}

/// 页面级 SEO（对应 TS PageSeo，T22 不消费，保留对齐契约）
class PageSeo {
  final String? title;
  final String? description;
  final List<String>? keywords;
  final String? ogTitle;
  final String? ogDescription;
  final String? ogImage;
  final String? canonical;
  final bool? noIndex;

  const PageSeo({
    this.title,
    this.description,
    this.keywords,
    this.ogTitle,
    this.ogDescription,
    this.ogImage,
    this.canonical,
    this.noIndex,
  });

  factory PageSeo.fromJson(Map<String, dynamic> json) => PageSeo(
        title: json['title'] as String?,
        description: json['description'] as String?,
        keywords: (json['keywords'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList(),
        ogTitle: json['ogTitle'] as String?,
        ogDescription: json['ogDescription'] as String?,
        ogImage: json['ogImage'] as String?,
        canonical: json['canonical'] as String?,
        noIndex: json['noIndex'] as bool?,
      );
}

/// 页面 schema（对应 TS PageSchema）。
class PageSchema {
  final NodeSchema root;
  final Map<String, dynamic>? formState;
  final PageSeo? seo;

  const PageSchema({required this.root, this.formState, this.seo});

  factory PageSchema.fromJson(Map<String, dynamic> json) => PageSchema(
        root: NodeSchema.fromJson(json['root'] as Map<String, dynamic>),
        formState: json['formState'] as Map<String, dynamic>?,
        seo: json['seo'] == null
            ? null
            : PageSeo.fromJson(json['seo'] as Map<String, dynamic>),
      );
}
