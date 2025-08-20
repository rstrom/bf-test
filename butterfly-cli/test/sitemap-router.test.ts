import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { SitemapRouter } from "../services/sitemap-router";
import { Sitemap } from "../entities/sitemap";

describe("SitemapRouter", () => {
  const defaultSitemap: Sitemap = {
    pipelines: [
      {
        matches: [
          // Root index handling
          { pattern: "", action: { type: "read", src: "index.html", rangeSupport: false } },
          // Directory index handling
          { pattern: "**/", action: { type: "read", src: "{1}/index.html", rangeSupport: false } },
          // Explicit file handling (must come before ** to avoid conflicts)
          { pattern: "**.*", action: { type: "read", src: "{0}", rangeSupport: false } },
          // HTML extension handling
          { pattern: "**", action: { type: "read", src: "{1}.html", rangeSupport: false } },
        ],
      },
    ],
  };

  describe("request matching", () => {
    it("matches root path to index.html", async () => {
      const result = await Effect.runPromise(SitemapRouter.matchRequest("", defaultSitemap));

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.assetPath).toBe("index.html");
      }
    });

    it("matches directory path to index.html", async () => {
      const result = await Effect.runPromise(SitemapRouter.matchRequest("about/", defaultSitemap));

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.assetPath).toBe("about/index.html");
      }
    });

    it("adds .html extension to extensionless paths", async () => {
      const result = await Effect.runPromise(SitemapRouter.matchRequest("about", defaultSitemap));

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.assetPath).toBe("about.html");
      }
    });

    it("preserves explicit file extensions", async () => {
      const result = await Effect.runPromise(SitemapRouter.matchRequest("styles.css", defaultSitemap));

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.assetPath).toBe("styles.css");
      }
    });

    it("handles nested paths", async () => {
      const result = await Effect.runPromise(SitemapRouter.matchRequest("docs/getting-started", defaultSitemap));

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.assetPath).toBe("docs/getting-started.html");
      }
    });

    it("returns no match for unmatched patterns", async () => {
      const emptySitemap: Sitemap = { pipelines: [] };

      const result = await Effect.runPromise(SitemapRouter.matchRequest("nonexistent", emptySitemap));

      expect(result.matched).toBe(false);
    });
  });

  describe("multiple pipeline processing", () => {
    it("processes patterns in order until match", async () => {
      const multiPipelineSitemap: Sitemap = {
        pipelines: [
          {
            matches: [{ pattern: "special", action: { type: "read", src: "special-file.html", rangeSupport: false } }],
          },
          {
            matches: [{ pattern: "**", action: { type: "read", src: "{1}.html", rangeSupport: false } }],
          },
        ],
      };

      const result = await Effect.runPromise(SitemapRouter.matchRequest("special", multiPipelineSitemap));

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.assetPath).toBe("special-file.html");
      }
    });
  });
});
