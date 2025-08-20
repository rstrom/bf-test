import {
  AssetLoader,
  SitemapRouter
} from "./chunk-NC3Z5WYN.mjs";

// src/parsers/sitemap-parser.ts
import { XMLParser } from "fast-xml-parser";
import { Effect, Schema as Schema2, Data } from "effect";

// src/schemas/sitemap-schema.ts
import { Schema } from "effect";
var SitemapActionType = Schema.Literal("read", "generate", "transform");
var ReadActionSchema = Schema.Struct({
  type: Schema.Literal("read"),
  src: Schema.String.pipe(Schema.minLength(1, { message: () => "src attribute cannot be empty" })),
  rangeSupport: Schema.optional(Schema.Boolean)
}).pipe(
  Schema.annotations({
    identifier: "ReadAction",
    title: "Read Action",
    description: "Action to serve a static asset with optional range support"
  })
);
var GenerateActionSchema = Schema.Struct({
  type: Schema.Literal("generate"),
  generator: Schema.String.pipe(Schema.minLength(1, { message: () => "generator attribute cannot be empty" }))
}).pipe(
  Schema.annotations({
    identifier: "GenerateAction",
    title: "Generate Action",
    description: "Action to dynamically generate content using a specified generator"
  })
);
var TransformActionSchema = Schema.Struct({
  type: Schema.Literal("transform"),
  src: Schema.String.pipe(Schema.minLength(1, { message: () => "src attribute cannot be empty" })),
  transformer: Schema.String.pipe(Schema.minLength(1, { message: () => "transformer attribute cannot be empty" }))
}).pipe(
  Schema.annotations({
    identifier: "TransformAction",
    title: "Transform Action",
    description: "Action to transform content from a source asset through a specified transformer"
  })
);
var SitemapActionSchema = Schema.Union(ReadActionSchema, GenerateActionSchema, TransformActionSchema).pipe(
  Schema.annotations({
    identifier: "SitemapAction",
    title: "Sitemap Action",
    description: "Action to take when a pattern matches a request"
  })
);
var PatternSchema = Schema.String.pipe(
  Schema.annotations({
    title: "Pattern",
    description: "Glob-style pattern to match against request paths. Supports **, *, and capture groups"
  })
);
var SitemapMatchSchema = Schema.Struct({
  pattern: PatternSchema,
  action: SitemapActionSchema
}).pipe(
  Schema.annotations({
    identifier: "SitemapMatch",
    title: "Sitemap Match",
    description: "Pattern and action pair for request routing"
  })
);
var SitemapPipelineSchema = Schema.Struct({
  matches: Schema.Array(SitemapMatchSchema).pipe(
    Schema.annotations({
      description: "Array of pattern matches processed in order"
    })
  )
}).pipe(
  Schema.annotations({
    identifier: "SitemapPipeline",
    title: "Sitemap Pipeline",
    description: "Container for a sequence of pattern matches"
  })
);
var SitemapSchema = Schema.Struct({
  pipelines: Schema.Array(SitemapPipelineSchema).pipe(
    Schema.minItems(1, { message: () => "At least one pipeline is required" }),
    Schema.annotations({
      description: "Array of pipelines containing routing rules"
    })
  )
}).pipe(
  Schema.annotations({
    identifier: "Sitemap",
    title: "Butterfly Sitemap",
    description: "Root sitemap configuration for request routing"
  })
);
var RouteMatchSchema = Schema.Struct({
  matched: Schema.Boolean,
  assetPath: Schema.optional(Schema.String),
  action: Schema.optional(SitemapActionSchema)
}).pipe(
  Schema.annotations({
    identifier: "RouteMatch",
    title: "Route Match Result",
    description: "Result of matching a request against sitemap patterns"
  })
);

// src/parsers/sitemap-parser.ts
var SitemapXmlParseError = class extends Data.TaggedError("SitemapXmlParseError") {
};
var SitemapValidationError = class extends Data.TaggedError("SitemapValidationError") {
};
var SitemapStructureError = class extends Data.TaggedError("SitemapStructureError") {
};
var SitemapParser = class _SitemapParser {
  static parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text"
  });
  static parse = Effect.fn("SitemapParser/parse")(
    (xmlContent) => Effect.gen(function* () {
      const rawSitemap = yield* Effect.try({
        try: () => {
          const parsed = _SitemapParser.parser.parse(xmlContent);
          if (!parsed["map:sitemap"]) {
            throw new SitemapStructureError({
              message: "Root element 'map:sitemap' not found",
              missingElement: "map:sitemap"
            });
          }
          const sitemapElement = parsed["map:sitemap"];
          const pipelinesElement = sitemapElement["map:pipelines"];
          if (!pipelinesElement) {
            throw new SitemapStructureError({
              message: "'map:pipelines' element not found",
              missingElement: "map:pipelines"
            });
          }
          const pipelineElements = Array.isArray(pipelinesElement["map:pipeline"]) ? pipelinesElement["map:pipeline"] : [pipelinesElement["map:pipeline"]];
          const pipelines = pipelineElements.map(_SitemapParser.parsePipeline);
          return { pipelines };
        },
        catch: (error) => {
          if (error instanceof SitemapStructureError) {
            return error;
          }
          return new SitemapXmlParseError({
            message: `Failed to parse sitemap XML: ${error instanceof Error ? error.message : String(error)}`,
            cause: error instanceof Error ? error : void 0
          });
        }
      });
      const validatedSitemap = yield* Schema2.decodeUnknown(SitemapSchema)(rawSitemap).pipe(
        Effect.catchAll(
          (error) => Effect.fail(
            new SitemapValidationError({
              message: `Sitemap validation failed: ${error.message}`,
              cause: error instanceof Error ? error : void 0
            })
          )
        )
      );
      return validatedSitemap;
    })
  );
  static parsePipeline(pipelineElement) {
    if (!pipelineElement["map:match"]) {
      return { matches: [] };
    }
    const matchElements = Array.isArray(pipelineElement["map:match"]) ? pipelineElement["map:match"] : [pipelineElement["map:match"]];
    const matches = matchElements.map(_SitemapParser.parseMatch);
    return { matches };
  }
  static parseMatch(matchElement) {
    const pattern = matchElement["@_pattern"] || "";
    let action;
    if (matchElement["map:read"]) {
      const readElement = matchElement["map:read"];
      action = {
        type: "read",
        src: readElement["@_src"],
        rangeSupport: readElement["@_rangeSupport"] === "true"
      };
    } else if (matchElement["map:generate"]) {
      action = {
        type: "generate",
        generator: matchElement["map:generate"]["@_generator"]
      };
    } else if (matchElement["map:transform"]) {
      action = {
        type: "transform",
        transformer: matchElement["map:transform"]["@_transformer"],
        src: matchElement["map:transform"]["@_src"]
      };
    } else {
      action = {
        type: "read",
        src: pattern,
        rangeSupport: false
      };
    }
    return { pattern, action };
  }
  /**
   * Generate default sitemap that matches current AssetName behavior
   */
  static generateDefaultSitemap() {
    return {
      pipelines: [
        {
          matches: [
            // Root index handling
            {
              pattern: "",
              action: { type: "read", src: "index.html" }
            },
            // Directory index handling
            {
              pattern: "**/",
              action: { type: "read", src: "{1}/index.html" }
            },
            // Video files with range support (must come before general file handling)
            {
              pattern: "**.mp4",
              action: { type: "read", src: "{0}", rangeSupport: true }
            },
            {
              pattern: "**.webm",
              action: { type: "read", src: "{0}", rangeSupport: true }
            },
            {
              pattern: "**.mov",
              action: { type: "read", src: "{0}", rangeSupport: true }
            },
            {
              pattern: "**.avi",
              action: { type: "read", src: "{0}", rangeSupport: true }
            },
            {
              pattern: "**.mkv",
              action: { type: "read", src: "{0}", rangeSupport: true }
            },
            // Explicit file handling (must come before ** to avoid conflicts)
            {
              pattern: "**.*",
              action: { type: "read", src: "{0}" }
            },
            // HTML extension handling
            {
              pattern: "**",
              action: { type: "read", src: "{1}.html" }
            }
          ]
        }
      ]
    };
  }
};

// src/handlers/butterfly-handler.ts
import { Effect as Effect2, Option, Either } from "effect";
var ButterflyHandler = class {
  static process = Effect2.fn("ButterflyHandler/process")(
    (pathname) => Effect2.gen(function* () {
      const assetLoader = yield* AssetLoader;
      const maybeSitemapXml = yield* assetLoader.loadAsset(".moneta/sitemap.xml").pipe(
        Effect2.map(Option.some),
        Effect2.catchTags({
          AssetNotFoundError: () => Effect2.succeed(Option.none())
        })
      );
      const sitemapResult = yield* Option.match(maybeSitemapXml, {
        onNone: () => Effect2.succeed({
          sitemap: SitemapParser.generateDefaultSitemap(),
          validation: void 0
        }),
        onSome: (sitemapXml) => SitemapParser.parse(sitemapXml).pipe(
          Effect2.either,
          Effect2.flatMap(
            (either) => Either.match(either, {
              onLeft: (error) => Effect2.gen(function* () {
                yield* Effect2.logWarning("Sitemap parsing failed, falling back to default", error.message);
                return {
                  sitemap: SitemapParser.generateDefaultSitemap(),
                  validation: { success: false, errors: [error.message] }
                };
              }),
              onRight: (sitemap2) => Effect2.succeed({
                sitemap: sitemap2,
                validation: { success: true }
              })
            })
          )
        )
      });
      const { sitemap, validation: sitemapValidation } = sitemapResult;
      const routeMatch = yield* SitemapRouter.matchRequest(pathname, sitemap);
      if (!routeMatch.matched) {
        return {
          matched: false,
          fallbackToDefault: true,
          sitemapValidation
        };
      }
      return {
        matched: true,
        assetPath: routeMatch.assetPath,
        rangeSupport: routeMatch.action?.type === "read" ? routeMatch.action.rangeSupport : false,
        fallbackToDefault: false,
        sitemapValidation
      };
    })
  );
};

export {
  SitemapXmlParseError,
  SitemapValidationError,
  SitemapStructureError,
  SitemapParser,
  ButterflyHandler
};
//# sourceMappingURL=chunk-N4ETZ65I.mjs.map