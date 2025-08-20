// Import schema-derived types for internal validation
import type * as SchemaTypes from "../schemas/sitemap-schema";

// Export schema-derived types as the primary interfaces
export type SitemapAction = SchemaTypes.SitemapAction;
export type SitemapMatch = SchemaTypes.SitemapMatch;
export type SitemapPipeline = SchemaTypes.SitemapPipeline;
export type Sitemap = SchemaTypes.Sitemap;
export type RouteMatch = SchemaTypes.RouteMatch;

// Export individual action types
export type ReadAction = SchemaTypes.ReadAction;
export type GenerateAction = SchemaTypes.GenerateAction;
export type TransformAction = SchemaTypes.TransformAction;
