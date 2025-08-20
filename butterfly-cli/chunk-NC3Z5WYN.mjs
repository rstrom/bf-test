// src/parsers/pattern-matcher.ts
import { Option } from "effect";
var PatternMatcher = class {
  /**
   * Match a path against a Cocoon-style pattern
   * Supports:
   * - * for single path segment wildcard
   * - ** for multi-segment wildcard
   * - Literal text matching
   */
  static match(path, pattern) {
    if (pattern === "" && path === "") {
      return Option.some({ substitutions: [path] });
    }
    if (pattern === "" || path === "") {
      return Option.none();
    }
    const regexPattern = this.patternToRegex(pattern);
    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);
    return Option.fromNullable(match).pipe(
      Option.map((regexMatch) => {
        if (regexMatch.length === 1) {
          return {
            substitutions: [regexMatch[0]]
          };
        }
        return {
          substitutions: regexMatch.slice(0)
        };
      })
    );
  }
  /**
   * Replace {n} placeholders in a string with substitution values
   */
  static substitute(template, originalPath, substitutions) {
    return template.replace(/\{(\d+)\}/g, (match, index) => {
      const idx = parseInt(index, 10);
      return substitutions[idx] !== void 0 ? substitutions[idx] : match;
    });
  }
  static patternToRegex(pattern) {
    let escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "___DOUBLESTAR___").replace(/\*/g, "___SINGLESTAR___");
    escaped = escaped.replace(/___DOUBLESTAR___/g, "(.*)").replace(/___SINGLESTAR___/g, "([^/]*)");
    return escaped;
  }
};

// src/services/sitemap-router.ts
import { Effect, Option as Option2 } from "effect";
var SitemapRouter = class {
  static matchRequest = Effect.fn("SitemapRouter/matchRequest")(
    (pathname, sitemap) => Effect.sync(() => {
      const cleanPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
      for (const pipeline of sitemap.pipelines) {
        for (const match of pipeline.matches) {
          const maybeResult = PatternMatcher.match(cleanPath, match.pattern);
          const matchResult = Option2.match(maybeResult, {
            onNone: () => null,
            onSome: (result) => {
              let assetPath;
              if (match.action.type === "read") {
                assetPath = PatternMatcher.substitute(match.action.src, cleanPath, result.substitutions);
              } else if (match.action.type === "transform") {
                assetPath = PatternMatcher.substitute(match.action.src, cleanPath, result.substitutions);
              } else {
                assetPath = cleanPath;
              }
              return {
                matched: true,
                assetPath,
                action: match.action
              };
            }
          });
          if (matchResult) {
            return matchResult;
          }
        }
      }
      return {
        matched: false
      };
    })
  );
};

// src/services/asset-loader.ts
import { Context, Data } from "effect";
var AssetNotFoundError = class extends Data.TaggedError("AssetNotFoundError") {
  get message() {
    return `Asset not found: ${this.path}`;
  }
};
var AssetLoadError = class extends Data.TaggedError("AssetLoadError") {
  get message() {
    return `Failed to load asset: ${this.path}${this.cause ? ` - ${this.cause.message}` : ""}`;
  }
};
var AssetStreamError = class extends Data.TaggedError("AssetStreamError") {
  get message() {
    return `Failed to stream asset: ${this.path}${this.cause ? ` - ${this.cause.message}` : ""}`;
  }
};
var AssetLoader = class extends Context.Tag("ButterflyAssetLoader")() {
};

export {
  PatternMatcher,
  SitemapRouter,
  AssetNotFoundError,
  AssetLoadError,
  AssetStreamError,
  AssetLoader
};
//# sourceMappingURL=chunk-NC3Z5WYN.mjs.map