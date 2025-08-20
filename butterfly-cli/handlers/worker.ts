/**
 * Cloudflare Worker handler for standalone butterfly deployment
 * This allows deploying a butterfly-powered static site as a CF Worker
 * with zero external dependencies (no KV, no R2, just bundled assets)
 */

import { ButterflyHandler, ButterflyHandlerResult } from "./butterfly-handler";
import {
  AssetLoader,
  AssetNotFoundError,
  AssetLoadError,
  AssetStreamResult,
  AssetRangeResult,
} from "../services/asset-loader";
import { Effect, Layer, Option } from "effect";

/**
 * Static assets bundled directly into the worker
 * Key: asset path (e.g., "sitemap.xml", "data/profile-alice.json")
 * Value: asset content as string
 */
export interface StaticAssets {
  [path: string]: string;
}

/**
 * No environment dependencies needed for pure static deployment
 */
export interface WorkerEnv {
  // Reserved for future use, but no dependencies required
}

export class WorkerHandler {
  private assets: StaticAssets;

  constructor(staticAssets: StaticAssets = {}) {
    this.assets = staticAssets;
  }

  /**
   * Handle incoming requests using butterfly routing
   */
  async handleRequest(request: Request, env?: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Create simple AssetLoader layer for static assets
    const assets = this.assets; // Capture assets in closure
    const staticAssetLoader = Layer.succeed(AssetLoader, {
      loadAsset: Effect.fn("StaticAssetLoader/loadAsset")((path: string) =>
        Effect.gen(function* () {
          const cleanPath = path.startsWith("/") ? path.slice(1) : path;
          const maybeContent = Option.fromNullable(assets[cleanPath]);

          return yield* Option.match(maybeContent, {
            onNone: () => Effect.fail(new AssetNotFoundError({ path })),
            onSome: (content) => Effect.succeed(content),
          });
        }),
      ),
      // Simple implementations that don't support streaming
      loadAssetStream: Effect.fn("StaticAssetLoader/loadAssetStream")((path: string) =>
        Effect.fail(new AssetNotFoundError({ path: `Streaming not supported in worker: ${path}` })),
      ),
      loadAssetRange: Effect.fn("StaticAssetLoader/loadAssetRange")((path: string, range) =>
        Effect.fail(new AssetNotFoundError({ path: `Range requests not supported in worker: ${path}` })),
      ),
    });

    const self = this;
    return await Effect.runPromise(
      ButterflyHandler.process(pathname).pipe(
        Effect.provide(staticAssetLoader),
        Effect.map((result) => {
          if (!result.matched || !result.assetPath) {
            // Try to serve direct static assets for unmatched routes
            return self.serveStaticAsset(pathname);
          }

          // Load the matched asset via butterfly routing
          const assetPath = result.assetPath.replace(/^\//, "");
          const maybeContent = Option.fromNullable(self.assets[assetPath]);

          return Option.match(maybeContent, {
            onNone: () => {
              // If butterfly routing matched but asset not found, try direct static
              return self.serveStaticAsset(pathname);
            },
            onSome: (content) => {
              const mimeType = self.getMimeType(assetPath);
              return new Response(content, {
                headers: {
                  "Content-Type": mimeType,
                  "Cache-Control": "public, max-age=3600",
                },
              });
            },
          });
        }),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            console.error("Butterfly handler error:", error);
            return new Response("Internal Server Error", { status: 500 });
          }),
        ),
      ) as Effect.Effect<Response, never, never>,
    );
  }

  /**
   * Attempt to serve a static asset directly (for unmatched routes)
   */
  private serveStaticAsset(pathname: string): Response {
    const cleanPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
    const indexPath = cleanPath || "index.html";

    const maybeContent = Option.fromNullable(this.assets[indexPath]);

    return Option.match(maybeContent, {
      onNone: () => new Response("Not Found", { status: 404 }),
      onSome: (content) => {
        const mimeType = this.getMimeType(indexPath);
        return new Response(content, {
          headers: {
            "Content-Type": mimeType,
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    });
  }

  /**
   * Determine MIME type based on file extension
   */
  private getMimeType(filePath: string): string {
    if (filePath.endsWith(".css")) return "text/css";
    if (filePath.endsWith(".js")) return "application/javascript";
    if (filePath.endsWith(".json")) return "application/json";
    if (filePath.endsWith(".xml")) return "application/xml";
    if (filePath.endsWith(".png")) return "image/png";
    if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
    if (filePath.endsWith(".svg")) return "image/svg+xml";
    if (filePath.endsWith(".woff2")) return "font/woff2";
    if (filePath.endsWith(".woff")) return "font/woff";
    if (filePath.endsWith(".ttf")) return "font/ttf";
    return "text/html";
  }

  /**
   * Create a fetch handler for Cloudflare Workers
   */
  static createFetchHandler(staticAssets: StaticAssets = {}) {
    const handler = new WorkerHandler(staticAssets);

    return {
      async fetch(request: Request, env: WorkerEnv = {}): Promise<Response> {
        return handler.handleRequest(request, env);
      },
    };
  }
}

// Default export for easy CF Worker integration
export default WorkerHandler;
