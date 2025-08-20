import { describe, it, expect, vi } from "vitest";
import { Effect, Layer } from "effect";
import { ButterflyHandler, ButterflyHandlerResult } from "../handlers/butterfly-handler";
import { AssetLoader, AssetNotFoundError } from "../services/asset-loader";

// Mock asset loader implementation for testing
const createMockAssetLoader = (assets: Record<string, string>) =>
  Layer.succeed(AssetLoader, {
    loadAsset: (path: string) =>
      assets[path] ? Effect.succeed(assets[path]) : Effect.fail(new AssetNotFoundError({ path })),
    loadAssetStream: (path: string) => Effect.fail(new AssetNotFoundError({ path })),
    loadAssetRange: (path: string, range: { start: number; end?: number }) =>
      Effect.fail(new AssetNotFoundError({ path })),
  });

describe("ButterflyHandler", () => {
  describe("with valid sitemap", () => {
    it("returns successful validation info for valid sitemap", async () => {
      const validSitemapXml = `
        <map:sitemap xmlns:map="http://moneta.sh/sitemap/1.0">
          <map:pipelines>
            <map:pipeline>
              <map:match pattern="test">
                <map:read src="test.html" />
              </map:match>
            </map:pipeline>
          </map:pipelines>
        </map:sitemap>
      `;

      const assetLoader = createMockAssetLoader({
        ".moneta/sitemap.xml": validSitemapXml,
      });

      const result = await Effect.runPromise(
        Effect.provide(ButterflyHandler.process("/test"), assetLoader) as Effect.Effect<
          ButterflyHandlerResult,
          never,
          never
        >,
      );

      expect(result.matched).toBe(true);
      expect(result.assetPath).toBe("test.html");
      expect(result.sitemapValidation).toEqual({
        success: true,
      });
    });

    it("matches requests correctly with custom sitemap", async () => {
      const customSitemapXml = `
        <map:sitemap xmlns:map="http://moneta.sh/sitemap/1.0">
          <map:pipelines>
            <map:pipeline>
              <map:match pattern="api/**">
                <map:read src="data/{1}.json" />
              </map:match>
            </map:pipeline>
          </map:pipelines>
        </map:sitemap>
      `;

      const assetLoader = createMockAssetLoader({
        ".moneta/sitemap.xml": customSitemapXml,
      });

      const result = await Effect.runPromise(
        Effect.provide(ButterflyHandler.process("/api/users"), assetLoader) as Effect.Effect<
          ButterflyHandlerResult,
          never,
          never
        >,
      );

      expect(result.matched).toBe(true);
      expect(result.assetPath).toBe("data/users.json");
      expect(result.sitemapValidation?.success).toBe(true);
    });
  });

  describe("with no sitemap file", () => {
    it("uses default sitemap without validation info", async () => {
      const assetLoader = createMockAssetLoader({}); // No sitemap file

      const result = await Effect.runPromise(
        Effect.provide(ButterflyHandler.process("/about"), assetLoader) as Effect.Effect<
          ButterflyHandlerResult,
          never,
          never
        >,
      );

      expect(result.matched).toBe(true);
      expect(result.assetPath).toBe("about.html"); // Default behavior
      expect(result.sitemapValidation).toBeUndefined();
    });
  });

  describe("with invalid XML", () => {
    it("falls back to default sitemap with XML parse error", async () => {
      const invalidXml = `this is definitely not valid XML at all`;

      const assetLoader = createMockAssetLoader({
        ".moneta/sitemap.xml": invalidXml,
      });

      const result = await Effect.runPromise(
        Effect.provide(ButterflyHandler.process("/about"), assetLoader) as Effect.Effect<
          ButterflyHandlerResult,
          never,
          never
        >,
      );

      expect(result.matched).toBe(true);
      expect(result.assetPath).toBe("about.html"); // Fallback to default
      expect(result.sitemapValidation).toEqual({
        success: false,
        errors: expect.arrayContaining([expect.stringContaining("Root element 'map:sitemap' not found")]),
      });
    });
  });

  describe("with missing required elements", () => {
    it("falls back to default sitemap with structure error", async () => {
      const missingPipelinesXml = `
        <map:sitemap xmlns:map="http://moneta.sh/sitemap/1.0">
          <!-- Missing map:pipelines element -->
        </map:sitemap>
      `;

      const assetLoader = createMockAssetLoader({
        ".moneta/sitemap.xml": missingPipelinesXml,
      });

      const result = await Effect.runPromise(
        Effect.provide(ButterflyHandler.process("/about"), assetLoader) as Effect.Effect<
          ButterflyHandlerResult,
          never,
          never
        >,
      );

      expect(result.matched).toBe(true);
      expect(result.assetPath).toBe("about.html"); // Fallback to default
      expect(result.sitemapValidation).toEqual({
        success: false,
        errors: expect.arrayContaining([expect.stringContaining("'map:pipelines' element not found")]),
      });
    });

    it("falls back with error for missing root element", async () => {
      const noRootElementXml = `
        <wrong:root xmlns:wrong="http://example.com">
          <map:pipelines>
            <map:pipeline>
              <map:match pattern="test">
                <map:read src="test.html" />
              </map:match>
            </map:pipeline>
          </map:pipelines>
        </wrong:root>
      `;

      const assetLoader = createMockAssetLoader({
        ".moneta/sitemap.xml": noRootElementXml,
      });

      const result = await Effect.runPromise(
        Effect.provide(ButterflyHandler.process("/about"), assetLoader) as Effect.Effect<
          ButterflyHandlerResult,
          never,
          never
        >,
      );

      expect(result.matched).toBe(true);
      expect(result.assetPath).toBe("about.html"); // Fallback to default
      expect(result.sitemapValidation).toEqual({
        success: false,
        errors: expect.arrayContaining([expect.stringContaining("Root element 'map:sitemap' not found")]),
      });
    });
  });

  describe("with schema validation errors", () => {
    it("falls back to default sitemap with validation error", async () => {
      const invalidSchemaXml = `
        <map:sitemap xmlns:map="http://moneta.sh/sitemap/1.0">
          <map:pipelines>
            <map:pipeline>
              <map:match pattern="test">
                <map:read src="" /><!-- Empty src attribute - schema validation error -->
              </map:match>
            </map:pipeline>
          </map:pipelines>
        </map:sitemap>
      `;

      const assetLoader = createMockAssetLoader({
        ".moneta/sitemap.xml": invalidSchemaXml,
      });

      const result = await Effect.runPromise(
        Effect.provide(ButterflyHandler.process("/about"), assetLoader) as Effect.Effect<
          ButterflyHandlerResult,
          never,
          never
        >,
      );

      expect(result.matched).toBe(true);
      expect(result.assetPath).toBe("about.html"); // Fallback to default
      expect(result.sitemapValidation).toEqual({
        success: false,
        errors: expect.arrayContaining([expect.stringContaining("Sitemap validation failed")]),
      });
    });
  });

  describe("route matching with validation info", () => {
    it("includes validation info in unmatched routes", async () => {
      const limitedSitemapXml = `
        <map:sitemap xmlns:map="http://moneta.sh/sitemap/1.0">
          <map:pipelines>
            <map:pipeline>
              <map:match pattern="api/**">
                <map:read src="data/{1}.json" />
              </map:match>
            </map:pipeline>
          </map:pipelines>
        </map:sitemap>
      `;

      const assetLoader = createMockAssetLoader({
        ".moneta/sitemap.xml": limitedSitemapXml,
      });

      const result = await Effect.runPromise(
        Effect.provide(ButterflyHandler.process("/unmatched-route"), assetLoader) as Effect.Effect<
          ButterflyHandlerResult,
          never,
          never
        >,
      );

      expect(result.matched).toBe(false);
      expect(result.fallbackToDefault).toBe(true);
      expect(result.sitemapValidation).toEqual({
        success: true,
      });
    });
  });
});
