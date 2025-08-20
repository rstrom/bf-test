import { Context, Effect, Stream, Data } from "effect";

export class AssetNotFoundError extends Data.TaggedError("AssetNotFoundError")<{
  path: string;
}> {
  get message() {
    return `Asset not found: ${this.path}`;
  }
}

export class AssetLoadError extends Data.TaggedError("AssetLoadError")<{
  path: string;
  cause?: Error;
}> {
  get message() {
    return `Failed to load asset: ${this.path}${this.cause ? ` - ${this.cause.message}` : ""}`;
  }
}

export class AssetStreamError extends Data.TaggedError("AssetStreamError")<{
  path: string;
  cause?: Error;
}> {
  get message() {
    return `Failed to stream asset: ${this.path}${this.cause ? ` - ${this.cause.message}` : ""}`;
  }
}

export type AssetError = AssetNotFoundError | AssetLoadError | AssetStreamError;

/**
 * AssetLoader service for loading assets with full streaming and range request support.
 * This is the core dependency injection interface for Butterfly routing.
 */
export interface AssetStreamResult {
  readonly stream: Stream.Stream<Uint8Array, AssetStreamError>;
  readonly mimeType: string;
}

export interface AssetRangeResult {
  readonly stream: Stream.Stream<Uint8Array, AssetStreamError>;
  readonly mimeType: string;
  readonly contentLength: number;
  readonly totalSize: number;
}

export interface AssetLoaderService {
  /**
   * Load an asset as a string (for parsing sitemap.xml, text files, etc.)
   * Implementations may have dependencies - these will be provided by the consumer
   */
  readonly loadAsset: (path: string) => Effect.Effect<string, AssetError, any>;

  /**
   * Load an asset as a stream with MIME type information
   * Implementations may have dependencies - these will be provided by the consumer
   */
  readonly loadAssetStream: (path: string) => Effect.Effect<AssetStreamResult, AssetError, any>;

  /**
   * Load a byte range from an asset (required for video streaming)
   * Implementations may have dependencies - these will be provided by the consumer
   */
  readonly loadAssetRange: (
    path: string,
    range: { start: number; end?: number },
  ) => Effect.Effect<AssetRangeResult, AssetError, any>;
}

export class AssetLoader extends Context.Tag("ButterflyAssetLoader")<AssetLoader, AssetLoaderService>() {}
