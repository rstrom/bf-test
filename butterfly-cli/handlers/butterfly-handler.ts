import { Effect, Option, Either } from "effect";
import { SitemapRouter } from "../services/sitemap-router";
import { SitemapParser } from "../parsers/sitemap-parser";
import { AssetLoader, AssetNotFoundError } from "../services/asset-loader";
import { Sitemap, RouteMatch } from "../entities/sitemap";

export interface SitemapValidationInfo {
  success: boolean;
  errors?: string[];
}

export interface ButterflyHandlerResult {
  matched: boolean;
  assetPath?: string;
  rangeSupport?: boolean;
  fallbackToDefault?: boolean;
  sitemapValidation?: SitemapValidationInfo;
}

export class ButterflyHandler {
  static process = Effect.fn("ButterflyHandler/process")((pathname: string) =>
    Effect.gen(function* () {
      // Try to load custom sitemap from assets
      const assetLoader = yield* AssetLoader;
      const maybeSitemapXml = yield* assetLoader.loadAsset(".moneta/sitemap.xml").pipe(
        Effect.map(Option.some),
        Effect.catchTags({
          AssetNotFoundError: () => Effect.succeed(Option.none<string>()),
        }),
      );

      // Parse sitemap or use default, using functional Either pattern
      const sitemapResult = yield* Option.match(maybeSitemapXml, {
        onNone: () =>
          Effect.succeed({
            sitemap: SitemapParser.generateDefaultSitemap(),
            validation: undefined as SitemapValidationInfo | undefined,
          }),
        onSome: (sitemapXml) =>
          SitemapParser.parse(sitemapXml).pipe(
            Effect.either,
            Effect.flatMap((either) =>
              Either.match(either, {
                onLeft: (error) =>
                  Effect.gen(function* () {
                    yield* Effect.logWarning("Sitemap parsing failed, falling back to default", error.message);
                    return {
                      sitemap: SitemapParser.generateDefaultSitemap(),
                      validation: { success: false, errors: [error.message] } as SitemapValidationInfo,
                    };
                  }),
                onRight: (sitemap) =>
                  Effect.succeed({
                    sitemap,
                    validation: { success: true } as SitemapValidationInfo,
                  }),
              }),
            ),
          ),
      });

      const { sitemap, validation: sitemapValidation } = sitemapResult;

      // Match the request against the sitemap
      const routeMatch = yield* SitemapRouter.matchRequest(pathname, sitemap);

      // Early return pattern using if/else with cleaner structure
      if (!routeMatch.matched) {
        return {
          matched: false,
          fallbackToDefault: true,
          sitemapValidation,
        };
      }

      return {
        matched: true,
        assetPath: routeMatch.assetPath,
        rangeSupport: routeMatch.action?.type === "read" ? routeMatch.action.rangeSupport : false,
        fallbackToDefault: false,
        sitemapValidation,
      };
    }),
  );
}
