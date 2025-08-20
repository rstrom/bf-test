import { XMLParser } from "fast-xml-parser";
import { Effect, Schema, Data } from "effect";
import { Sitemap, SitemapPipeline, SitemapMatch, SitemapAction } from "../entities/sitemap";
import { SitemapSchema } from "../schemas/sitemap-schema";

export class SitemapXmlParseError extends Data.TaggedError("SitemapXmlParseError")<{
  message: string;
  cause?: Error;
}> {}

export class SitemapValidationError extends Data.TaggedError("SitemapValidationError")<{
  message: string;
  cause?: Error;
}> {}

export class SitemapStructureError extends Data.TaggedError("SitemapStructureError")<{
  message: string;
  missingElement: string;
}> {}

export type SitemapParseError = SitemapXmlParseError | SitemapValidationError | SitemapStructureError;

export class SitemapParser {
  private static parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  static parse = Effect.fn("SitemapParser/parse")((xmlContent: string) =>
    Effect.gen(function* () {
      // Parse XML content
      const rawSitemap = yield* Effect.try({
        try: () => {
          const parsed = SitemapParser.parser.parse(xmlContent);

          if (!parsed["map:sitemap"]) {
            throw new SitemapStructureError({
              message: "Root element 'map:sitemap' not found",
              missingElement: "map:sitemap",
            });
          }

          const sitemapElement = parsed["map:sitemap"];
          const pipelinesElement = sitemapElement["map:pipelines"];

          if (!pipelinesElement) {
            throw new SitemapStructureError({
              message: "'map:pipelines' element not found",
              missingElement: "map:pipelines",
            });
          }

          // Handle single pipeline or array of pipelines
          const pipelineElements = Array.isArray(pipelinesElement["map:pipeline"])
            ? pipelinesElement["map:pipeline"]
            : [pipelinesElement["map:pipeline"]];

          const pipelines: SitemapPipeline[] = pipelineElements.map(SitemapParser.parsePipeline);

          return { pipelines };
        },
        catch: (error) => {
          if (error instanceof SitemapStructureError) {
            return error;
          }
          return new SitemapXmlParseError({
            message: `Failed to parse sitemap XML: ${error instanceof Error ? error.message : String(error)}`,
            cause: error instanceof Error ? error : undefined,
          });
        },
      });

      // Validate the parsed sitemap against the schema
      const validatedSitemap = yield* Schema.decodeUnknown(SitemapSchema)(rawSitemap).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new SitemapValidationError({
              message: `Sitemap validation failed: ${error.message}`,
              cause: error instanceof Error ? error : undefined,
            }),
          ),
        ),
      );

      return validatedSitemap;
    }),
  );

  private static parsePipeline(pipelineElement: any): SitemapPipeline {
    if (!pipelineElement["map:match"]) {
      return { matches: [] };
    }

    // Handle single match or array of matches
    const matchElements = Array.isArray(pipelineElement["map:match"])
      ? pipelineElement["map:match"]
      : [pipelineElement["map:match"]];

    const matches: SitemapMatch[] = matchElements.map(SitemapParser.parseMatch);

    return { matches };
  }

  private static parseMatch(matchElement: any): SitemapMatch {
    const pattern = matchElement["@_pattern"] || "";
    let action: SitemapAction;

    // Parse different action types
    if (matchElement["map:read"]) {
      const readElement = matchElement["map:read"];
      action = {
        type: "read",
        src: readElement["@_src"],
        rangeSupport: readElement["@_rangeSupport"] === "true",
      };
    } else if (matchElement["map:generate"]) {
      action = {
        type: "generate",
        generator: matchElement["map:generate"]["@_generator"],
      };
    } else if (matchElement["map:transform"]) {
      action = {
        type: "transform",
        transformer: matchElement["map:transform"]["@_transformer"],
        src: matchElement["map:transform"]["@_src"],
      };
    } else {
      // Default to read action with pattern as src
      action = {
        type: "read",
        src: pattern,
        rangeSupport: false,
      };
    }

    return { pattern, action };
  }

  /**
   * Generate default sitemap that matches current AssetName behavior
   */
  static generateDefaultSitemap(): Sitemap {
    return {
      pipelines: [
        {
          matches: [
            // Root index handling
            {
              pattern: "",
              action: { type: "read", src: "index.html" },
            },
            // Directory index handling
            {
              pattern: "**/",
              action: { type: "read", src: "{1}/index.html" },
            },
            // Video files with range support (must come before general file handling)
            {
              pattern: "**.mp4",
              action: { type: "read", src: "{0}", rangeSupport: true },
            },
            {
              pattern: "**.webm",
              action: { type: "read", src: "{0}", rangeSupport: true },
            },
            {
              pattern: "**.mov",
              action: { type: "read", src: "{0}", rangeSupport: true },
            },
            {
              pattern: "**.avi",
              action: { type: "read", src: "{0}", rangeSupport: true },
            },
            {
              pattern: "**.mkv",
              action: { type: "read", src: "{0}", rangeSupport: true },
            },
            // Explicit file handling (must come before ** to avoid conflicts)
            {
              pattern: "**.*",
              action: { type: "read", src: "{0}" },
            },
            // HTML extension handling
            {
              pattern: "**",
              action: { type: "read", src: "{1}.html" },
            },
          ],
        },
      ],
    };
  }
}
