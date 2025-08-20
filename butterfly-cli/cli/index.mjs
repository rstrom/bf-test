#!/usr/bin/env node
import {
  ButterflyHandler,
  SitemapParser
} from "../chunk-N4ETZ65I.mjs";
import {
  AssetLoader,
  AssetNotFoundError,
  SitemapRouter
} from "../chunk-NC3Z5WYN.mjs";

// src/cli/index.ts
import { Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect as Effect6 } from "effect";

// src/cli/commands/build.ts
import { Effect as Effect2, Console } from "effect";

// src/cli/ssg-generator.ts
import { Effect, Option } from "effect";
import * as fs from "fs";
import * as path from "path";
var SSGGenerator = class {
  static build = Effect.fn("SSGGenerator/build")(
    (options) => Effect.gen(function* () {
      const { sourceDir: sourceDir2, outputDir, verbose: verbose2 } = options;
      if (verbose2) {
        console.log("\u{1F50D} Analyzing sitemap.xml...");
      }
      yield* Effect.tryPromise({
        try: () => fs.promises.mkdir(outputDir, { recursive: true }),
        catch: (error) => new Error(`Failed to create output directory: ${error}`)
      });
      const sitemapPath = path.join(sourceDir2, ".moneta", "sitemap.xml");
      const maybeSitemapContent = yield* Effect.tryPromise({
        try: () => fs.promises.readFile(sitemapPath, "utf-8"),
        catch: () => null
      }).pipe(
        Effect.map(Option.fromNullable)
      );
      const sitemap = yield* Option.match(maybeSitemapContent, {
        onNone: () => Effect.succeed(SitemapParser.generateDefaultSitemap()),
        onSome: (content) => SitemapParser.parse(content).pipe(
          Effect.catchAll((error) => {
            console.warn(`\u26A0\uFE0F  Failed to parse sitemap.xml: ${error.message}`);
            console.warn("   Using default routing rules");
            return Effect.succeed(SitemapParser.generateDefaultSitemap());
          })
        )
      });
      if (verbose2) {
        console.log(`\u{1F4CB} Found ${sitemap.pipelines.length} pipeline(s) in sitemap`);
      }
      const allAssets = yield* discoverAssets(sourceDir2);
      if (verbose2) {
        console.log(`\u{1F4C1} Found ${allAssets.length} assets to process`);
      }
      const generatedRoutes = [];
      const processedAssets = /* @__PURE__ */ new Set();
      for (const asset of allAssets) {
        const routes = yield* generateRoutesForAsset(asset, sitemap, sourceDir2, outputDir, verbose2);
        generatedRoutes.push(...routes);
        for (const route of routes) {
          processedAssets.add(route.sourceAsset);
        }
      }
      let copiedDirectly = 0;
      for (const asset of allAssets) {
        if (!processedAssets.has(asset)) {
          yield* copyAssetDirectly(asset, sourceDir2, outputDir);
          copiedDirectly++;
        }
      }
      if (verbose2 && copiedDirectly > 0) {
        console.log(`\u{1F4CB} Copied ${copiedDirectly} assets directly (no route patterns matched)`);
      }
      return {
        success: true,
        generatedFiles: generatedRoutes.length + copiedDirectly,
        routes: generatedRoutes
      };
    })
  );
};
function discoverAssets(sourceDir2) {
  return Effect.tryPromise({
    try: async () => {
      const assets = [];
      async function walkDir(dir, basePath = "") {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue;
          const fullPath = path.join(dir, entry.name);
          const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
          if (entry.isDirectory()) {
            await walkDir(fullPath, relativePath);
          } else {
            assets.push(relativePath);
          }
        }
      }
      await walkDir(sourceDir2);
      return assets;
    },
    catch: (error) => new Error(`Failed to discover assets: ${error}`)
  });
}
function generateRoutesForAsset(assetPath, sitemap, sourceDir2, outputDir, verbose2) {
  return Effect.gen(function* () {
    const routes = [];
    const potentialUrls = generatePotentialUrls(assetPath);
    for (const testUrl of potentialUrls) {
      const routeMatch = yield* SitemapRouter.matchRequest(testUrl, sitemap);
      if (routeMatch.matched && routeMatch.assetPath === assetPath) {
        const outputPath = generateOutputPath(testUrl);
        yield* copyAssetToOutput(assetPath, outputPath, sourceDir2, outputDir);
        routes.push({
          pattern: testUrl,
          outputPath,
          sourceAsset: assetPath
        });
        if (verbose2) {
          console.log(`  /${testUrl} \u2192 ${outputPath}`);
        }
      }
    }
    return routes;
  });
}
function generatePotentialUrls(assetPath) {
  const urls = [];
  const withoutExt = assetPath.replace(/\.[^.]+$/, "");
  urls.push(assetPath);
  if (assetPath.endsWith("index.html")) {
    const dirPath = path.dirname(assetPath);
    if (dirPath !== ".") {
      urls.push(dirPath);
      urls.push(dirPath + "/");
    } else {
      urls.push("");
      urls.push("/");
    }
  } else {
    urls.push(withoutExt);
    urls.push(withoutExt + "/");
  }
  if (assetPath.includes("/")) {
    const pathParts = withoutExt.split("/");
    urls.push("/" + withoutExt);
    urls.push("/" + withoutExt + "/");
  }
  return [...new Set(urls)];
}
function generateOutputPath(url) {
  if (!url || url === "/" || url === "") {
    return "index.html";
  }
  const cleanUrl = url.startsWith("/") ? url.slice(1) : url;
  if (cleanUrl.endsWith("/")) {
    return path.join(cleanUrl, "index.html");
  }
  if (path.extname(cleanUrl)) {
    return cleanUrl;
  }
  return path.join(cleanUrl, "index.html");
}
function copyAssetToOutput(assetPath, outputPath, sourceDir2, outputDir) {
  return Effect.tryPromise({
    try: async () => {
      const sourcePath = path.join(sourceDir2, assetPath);
      const destPath = path.join(outputDir, outputPath);
      const destDir = path.dirname(destPath);
      await fs.promises.mkdir(destDir, { recursive: true });
      await fs.promises.copyFile(sourcePath, destPath);
    },
    catch: (error) => new Error(`Failed to copy ${assetPath} to ${outputPath}: ${error}`)
  }).pipe(Effect.orDie);
}
function copyAssetDirectly(assetPath, sourceDir2, outputDir) {
  return copyAssetToOutput(assetPath, assetPath, sourceDir2, outputDir).pipe(Effect.orDie);
}

// src/cli/commands/build.ts
import * as path2 from "path";
import * as fs2 from "fs";
var buildCommand = Effect2.fn("buildCommand")(
  (config) => Effect2.gen(function* () {
    yield* Console.log("\u{1F98B} Butterfly SSG Build");
    yield* Console.log(`Source: ${path2.resolve(config.source)}`);
    yield* Console.log(`Output: ${path2.resolve(config.output)}`);
    const sourceExists = yield* Effect2.tryPromise({
      try: () => fs2.promises.access(config.source).then(() => true),
      catch: () => false
    });
    if (!sourceExists) {
      yield* Console.error(`\u274C Source directory not found: ${config.source}`);
      yield* Effect2.fail(new Error("Source directory not found"));
    }
    const sitemapPath = path2.join(config.source, ".moneta", "sitemap.xml");
    const sitemapExists = yield* Effect2.tryPromise({
      try: () => fs2.promises.access(sitemapPath).then(() => true),
      catch: () => false
    });
    if (!sitemapExists) {
      yield* Console.log(`\u26A0\uFE0F  No sitemap.xml found at ${sitemapPath}`);
      yield* Console.log("   Using default routing rules");
    }
    const result = yield* SSGGenerator.build({
      sourceDir: config.source,
      outputDir: config.output,
      verbose: config.verbose
    });
    if (result.success) {
      yield* Console.log("\u2705 Build completed successfully");
      yield* Console.log(`   Generated ${result.generatedFiles} files`);
      if (result.routes && result.routes.length > 0) {
        yield* Console.log(`   Routes generated:`);
        for (const route of result.routes) {
          yield* Console.log(`     ${route.pattern} \u2192 ${route.outputPath}`);
        }
      }
    } else {
      yield* Console.error("\u274C Build failed");
      if (result.errors) {
        for (const error of result.errors) {
          yield* Console.error(`   ${error}`);
        }
      }
      yield* Effect2.fail(new Error("Build failed"));
    }
  })
);

// src/cli/commands/validate.ts
import { Effect as Effect4, Console as Console2 } from "effect";

// src/cli/ssg-validator.ts
import { Effect as Effect3 } from "effect";
import * as fs3 from "fs";
import * as path3 from "path";
var SSGValidator = class {
  static validate = Effect3.fn("SSGValidator/validate")(
    (options) => Effect3.gen(function* () {
      const { sourceDir: sourceDir2 } = options;
      const errors = [];
      const warnings = [];
      const sitemapPath = path3.join(sourceDir2, ".moneta", "sitemap.xml");
      const hasSitemap = yield* Effect3.tryPromise({
        try: () => fs3.promises.access(sitemapPath).then(() => true),
        catch: () => false
      });
      if (hasSitemap) {
        const sitemapContent = yield* Effect3.tryPromise({
          try: () => fs3.promises.readFile(sitemapPath, "utf-8"),
          catch: (error) => {
            errors.push(`Failed to read sitemap.xml: ${error}`);
            return "";
          }
        });
        if (sitemapContent) {
          const dynamicPatterns = checkForDynamicPatterns(sitemapContent);
          errors.push(...dynamicPatterns);
        }
      } else {
        warnings.push("No sitemap.xml found - will use default routing rules");
      }
      const allFiles = yield* discoverAllFiles(sourceDir2);
      for (const file of allFiles) {
        const issues = yield* validateFile(file, sourceDir2);
        errors.push(...issues.errors);
        warnings.push(...issues.warnings);
      }
      const packageJsonPath = path3.join(sourceDir2, "package.json");
      const hasPackageJson = yield* Effect3.tryPromise({
        try: () => fs3.promises.access(packageJsonPath).then(() => true),
        catch: () => false
      });
      if (hasPackageJson) {
        const packageContent = yield* Effect3.tryPromise({
          try: () => fs3.promises.readFile(packageJsonPath, "utf-8"),
          catch: () => "{}"
        });
        try {
          const pkg = JSON.parse(packageContent);
          const dynamicDeps = checkForDynamicDependencies(pkg);
          warnings.push(...dynamicDeps);
        } catch {
          warnings.push("Invalid package.json found");
        }
      }
      return {
        isSSGCompatible: errors.length === 0,
        errors,
        warnings
      };
    })
  );
};
function checkForDynamicPatterns(sitemapContent) {
  const errors = [];
  if (sitemapContent.includes("transform") && (sitemapContent.includes("xslt") || sitemapContent.includes("server"))) {
    errors.push("Sitemap contains server-side transformations that cannot be pre-generated");
  }
  if (sitemapContent.includes("database") || sitemapContent.includes("sql")) {
    errors.push("Sitemap references database sources - not compatible with SSG");
  }
  return errors;
}
function discoverAllFiles(sourceDir2) {
  return Effect3.tryPromise({
    try: async () => {
      const files = [];
      async function walkDir(dir, basePath = "") {
        const entries = await fs3.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue;
          const fullPath = path3.join(dir, entry.name);
          const relativePath = basePath ? path3.join(basePath, entry.name) : entry.name;
          if (entry.isDirectory()) {
            await walkDir(fullPath, relativePath);
          } else {
            files.push(relativePath);
          }
        }
      }
      await walkDir(sourceDir2);
      return files;
    },
    catch: (error) => new Error(`Failed to discover files: ${error}`)
  }).pipe(Effect3.orDie);
}
function validateFile(filePath, sourceDir2) {
  return Effect3.gen(function* () {
    const errors = [];
    const warnings = [];
    const fullPath = path3.join(sourceDir2, filePath);
    const fileExt = path3.extname(filePath).toLowerCase();
    if (![".js", ".ts", ".jsx", ".tsx", ".html", ".json", ".xml"].includes(fileExt)) {
      return { errors, warnings };
    }
    const content = yield* Effect3.tryPromise({
      try: () => fs3.promises.readFile(fullPath, "utf-8"),
      catch: () => ""
    }).pipe(Effect3.orDie);
    if (!content) {
      return { errors, warnings };
    }
    if (content.includes("SELECT ") || content.includes("INSERT ") || content.includes("UPDATE ") || content.includes("DELETE ")) {
      errors.push(`${filePath}: Contains SQL queries - not compatible with SSG`);
    }
    if (content.includes("yjs") || content.includes("Y.Doc") || content.includes("awareness")) {
      errors.push(`${filePath}: Contains Yjs collaborative features - not compatible with SSG`);
    }
    if (content.includes("fetch(") && content.includes("/api/")) {
      warnings.push(`${filePath}: Contains API calls - ensure these work with static hosting`);
    }
    if (content.includes("WebSocket") || content.includes("ws://") || content.includes("wss://")) {
      errors.push(`${filePath}: Contains WebSocket usage - not compatible with SSG`);
    }
    if (content.includes("getServerSideProps") || content.includes("getInitialProps") || content.includes("loader:") && content.includes("Effect")) {
      errors.push(`${filePath}: Contains server-side rendering - not compatible with SSG`);
    }
    return { errors, warnings };
  });
}
function checkForDynamicDependencies(pkg) {
  const warnings = [];
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const dynamicDeps = [
    "yjs",
    "y-websocket",
    "express",
    "fastify",
    "prisma",
    "drizzle-orm",
    "kysely"
  ];
  for (const dep of dynamicDeps) {
    if (dependencies[dep]) {
      warnings.push(`Dependency '${dep}' may indicate dynamic features`);
    }
  }
  return warnings;
}

// src/cli/commands/validate.ts
import * as path4 from "path";
import * as fs4 from "fs";
var validateCommand = Effect4.fn("validateCommand")(
  (config) => Effect4.gen(function* () {
    yield* Console2.log("\u{1F98B} Butterfly SSG Validation");
    yield* Console2.log(`Source: ${path4.resolve(config.source)}`);
    const sourceExists = yield* Effect4.tryPromise({
      try: () => fs4.promises.access(config.source).then(() => true),
      catch: () => false
    });
    if (!sourceExists) {
      yield* Console2.error(`\u274C Source directory not found: ${config.source}`);
      yield* Effect4.fail(new Error("Source directory not found"));
    }
    const result = yield* SSGValidator.validate({
      sourceDir: config.source
    });
    if (result.isSSGCompatible) {
      yield* Console2.log("\u2705 Application is compatible with Static Site Generation");
      if (result.warnings && result.warnings.length > 0) {
        yield* Console2.log("\u26A0\uFE0F  Warnings:");
        for (const warning of result.warnings) {
          yield* Console2.log(`   ${warning}`);
        }
      }
    } else {
      yield* Console2.error("\u274C Application is NOT compatible with Static Site Generation");
      yield* Console2.error("Issues found:");
      for (const error of result.errors) {
        yield* Console2.error(`   ${error}`);
      }
      yield* Console2.log("\nTo make your application SSG-compatible:");
      yield* Console2.log("\u2022 Remove server-side database queries");
      yield* Console2.log("\u2022 Remove Yjs collaborative features");
      yield* Console2.log("\u2022 Remove real-time endpoints");
      yield* Console2.log("\u2022 Use only static assets and client-side logic");
      yield* Effect4.fail(new Error("Application is not SSG compatible"));
    }
  })
);

// src/cli/commands/serve.ts
import { Effect as Effect5, Layer, Console as Console3 } from "effect";
import * as http from "http";
import * as path5 from "path";
import * as fs5 from "fs";
var serveCommand = Effect5.fn("serveCommand")(
  (config) => Effect5.gen(function* () {
    yield* Console3.log("\u{1F98B} Butterfly Development Server");
    yield* Console3.log(`Source: ${path5.resolve(config.source)}`);
    yield* Console3.log(`Port: ${config.port}`);
    const fsAssetLoader = Layer.succeed(AssetLoader, {
      loadAsset: Effect5.fn("FileSystemLoader/loadAsset")(
        (assetPath) => Effect5.gen(function* () {
          const fullPath = path5.join(config.source, assetPath);
          return yield* Effect5.tryPromise({
            try: () => fs5.promises.readFile(fullPath, "utf-8"),
            catch: (error) => new AssetNotFoundError({ path: assetPath })
          });
        })
      ),
      loadAssetStream: Effect5.fn("FileSystemLoader/loadAssetStream")(
        (assetPath) => Effect5.fail(new AssetNotFoundError({ path: assetPath }))
      ),
      loadAssetRange: Effect5.fn("FileSystemLoader/loadAssetRange")(
        (assetPath, range) => Effect5.fail(new AssetNotFoundError({ path: assetPath }))
      )
    });
    yield* Effect5.tryPromise({
      try: () => new Promise((resolve4, reject) => {
        const server = http.createServer(async (req, res) => {
          const url = new URL(req.url || "/", `http://localhost:${config.port}`);
          const pathname = url.pathname;
          try {
            const result = await Effect5.runPromise(
              ButterflyHandler.process(pathname).pipe(
                Effect5.provide(fsAssetLoader),
                Effect5.orDie
                // Convert errors to defects for simplicity in dev server
              )
            );
            if (result.matched && result.assetPath) {
              const fullPath = path5.join(config.source, result.assetPath);
              if (fs5.existsSync(fullPath)) {
                const content = await fs5.promises.readFile(fullPath, "utf-8");
                const mimeType = getMimeType(result.assetPath);
                res.writeHead(200, {
                  "Content-Type": mimeType,
                  "Cache-Control": "no-cache"
                });
                res.end(content);
              } else {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Asset not found");
              }
            } else {
              const indexPath = path5.join(config.source, "index.html");
              if (fs5.existsSync(indexPath)) {
                const content = await fs5.promises.readFile(indexPath, "utf-8");
                res.writeHead(200, {
                  "Content-Type": "text/html",
                  "Cache-Control": "no-cache"
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
          console.log(`\u2705 Server running at http://localhost:${config.port}`);
          console.log("Press Ctrl+C to stop");
          resolve4();
        });
        server.on("error", reject);
        process.on("SIGINT", () => {
          console.log("\n\u{1F6D1} Shutting down server...");
          server.close(() => {
            console.log("\u2705 Server stopped");
            process.exit(0);
          });
        });
      }),
      catch: (error) => new Error(`Failed to start server: ${error}`)
    });
  })
);
function getMimeType(filePath) {
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

// src/cli/index.ts
var sourceDir = Options.directory("source").pipe(
  Options.withAlias("s"),
  Options.withDefault(".")
);
var verbose = Options.boolean("verbose");
var buildArgs = {
  source: sourceDir,
  output: Options.directory("output").pipe(Options.withAlias("o"), Options.withDefault("dist")),
  verbose
};
var build = Command.make("build", buildArgs, buildCommand);
var validateArgs = {
  source: sourceDir
};
var validate = Command.make("validate", validateArgs, validateCommand);
var serveArgs = {
  source: sourceDir,
  port: Options.integer("port").pipe(Options.withAlias("p"), Options.withDefault(3e3))
};
var serve = Command.make("serve", serveArgs, serveCommand);
var butterfly = Command.make(
  "butterfly",
  {},
  () => Effect6.succeed(console.log("\u{1F98B} Butterfly CLI - Static site generator for Moneta applications"))
).pipe(
  Command.withSubcommands([build, validate, serve])
);
var cli = Command.run(butterfly, {
  name: "Butterfly CLI",
  version: "v0.1.0"
});
cli(process.argv).pipe(Effect6.provide(NodeContext.layer), NodeRuntime.runMain);
//# sourceMappingURL=index.mjs.map