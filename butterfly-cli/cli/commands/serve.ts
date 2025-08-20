import { Effect, Layer, Console } from "effect";
import { ButterflyHandler } from "../../handlers/butterfly-handler";
import { AssetLoader, AssetNotFoundError } from "../../services/asset-loader";
import * as http from "http";
import * as path from "path";
import * as fs from "fs";

export interface ServeConfig {
  port: number;
  source: string;
}

export const serveCommand = Effect.fn("serveCommand")((config: ServeConfig) =>
  Effect.gen(function* () {
    yield* Console.log("🦋 Butterfly Development Server");
    yield* Console.log(`Source: ${path.resolve(config.source)}`);
    yield* Console.log(`Port: ${config.port}`);

    // Create file system asset loader
    const fsAssetLoader = Layer.succeed(AssetLoader, {
      loadAsset: Effect.fn("FileSystemLoader/loadAsset")((assetPath: string) =>
        Effect.gen(function* () {
          const fullPath = path.join(config.source, assetPath);
          
          return yield* Effect.tryPromise({
            try: () => fs.promises.readFile(fullPath, "utf-8"),
            catch: (error) => new AssetNotFoundError({ path: assetPath }),
          });
        })
      ),
      loadAssetStream: Effect.fn("FileSystemLoader/loadAssetStream")((assetPath: string) =>
        Effect.fail(new AssetNotFoundError({ path: assetPath }))
      ),
      loadAssetRange: Effect.fn("FileSystemLoader/loadAssetRange")((assetPath: string, range) =>
        Effect.fail(new AssetNotFoundError({ path: assetPath }))
      ),
    });

    yield* Effect.tryPromise({
      try: () => new Promise<void>((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
          const url = new URL(req.url || "/", `http://localhost:${config.port}`);
          const pathname = url.pathname;

          try {
            const result = await Effect.runPromise(
              ButterflyHandler.process(pathname).pipe(
                Effect.provide(fsAssetLoader),
                Effect.orDie // Convert errors to defects for simplicity in dev server
              ) as Effect.Effect<any, never, never>
            ) as any; // TODO: Fix AssetLoader environment type issue

            if (result.matched && result.assetPath) {
              const fullPath = path.join(config.source, result.assetPath);
              
              if (fs.existsSync(fullPath)) {
                const content = await fs.promises.readFile(fullPath, "utf-8");
                const mimeType = getMimeType(result.assetPath);
                
                res.writeHead(200, {
                  "Content-Type": mimeType,
                  "Cache-Control": "no-cache",
                });
                res.end(content);
              } else {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Asset not found");
              }
            } else {
              // Try to serve index.html for unmatched routes
              const indexPath = path.join(config.source, "index.html");
              if (fs.existsSync(indexPath)) {
                const content = await fs.promises.readFile(indexPath, "utf-8");
                res.writeHead(200, {
                  "Content-Type": "text/html",
                  "Cache-Control": "no-cache",
                });
                res.end(content);
              } else {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not found");
              }
            }
          } catch (error) {
            console.error("Request error:", error);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal server error");
          }
        });

        server.listen(config.port, () => {
          console.log(`✅ Server running at http://localhost:${config.port}`);
          console.log("Press Ctrl+C to stop");
          resolve();
        });

        server.on('error', reject);

        // Graceful shutdown
        process.on("SIGINT", () => {
          console.log("\n🛑 Shutting down server...");
          server.close(() => {
            console.log("✅ Server stopped");
            process.exit(0);
          });
        });
      }),
      catch: (error) => new Error(`Failed to start server: ${error}`),
    });
  })
);

function getMimeType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".xml")) return "application/xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "text/plain";
}