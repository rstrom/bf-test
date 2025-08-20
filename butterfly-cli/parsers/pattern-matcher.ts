import { Option } from "effect";

export interface MatchResult {
  substitutions: string[];
}

export class PatternMatcher {
  /**
   * Match a path against a Cocoon-style pattern
   * Supports:
   * - * for single path segment wildcard
   * - ** for multi-segment wildcard
   * - Literal text matching
   */
  static match(path: string, pattern: string): Option.Option<MatchResult> {
    // Handle exact match for empty patterns
    if (pattern === "" && path === "") {
      return Option.some({ substitutions: [path] });
    }

    if (pattern === "" || path === "") {
      return Option.none();
    }

    // Convert Cocoon pattern to regex
    const regexPattern = this.patternToRegex(pattern);
    const regex = new RegExp(`^${regexPattern}$`);

    const match = path.match(regex);

    return Option.fromNullable(match).pipe(
      Option.map((regexMatch) => {
        // Extract substitution groups (full match + capture groups)
        // For exact pattern matches without wildcards, return just the full match
        if (regexMatch.length === 1) {
          return {
            substitutions: [regexMatch[0]],
          };
        }

        // Include full match as {0} and capture groups as {1}, {2}, etc.
        return {
          substitutions: regexMatch.slice(0),
        };
      }),
    );
  }

  /**
   * Replace {n} placeholders in a string with substitution values
   */
  static substitute(template: string, originalPath: string, substitutions: string[]): string {
    return template.replace(/\{(\d+)\}/g, (match, index) => {
      const idx = parseInt(index, 10);
      return substitutions[idx] !== undefined ? substitutions[idx] : match;
    });
  }

  private static patternToRegex(pattern: string): string {
    // Escape regex special characters except * and **
    let escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "___DOUBLESTAR___")
      .replace(/\*/g, "___SINGLESTAR___");

    // Replace placeholders with regex groups
    escaped = escaped
      .replace(/___DOUBLESTAR___/g, "(.*)") // ** matches anything including /
      .replace(/___SINGLESTAR___/g, "([^/]*)"); // * matches anything except /

    return escaped;
  }
}
