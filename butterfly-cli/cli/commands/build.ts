import { Effect, Console } from "effect";
import { SSGGenerator } from "../ssg-generator";
import * as path from "path";
import * as fs from "fs";

export interface BuildConfig {
  source: string;
  output: string;
  verbose: boolean;
}

export const buildCommand = Effect.fn("buildCommand")((config: BuildConfig) =>
  Effect.gen(function* () {
    yield* Console.log("🦋 Butterfly SSG Build");
    yield* Console.log(`Source: ${path.resolve(config.source)}`);
    yield* Console.log(`Output: ${path.resolve(config.output)}`);

    // Check if source directory exists
    const sourceExists = yield* Effect.tryPromise({
      try: () => fs.promises.access(config.source).then(() => true),
      catch: () => false,
    });

    if (!sourceExists) {
      yield* Console.error(`❌ Source directory not found: ${config.source}`);
      yield* Effect.fail(new Error("Source directory not found"));
    }

    // Check for sitemap.xml
    const sitemapPath = path.join(config.source, ".moneta", "sitemap.xml");
    const sitemapExists = yield* Effect.tryPromise({
      try: () => fs.promises.access(sitemapPath).then(() => true),
      catch: () => false,
    });

    if (!sitemapExists) {
      yield* Console.log(`⚠️  No sitemap.xml found at ${sitemapPath}`);
      yield* Console.log("   Using default routing rules");
    }

    const result = yield* SSGGenerator.build({
      sourceDir: config.source,
      outputDir: config.output,
      verbose: config.verbose,
    });

    if (result.success) {
      yield* Console.log("✅ Build completed successfully");
      yield* Console.log(`   Generated ${result.generatedFiles} files`);
      if (result.routes && result.routes.length > 0) {
        yield* Console.log(`   Routes generated:`);
        for (const route of result.routes) {
          yield* Console.log(`     ${route.pattern} → ${route.outputPath}`);
        }
      }
    } else {
      yield* Console.error("❌ Build failed");
      if (result.errors) {
        for (const error of result.errors) {
          yield* Console.error(`   ${error}`);
        }
      }
      yield* Effect.fail(new Error("Build failed"));
    }
  })
);