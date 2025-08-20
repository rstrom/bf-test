import { Effect, Option } from "effect";
import { Sitemap, RouteMatch } from "../entities/sitemap";
import { PatternMatcher } from "../parsers/pattern-matcher";

export class SitemapRouter {
  static matchRequest = Effect.fn("SitemapRouter/matchRequest")((pathname: string, sitemap: Sitemap) =>
    Effect.sync(() => {
      // Clean the pathname - remove leading slash for pattern matching
      const cleanPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;

      // Process pipelines in order
      for (const pipeline of sitemap.pipelines) {
        for (const match of pipeline.matches) {
          const maybeResult = PatternMatcher.match(cleanPath, match.pattern);

          // Use Option.match for cleaner conditional logic
          const matchResult = Option.match(maybeResult, {
            onNone: () => null,
            onSome: (result) => {
              // Apply substitutions to the action source
              let assetPath: string;
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
                action: match.action,
              } as const;
            },
          });

          if (matchResult) {
            return matchResult;
          }
        }
      }

      // No match found
      return {
        matched: false,
      } as const;
    }),
  );
}
