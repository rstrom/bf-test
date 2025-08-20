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
      catch: (error) => new Error(`Cannot access source directory: ${error}`),
    }).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    );

    if (!sourceExists) {
      yield* Console.error(`❌ Source directory not found: ${config.source}`);
      yield* Effect.sync(() => process.exit(1));
    }

    const result = yield* SSGValidator.validate({
      sourceDir: config.source,
    }).pipe(
      Effect.catchAll((error) => Effect.gen(function* () {
        yield* Console.error(`🐛 Debug: Validation failed with error: ${error}`);
        yield* Console.error(`Error type: ${typeof error}`);
        const errorMessage = typeof error === 'object' && error && 'message' in error 
          ? (error as Error).message 
          : String(error);
        const errorStack = typeof error === 'object' && error && 'stack' in error 
          ? (error as Error).stack 
          : 'No stack';
        yield* Console.error(`Error message: ${errorMessage}`);
        yield* Console.error(`Stack trace: ${errorStack}`);
        yield* Effect.sync(() => process.exit(1));
      }))
    );

    if (result && result.isSSGCompatible) {
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
      if (result && result.errors) {
        for (const error of result.errors) {
          yield* Console.error(`   ${error}`);
        }
      }
      
      yield* Console.log("\nTo make your application SSG-compatible:");
      yield* Console.log("• Remove server-side database queries");
      yield* Console.log("• Remove Yjs collaborative features");
      yield* Console.log("• Remove real-time endpoints");
      yield* Console.log("• Use only static assets and client-side logic");
      
      yield* Effect.sync(() => process.exit(1));
    }
  })
);