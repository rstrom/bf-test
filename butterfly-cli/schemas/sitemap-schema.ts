import { Schema } from "effect";

/**
 * Effect Schema definitions for Butterfly sitemap validation.
 * These schemas provide runtime validation and type safety for sitemap configurations.
 */

// Base action types
export const SitemapActionType = Schema.Literal("read", "generate", "transform");

// Read action schema
export const ReadActionSchema = Schema.Struct({
  type: Schema.Literal("read"),
  src: Schema.String.pipe(Schema.minLength(1, { message: () => "src attribute cannot be empty" })),
  rangeSupport: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    identifier: "ReadAction",
    title: "Read Action",
    description: "Action to serve a static asset with optional range support",
  }),
);

// Generate action schema
export const GenerateActionSchema = Schema.Struct({
  type: Schema.Literal("generate"),
  generator: Schema.String.pipe(Schema.minLength(1, { message: () => "generator attribute cannot be empty" })),
}).pipe(
  Schema.annotations({
    identifier: "GenerateAction",
    title: "Generate Action",
    description: "Action to dynamically generate content using a specified generator",
  }),
);

// Transform action schema
export const TransformActionSchema = Schema.Struct({
  type: Schema.Literal("transform"),
  src: Schema.String.pipe(Schema.minLength(1, { message: () => "src attribute cannot be empty" })),
  transformer: Schema.String.pipe(Schema.minLength(1, { message: () => "transformer attribute cannot be empty" })),
}).pipe(
  Schema.annotations({
    identifier: "TransformAction",
    title: "Transform Action",
    description: "Action to transform content from a source asset through a specified transformer",
  }),
);

// Union of all action types
export const SitemapActionSchema = Schema.Union(ReadActionSchema, GenerateActionSchema, TransformActionSchema).pipe(
  Schema.annotations({
    identifier: "SitemapAction",
    title: "Sitemap Action",
    description: "Action to take when a pattern matches a request",
  }),
);

// Pattern validation - basic glob pattern support
const PatternSchema = Schema.String.pipe(
  Schema.annotations({
    title: "Pattern",
    description: "Glob-style pattern to match against request paths. Supports **, *, and capture groups",
  }),
);

// Sitemap match schema
export const SitemapMatchSchema = Schema.Struct({
  pattern: PatternSchema,
  action: SitemapActionSchema,
}).pipe(
  Schema.annotations({
    identifier: "SitemapMatch",
    title: "Sitemap Match",
    description: "Pattern and action pair for request routing",
  }),
);

// Sitemap pipeline schema
export const SitemapPipelineSchema = Schema.Struct({
  matches: Schema.Array(SitemapMatchSchema).pipe(
    Schema.annotations({
      description: "Array of pattern matches processed in order",
    }),
  ),
}).pipe(
  Schema.annotations({
    identifier: "SitemapPipeline",
    title: "Sitemap Pipeline",
    description: "Container for a sequence of pattern matches",
  }),
);

// Root sitemap schema
export const SitemapSchema = Schema.Struct({
  pipelines: Schema.Array(SitemapPipelineSchema).pipe(
    Schema.minItems(1, { message: () => "At least one pipeline is required" }),
    Schema.annotations({
      description: "Array of pipelines containing routing rules",
    }),
  ),
}).pipe(
  Schema.annotations({
    identifier: "Sitemap",
    title: "Butterfly Sitemap",
    description: "Root sitemap configuration for request routing",
  }),
);

// Route match result schema
export const RouteMatchSchema = Schema.Struct({
  matched: Schema.Boolean,
  assetPath: Schema.optional(Schema.String),
  action: Schema.optional(SitemapActionSchema),
}).pipe(
  Schema.annotations({
    identifier: "RouteMatch",
    title: "Route Match Result",
    description: "Result of matching a request against sitemap patterns",
  }),
);

// Export inferred types
export type SitemapActionType = Schema.Schema.Type<typeof SitemapActionType>;
export type ReadAction = Schema.Schema.Type<typeof ReadActionSchema>;
export type GenerateAction = Schema.Schema.Type<typeof GenerateActionSchema>;
export type TransformAction = Schema.Schema.Type<typeof TransformActionSchema>;
export type SitemapAction = Schema.Schema.Type<typeof SitemapActionSchema>;
export type SitemapMatch = Schema.Schema.Type<typeof SitemapMatchSchema>;
export type SitemapPipeline = Schema.Schema.Type<typeof SitemapPipelineSchema>;
export type Sitemap = Schema.Schema.Type<typeof SitemapSchema>;
export type RouteMatch = Schema.Schema.Type<typeof RouteMatchSchema>;

// Schemas are already exported above with their definitions
