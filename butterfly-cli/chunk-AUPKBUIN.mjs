import {
  ButterflyHandler
} from "./chunk-N4ETZ65I.mjs";
import {
  AssetLoader,
  AssetNotFoundError
} from "./chunk-NC3Z5WYN.mjs";

// src/handlers/worker.ts
import { Effect, Layer, Option } from "effect";
var WorkerHandler = class _WorkerHandler {
  assets;
  constructor(staticAssets = {}) {
    this.assets = staticAssets;
  }
  /**
   * Handle incoming requests using butterfly routing
   */
  async handleRequest(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const assets = this.assets;
    const staticAssetLoader = Layer.succeed(AssetLoader, {
      loadAsset: Effect.fn("StaticAssetLoader/loadAsset")(
        (path) => Effect.gen(function* () {
          const cleanPath = path.startsWith("/") ? path.slice(1) : path;
          const maybeContent = Option.fromNullable(assets[cleanPath]);
          return yield* Option.match(maybeContent, {
            onNone: () => Effect.fail(new AssetNotFoundError({ path })),
            onSome: (content) => Effect.succeed(content)
          });
        })
      ),
      // Simple implementations that don't support streaming
      loadAssetStream: Effect.fn("StaticAssetLoader/loadAssetStream")(
        (path) => Effect.fail(new AssetNotFoundError({ path: `Streaming not supported in worker: ${path}` }))
      ),
      loadAssetRange: Effect.fn("StaticAssetLoader/loadAssetRange")(
        (path, range) => Effect.fail(new AssetNotFoundError({ path: `Range requests not supported in worker: ${path}` }))
      )
    });
    const self = this;
    return await Effect.runPromise(
      ButterflyHandler.process(pathname).pipe(
        Effect.provide(staticAssetLoader),
        Effect.map((result) => {
          if (!result.matched || !result.assetPath) {
            return self.serveStaticAsset(pathname);
          }
          const assetPath = result.assetPath.replace(/^\//, "");
          const maybeContent = Option.fromNullable(self.assets[assetPath]);
          return Option.match(maybeContent, {
            onNone: () => {
              return self.serveStaticAsset(pathname);
            },
            onSome: (content) => {
              const mimeType = self.getMimeType(assetPath);
              return new Response(content, {
                headers: {
                  "Content-Type": mimeType,
                  "Cache-Control": "public, max-age=3600"
                }
              });
            }
          });
        }),
        Effect.catchAll(
          (error) => Effect.sync(() => {
            console.error("Butterfly handler error:", error);
            return new Response("Internal Server Error", { status: 500 });
          })
        )
      )
    );
  }
  /**
   * Attempt to serve a static asset directly (for unmatched routes)
   */
  serveStaticAsset(pathname) {
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
            "Cache-Control": "public, max-age=3600"
          }
        });
      }
    });
  }
  /**
   * Determine MIME type based on file extension
   */
  getMimeType(filePath) {
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
  static createFetchHandler(staticAssets = {}) {
    const handler = new _WorkerHandler(staticAssets);
    return {
      async fetch(request, env = {}) {
        return handler.handleRequest(request, env);
      }
    };
  }
};

export {
  WorkerHandler
};
//# sourceMappingURL=chunk-AUPKBUIN.mjs.map