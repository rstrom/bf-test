import { describe, it, expect } from "vitest";
import { Option } from "effect";
import { PatternMatcher } from "../parsers/pattern-matcher";

describe("PatternMatcher", () => {
  describe("basic pattern matching", () => {
    it("matches exact patterns", () => {
      const result = PatternMatcher.match("index.html", "index.html");
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result).substitutions).toEqual(["index.html"]);
    });

    it("matches empty pattern with empty input", () => {
      const result = PatternMatcher.match("", "");
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result).substitutions).toEqual([""]);
    });

    it("fails to match different exact patterns", () => {
      const result = PatternMatcher.match("about.html", "index.html");
      expect(Option.isNone(result)).toBe(true);
    });
  });

  describe("single wildcard (*) matching", () => {
    it("matches single segment", () => {
      const result = PatternMatcher.match("about", "*");
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result).substitutions).toEqual(["about", "about"]);
    });

    it("matches with extension", () => {
      const result = PatternMatcher.match("about.html", "*.html");
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result).substitutions).toEqual(["about.html", "about"]);
    });

    it("does not match across path separators", () => {
      const result = PatternMatcher.match("folder/about", "*");
      expect(Option.isNone(result)).toBe(true);
    });
  });

  describe("multi-segment wildcard (**) matching", () => {
    it("matches single segment", () => {
      const result = PatternMatcher.match("about", "**");
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result).substitutions).toEqual(["about", "about"]);
    });

    it("matches multiple segments", () => {
      const result = PatternMatcher.match("folder/subfolder/about", "**");
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result).substitutions).toEqual(["folder/subfolder/about", "folder/subfolder/about"]);
    });

    it("matches with suffix", () => {
      const result = PatternMatcher.match("folder/about", "**/about");
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result).substitutions).toEqual(["folder/about", "folder"]);
    });

    it("matches directory index pattern", () => {
      const result = PatternMatcher.match("folder/subfolder/", "**/");
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result).substitutions).toEqual(["folder/subfolder/", "folder/subfolder"]);
    });
  });

  describe("complex pattern combinations", () => {
    it("matches mixed wildcards", () => {
      const result = PatternMatcher.match("api/v1/users.json", "api/*/*.json");
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result).substitutions).toEqual(["api/v1/users.json", "v1", "users"]);
    });

    it("handles empty substitutions", () => {
      const result = PatternMatcher.match("/index.html", "/*");
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result).substitutions).toEqual(["/index.html", "index.html"]);
    });
  });

  describe("substitution replacement", () => {
    it("replaces {0} with full match", () => {
      const result = PatternMatcher.substitute("{0}", "about.html", ["about.html"]);
      expect(result).toBe("about.html");
    });

    it("replaces {1} with first group", () => {
      const result = PatternMatcher.substitute("{1}.html", "about", ["about", "about"]);
      expect(result).toBe("about.html");
    });

    it("handles multiple substitutions", () => {
      const result = PatternMatcher.substitute("api/{1}/{2}.json", "api/v1/users.json", [
        "api/v1/users.json",
        "v1",
        "users",
      ]);
      expect(result).toBe("api/v1/users.json");
    });

    it("leaves unmatched placeholders unchanged", () => {
      const result = PatternMatcher.substitute("{1}/{99}", "folder/about", ["folder/about", "folder"]);
      expect(result).toBe("folder/{99}");
    });
  });
});

describe("AssetName compatibility", () => {
  it("transforms root to index.html", () => {
    const result = PatternMatcher.match("", "");
    expect(Option.isSome(result)).toBe(true);
    // Should match empty pattern and resolve to index.html via sitemap
  });

  it("transforms directory paths to index.html", () => {
    const result = PatternMatcher.match("about/", "**/");
    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrThrow(result).substitutions).toEqual(["about/", "about"]);
    // Should resolve to about/index.html via sitemap
  });

  it("adds .html extension for extensionless files", () => {
    const result = PatternMatcher.match("about", "**");
    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrThrow(result).substitutions).toEqual(["about", "about"]);
    // Should resolve to about.html via sitemap
  });

  it("preserves files with extensions", () => {
    const result = PatternMatcher.match("styles.css", "**.*");
    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrThrow(result).substitutions).toEqual(["styles.css", "styles", "css"]);
    // Should resolve to styles.css unchanged
  });
});
