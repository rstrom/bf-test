import { describe, it, expect } from "vitest";
import { Effect, Schema } from "effect";
import { SitemapParser } from "../parsers/sitemap-parser";
import { SitemapSchema } from "../schemas/sitemap-schema";

describe("Sitemap Schema Validation", () => {
  describe("Valid sitemap configurations", () => {
    it("validates a minimal valid sitemap", async () => {
      const xmlContent = `
        <map:sitemap xmlns:map="http://moneta.sh/sitemap/1.0">
          <map:pipelines>
            <map:pipeline>
              <map:match pattern="">
                <map:read src="index.html" />
              </map:match>
            </map:pipeline>
          </map:pipelines>
        </map:sitemap>
      `;

      const result = await Effect.runPromise(SitemapParser.parse(xmlContent));

      expect(result.pipelines).toHaveLength(1);
      expect(result.pipelines[0].matches).toHaveLength(1);
      expect(result.pipelines[0].matches[0]).toEqual({
        pattern: "",
        action: {
          type: "read",
          src: "index.html",
          rangeSupport: false,
        },
      });
    });

    it("validates sitemap with all action types", async () => {
      const xmlContent = `
        <map:sitemap xmlns:map="http://moneta.sh/sitemap/1.0">
          <map:pipelines>
            <map:pipeline>
              <map:match pattern="static/**">
                <map:read src="{0}" rangeSupport="true" />
              </map:match>
              <map:match pattern="api/**">
                <map:generate generator="api-docs" />
              </map:match>
              <map:match pattern="**.md">
                <map:transform src="{0}" transformer="markdown-html" />
              </map:match>
            </map:pipeline>
          </map:pipelines>
        </map:sitemap>
      `;

      const result = await Effect.runPromise(SitemapParser.parse(xmlContent));

      expect(result.pipelines[0].matches).toHaveLength(3);

      // Read action with range support
      expect(result.pipelines[0].matches[0].action).toEqual({
        type: "read",
        src: "{0}",
        rangeSupport: true,
      });

      // Generate action
      expect(result.pipelines[0].matches[1].action).toEqual({
        type: "generate",
        generator: "api-docs",
      });

      // Transform action
      expect(result.pipelines[0].matches[2].action).toEqual({
        type: "transform",
        src: "{0}",
        transformer: "markdown-html",
      });
    });

    it("validates sitemap with multiple pipelines", async () => {
      const xmlContent = `
        <map:sitemap xmlns:map="http://moneta.sh/sitemap/1.0">
          <map:pipelines>
            <map:pipeline>
              <map:match pattern="api/**">
                <map:generate generator="api" />
              </map:match>
            </map:pipeline>
            <map:pipeline>
              <map:match pattern="**">
                <map:read src="{0}.html" />
              </map:match>
            </map:pipeline>
          </map:pipelines>
        </map:sitemap>
      `;

      const result = await Effect.runPromise(SitemapParser.parse(xmlContent));

      expect(result.pipelines).toHaveLength(2);
      expect(result.pipelines[0].matches).toHaveLength(1);
      expect(result.pipelines[1].matches).toHaveLength(1);
    });

    it("validates default sitemap generation", async () => {
      const defaultSitemap = SitemapParser.generateDefaultSitemap();

      const validation = Schema.decodeUnknownSync(SitemapSchema)(defaultSitemap);

      expect(validation.pipelines).toHaveLength(1);
      expect(validation.pipelines[0].matches.length).toBeGreaterThan(0);

      // Check that video files have range support
      const videoMatch = validation.pipelines[0].matches.find((match) => match.pattern === "**.mp4");
      expect(videoMatch?.action).toEqual({
        type: "read",
        src: "{0}",
        rangeSupport: true,
      });
    });
  });

  describe("Invalid sitemap configurations", () => {
    it("fails validation for sitemap without pipelines", async () => {
      const invalidSitemap = {
        pipelines: [], // Empty pipelines array
      };

      expect(() => Schema.decodeUnknownSync(SitemapSchema)(invalidSitemap)).toThrow(
        "At least one pipeline is required",
      );
    });

    it("fails validation for read action without src", async () => {
      const invalidSitemap = {
        pipelines: [
          {
            matches: [
              {
                pattern: "test",
                action: {
                  type: "read" as const,
                  // Missing src attribute
                },
              },
            ],
          },
        ],
      };

      expect(() => Schema.decodeUnknownSync(SitemapSchema)(invalidSitemap)).toThrow();
    });

    it("fails validation for generate action without generator", async () => {
      const invalidSitemap = {
        pipelines: [
          {
            matches: [
              {
                pattern: "test",
                action: {
                  type: "generate" as const,
                  // Missing generator attribute
                },
              },
            ],
          },
        ],
      };

      expect(() => Schema.decodeUnknownSync(SitemapSchema)(invalidSitemap)).toThrow();
    });

    it("fails validation for transform action without src or transformer", async () => {
      const invalidSitemap = {
        pipelines: [
          {
            matches: [
              {
                pattern: "test",
                action: {
                  type: "transform" as const,
                  // Missing src and transformer attributes
                },
              },
            ],
          },
        ],
      };

      expect(() => Schema.decodeUnknownSync(SitemapSchema)(invalidSitemap)).toThrow();
    });

    it("fails validation for empty src attribute", async () => {
      const invalidSitemap = {
        pipelines: [
          {
            matches: [
              {
                pattern: "test",
                action: {
                  type: "read" as const,
                  src: "", // Empty src
                },
              },
            ],
          },
        ],
      };

      expect(() => Schema.decodeUnknownSync(SitemapSchema)(invalidSitemap)).toThrow("src attribute cannot be empty");
    });

    it("fails validation for empty generator attribute", async () => {
      const invalidSitemap = {
        pipelines: [
          {
            matches: [
              {
                pattern: "test",
                action: {
                  type: "generate" as const,
                  generator: "", // Empty generator
                },
              },
            ],
          },
        ],
      };

      expect(() => Schema.decodeUnknownSync(SitemapSchema)(invalidSitemap)).toThrow(
        "generator attribute cannot be empty",
      );
    });

    it("fails validation for empty transformer attribute", async () => {
      const invalidSitemap = {
        pipelines: [
          {
            matches: [
              {
                pattern: "test",
                action: {
                  type: "transform" as const,
                  src: "test.md",
                  transformer: "", // Empty transformer
                },
              },
            ],
          },
        ],
      };

      expect(() => Schema.decodeUnknownSync(SitemapSchema)(invalidSitemap)).toThrow(
        "transformer attribute cannot be empty",
      );
    });
  });

  describe("XML parsing edge cases", () => {
    it("handles missing namespace", async () => {
      const xmlContent = `
        <sitemap>
          <pipelines>
            <pipeline>
              <match pattern="">
                <read src="index.html" />
              </match>
            </pipeline>
          </pipelines>
        </sitemap>
      `;

      await expect(Effect.runPromise(SitemapParser.parse(xmlContent))).rejects.toThrow(
        "Root element 'map:sitemap' not found",
      );
    });

    it("handles missing pipelines element", async () => {
      const xmlContent = `
        <map:sitemap xmlns:map="http://moneta.sh/sitemap/1.0">
        </map:sitemap>
      `;

      await expect(Effect.runPromise(SitemapParser.parse(xmlContent))).rejects.toThrow(
        "'map:pipelines' element not found",
      );
    });

    it("handles malformed XML", async () => {
      const xmlContent = `
        <map:sitemap xmlns:map="http://moneta.sh/sitemap/1.0">
          <map:pipelines>
            <map:pipeline>
              <map:match pattern="">
                <map:read src="index.html"
      `;

      await expect(Effect.runPromise(SitemapParser.parse(xmlContent))).rejects.toThrow("Failed to parse sitemap XML");
    });
  });

  describe("Schema type derivation", () => {
    it("correctly infers TypeScript types from schema", () => {
      const validSitemap = {
        pipelines: [
          {
            matches: [
              {
                pattern: "test",
                action: {
                  type: "read" as const,
                  src: "test.html",
                  rangeSupport: true,
                },
              },
            ],
          },
        ],
      };

      // This should compile without type errors
      const result = Schema.decodeUnknownSync(SitemapSchema)(validSitemap);

      // Test that types are correctly inferred
      expect(typeof result.pipelines[0].matches[0].pattern).toBe("string");
      expect(result.pipelines[0].matches[0].action.type).toBe("read");

      if (result.pipelines[0].matches[0].action.type === "read") {
        expect(typeof result.pipelines[0].matches[0].action.src).toBe("string");
        expect(typeof result.pipelines[0].matches[0].action.rangeSupport).toBe("boolean");
      }
    });
  });
});
