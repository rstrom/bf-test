import { Effect, Console } from "effect";
import { SSGValidator } from "../ssg-validator";
import * as path from "path";
import * as fs from "fs";

export interface ValidateConfig {
  source: string;
}

export const validateCommand = Effect.fn("validateCommand")((config: ValidateConfig) =>
  Effect.gen(function* () {
    yield* Console.log("🦋 Butterfly SSG Validation");
    yield* Console.log(`Source: ${path.resolve(config.source)}`);

    // Check if source directory exists
    const sourceExists = yield* Effect.tryPromise({
      try: () => fs.promises.access(config.source).then(() => true),
      catch: () => false,
    });

    if (!sourceExists) {
      yield* Console.error(`❌ Source directory not found: ${config.source}`);
      yield* Effect.fail(new Error("Source directory not found"));
    }

    const result = yield* SSGValidator.validate({
      sourceDir: config.source,
    });

    if (result.isSSGCompatible) {
      yield* Console.log("✅ Application is compatible with Static Site Generation");
      if (result.warnings && result.warnings.length > 0) {
        yield* Console.log("⚠️  Warnings:");
        for (const warning of result.warnings) {
          yield* Console.log(`   ${warning}`);
        }
      }
    } else {
      yield* Console.error("❌ Application is NOT compatible with Static Site Generation");
      yield* Console.error("Issues found:");
      for (const error of result.errors) {
        yield* Console.error(`   ${error}`);
      }
      
      yield* Console.log("\nTo make your application SSG-compatible:");
      yield* Console.log("• Remove server-side database queries");
      yield* Console.log("• Remove Yjs collaborative features");
      yield* Console.log("• Remove real-time endpoints");
      yield* Console.log("• Use only static assets and client-side logic");
      
      yield* Effect.fail(new Error("Application is not SSG compatible"));
    }
  })
);