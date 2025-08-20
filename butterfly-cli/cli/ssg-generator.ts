import { Effect, Option, Array as EffectArray } from "effect";
import { SitemapParser } from "../parsers/sitemap-parser";
import { SitemapRouter } from "../services/sitemap-router";
import { PatternMatcher } from "../parsers/pattern-matcher";
import * as fs from "fs";
import * as path from "path";

export interface SSGGeneratorOptions {
  sourceDir: string;
  outputDir: string;
  verbose: boolean;
}

export interface SSGGeneratorResult {
  success: boolean;
  generatedFiles: number;
  routes?: GeneratedRoute[];
  errors?: string[];
}

export interface GeneratedRoute {
  pattern: string;
  outputPath: string;
  sourceAsset: string;
}

export class SSGGenerator {
  static build = Effect.fn("SSGGenerator/build")((options: SSGGeneratorOptions) =>
    Effect.gen(function* () {
      const { sourceDir, outputDir, verbose } = options;

      if (verbose) {
        console.log("🔍 Analyzing sitemap.xml...");
      }

      // Ensure output directory exists
      yield* Effect.tryPromise({
        try: () => fs.promises.mkdir(outputDir, { recursive: true }),
        catch: (error) => new Error(`Failed to create output directory: ${error}`),
      });

      // Try to load sitemap.xml (check both sourceDir and root)
      const sitemapInSource = path.join(sourceDir, ".moneta", "sitemap.xml");
      const sitemapInRoot = path.join(process.cwd(), ".moneta", "sitemap.xml");
      
      let maybeSitemapContent: Option.Option<string>;
      
      const contentFromSource = yield* Effect.tryPromise({
        try: () => fs.promises.readFile(sitemapInSource, "utf-8"),
        catch: () => null,
      });
      
      if (contentFromSource) {
        maybeSitemapContent = Option.some(contentFromSource);
      } else {
        const contentFromRoot = yield* Effect.tryPromise({
          try: () => fs.promises.readFile(sitemapInRoot, "utf-8"),
          catch: () => null,
        });
        maybeSitemapContent = Option.fromNullable(contentFromRoot);
      }

      // Parse sitemap or use default
      const sitemap = yield* Option.match(maybeSitemapContent, {
        onNone: () => Effect.succeed(SitemapParser.generateDefaultSitemap()),
        onSome: (content) => SitemapParser.parse(content).pipe(
          Effect.catchAll((error) => {
            console.warn(`⚠️  Failed to parse sitemap.xml: ${error.message}`);
            console.warn("   Using default routing rules");
            return Effect.succeed(SitemapParser.generateDefaultSitemap());
          })
        ),
      });

      if (verbose) {
        console.log(`📋 Found ${sitemap.pipelines.length} pipeline(s) in sitemap`);
      }

      // Discover all assets in source directory
      const allAssets = yield* discoverAssets(sourceDir);
      
      if (verbose) {
        console.log(`📁 Found ${allAssets.length} assets to process`);
        if (allAssets.length > 0) {
          allAssets.forEach(asset => console.log(`  /${asset}`));
        } else {
          console.log(`❌ No assets found in ${sourceDir}`);
        }
      }

      // Generate routes by testing each asset against sitemap patterns
      const generatedRoutes: GeneratedRoute[] = [];
      const processedAssets = new Set<string>();

      // For each asset, find all possible routes that could lead to it
      for (const asset of allAssets) {
        const routes = yield* generateRoutesForAsset(asset, sitemap, sourceDir, outputDir, verbose);
        generatedRoutes.push(...routes);
        
        for (const route of routes) {
          processedAssets.add(route.sourceAsset);
        }
      }

      // Copy remaining assets that weren't matched by any route patterns
      let copiedDirectly = 0;
      for (const asset of allAssets) {
        if (!processedAssets.has(asset)) {
          yield* copyAssetDirectly(asset, sourceDir, outputDir);
          copiedDirectly++;
        }
      }

      if (verbose && copiedDirectly > 0) {
        console.log(`📋 Copied ${copiedDirectly} assets directly (no route patterns matched)`);
      }

      return {
        success: true,
        generatedFiles: generatedRoutes.length + copiedDirectly,
        routes: generatedRoutes,
      } as SSGGeneratorResult;
    })
  );
}

// Discover all assets in source directory
function discoverAssets(sourceDir: string): Effect.Effect<string[], Error> {
  return Effect.tryPromise({
    try: async () => {
      const assets: string[] = [];
      
      async function walkDir(dir: string, basePath = "") {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue; // Skip hidden files
          
          const fullPath = path.join(dir, entry.name);
          const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
          
          if (entry.isDirectory()) {
            await walkDir(fullPath, relativePath);
          } else {
            assets.push(relativePath);
          }
        }
      }
      
      await walkDir(sourceDir);
      return assets;
    },
    catch: (error) => new Error(`Failed to discover assets: ${error}`),
  });
}

// Generate possible routes for a given asset based on sitemap patterns
function generateRoutesForAsset(
  assetPath: string,
  sitemap: any,
  sourceDir: string,
  outputDir: string,
  verbose: boolean
): Effect.Effect<GeneratedRoute[]> {
  return Effect.gen(function* () {
    const routes: GeneratedRoute[] = [];
    
    // Test various potential URLs that could match this asset
    const potentialUrls = generatePotentialUrls(assetPath);
    
    for (const testUrl of potentialUrls) {
      const routeMatch = yield* SitemapRouter.matchRequest(testUrl, sitemap);
      
      if (routeMatch.matched && routeMatch.assetPath === assetPath) {
        // This URL pattern leads to our asset - generate the static file
        const outputPath = generateOutputPath(testUrl);
        
        yield* copyAssetToOutput(assetPath, outputPath, sourceDir, outputDir);
        
        routes.push({
          pattern: testUrl,
          outputPath,
          sourceAsset: assetPath,
        });
        
        if (verbose) {
          console.log(`  /${testUrl} → ${outputPath}`);
        }
      }
    }
    
    return routes;
  });
}

// Generate potential URLs that could match an asset - GitHub Pages focused
function generatePotentialUrls(assetPath: string): string[] {
  const urls: string[] = [];
  
  // Remove file extension and try various patterns
  const withoutExt = assetPath.replace(/\.[^.]+$/, "");
  
  // Add the asset path itself (for direct file access)
  urls.push(assetPath);
  
  // Handle index.html files - these should map to directory URLs
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
    // For non-index files, add clean URL patterns
    urls.push(withoutExt);
    urls.push(withoutExt + "/");
  }
  
  // Add common GitHub Pages patterns
  if (assetPath.includes("/")) {
    const pathParts = withoutExt.split("/");
    // Generate nested directory patterns
    urls.push("/" + withoutExt);
    urls.push("/" + withoutExt + "/");
  }
  
  return [...new Set(urls)]; // Remove duplicates
}

// Generate output path for a URL - GitHub Pages compatible
function generateOutputPath(url: string): string {
  if (!url || url === "/" || url === "") {
    return "index.html";
  }
  
  // Clean the URL
  const cleanUrl = url.startsWith("/") ? url.slice(1) : url;
  
  // If URL ends with /, it should be a directory with index.html
  if (cleanUrl.endsWith("/")) {
    return path.join(cleanUrl, "index.html");
  }
  
  // If URL has an extension, keep it as-is
  if (path.extname(cleanUrl)) {
    return cleanUrl;
  }
  
  // For clean URLs (no extension), create both the .html file AND a directory with index.html
  // This enables GitHub Pages to serve /about as /about/ automatically
  return path.join(cleanUrl, "index.html");
}

// Copy asset to output with proper structure
function copyAssetToOutput(
  assetPath: string,
  outputPath: string,
  sourceDir: string,
  outputDir: string
): Effect.Effect<void, never> {
  return Effect.tryPromise({
    try: async () => {
      const sourcePath = path.join(sourceDir, assetPath);
      const destPath = path.join(outputDir, outputPath);
      const destDir = path.dirname(destPath);
      
      // Ensure destination directory exists
      await fs.promises.mkdir(destDir, { recursive: true });
      
      // Copy the file
      await fs.promises.copyFile(sourcePath, destPath);
    },
    catch: (error) => new Error(`Failed to copy ${assetPath} to ${outputPath}: ${error}`),
  }).pipe(Effect.orDie);
}

// Copy asset directly without route processing
function copyAssetDirectly(
  assetPath: string,
  sourceDir: string,
  outputDir: string
): Effect.Effect<void, never> {
  return copyAssetToOutput(assetPath, assetPath, sourceDir, outputDir).pipe(Effect.orDie);
}