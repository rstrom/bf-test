import { Effect } from "effect";
import * as fs from "fs";
import * as path from "path";

export interface SSGValidatorOptions {
  sourceDir: string;
}

export interface SSGValidatorResult {
  isSSGCompatible: boolean;
  errors: string[];
  warnings: string[];
}

export class SSGValidator {
  static validate = Effect.fn("SSGValidator/validate")((options: SSGValidatorOptions) =>
    Effect.gen(function* () {
      const { sourceDir } = options;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check for sitemap.xml and validate its patterns
      // Try both sourceDir/.moneta/sitemap.xml and ./.moneta/sitemap.xml
      const sitemapInSource = path.join(sourceDir, ".moneta", "sitemap.xml");
      const sitemapInRoot = path.join(process.cwd(), ".moneta", "sitemap.xml");
      
      const hasSitemapInSource = yield* Effect.tryPromise({
        try: () => fs.promises.access(sitemapInSource).then(() => true),
        catch: (error) => new Error(`Cannot access sitemap in source: ${error}`),
      }).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      );
      
      const hasSitemapInRoot = yield* Effect.tryPromise({
        try: () => fs.promises.access(sitemapInRoot).then(() => true),
        catch: (error) => new Error(`Cannot access sitemap in root: ${error}`),
      }).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      );
      
      const sitemapPath = hasSitemapInSource ? sitemapInSource : sitemapInRoot;
      const hasSitemap = hasSitemapInSource || hasSitemapInRoot;

      if (hasSitemap) {
        const sitemapContent = yield* Effect.tryPromise({
          try: () => fs.promises.readFile(sitemapPath, "utf-8"),
          catch: (error) => {
            errors.push(`Failed to read sitemap.xml: ${error}`);
            return "";
          },
        });

        if (sitemapContent) {
          // Check for dynamic features in sitemap
          const dynamicPatterns = checkForDynamicPatterns(sitemapContent);
          errors.push(...dynamicPatterns);
          
          // Check if wildcard patterns can be resolved
          const wildcardResolution = yield* checkWildcardResolution(sitemapContent, sourceDir).pipe(
            Effect.catchAll((error) => {
              errors.push(`Wildcard resolution failed: ${error.message}`);
              return Effect.succeed({ errors: [], warnings: [] });
            })
          );
          errors.push(...wildcardResolution.errors);
          warnings.push(...wildcardResolution.warnings);
        }
      } else {
        warnings.push("No sitemap.xml found - will use default routing rules");
      }

      // Scan all files for dynamic features
      const allFiles = yield* discoverAllFiles(sourceDir).pipe(
        Effect.catchAll((error) => {
          errors.push(`File discovery failed: ${error.message}`);
          return Effect.succeed([]);
        })
      );
      
      for (const file of allFiles) {
        const issues = yield* validateFile(file, sourceDir).pipe(
          Effect.catchAll((error) => {
            warnings.push(`Could not validate ${file}: ${error.message}`);
            return Effect.succeed({ errors: [], warnings: [] });
          })
        );
        errors.push(...issues.errors);
        warnings.push(...issues.warnings);
      }

      // Check for package.json dependencies that indicate dynamic features
      const packageJsonPath = path.join(sourceDir, "package.json");
      const hasPackageJson = yield* Effect.tryPromise({
        try: () => fs.promises.access(packageJsonPath).then(() => true),
        catch: (error) => new Error(`Cannot access package.json: ${error}`),
      }).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      );

      if (hasPackageJson) {
        const packageContent = yield* Effect.tryPromise({
          try: () => fs.promises.readFile(packageJsonPath, "utf-8"),
          catch: () => "{}",
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
        warnings,
      } as SSGValidatorResult;
    })
  );
}

function checkForDynamicPatterns(sitemapContent: string): string[] {
  const errors: string[] = [];
  
  // Check for server-side processing patterns
  if (sitemapContent.includes('transform') && 
      (sitemapContent.includes('xslt') || sitemapContent.includes('server'))) {
    errors.push("Sitemap contains server-side transformations that cannot be pre-generated");
  }
  
  // Check for dynamic data sources
  if (sitemapContent.includes('database') || sitemapContent.includes('sql')) {
    errors.push("Sitemap references database sources - not compatible with SSG");
  }
  
  return errors;
}

function discoverAllFiles(sourceDir: string): Effect.Effect<string[], Error> {
  return Effect.tryPromise({
    try: async () => {
      const files: string[] = [];
      
      async function walkDir(dir: string, basePath = "") {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue;
          
          const fullPath = path.join(dir, entry.name);
          const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
          
          if (entry.isDirectory()) {
            await walkDir(fullPath, relativePath);
          } else {
            files.push(relativePath);
          }
        }
      }
      
      await walkDir(sourceDir);
      return files;
    },
    catch: (error) => new Error(`Failed to discover files in ${sourceDir}: ${error}`),
  });
}

function validateFile(
  filePath: string,
  sourceDir: string
): Effect.Effect<{ errors: string[]; warnings: string[] }, Error> {
  return Effect.gen(function* () {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const fullPath = path.join(sourceDir, filePath);
    const fileExt = path.extname(filePath).toLowerCase();
    
    // Only check text files that might contain dynamic code
    if (!['.js', '.ts', '.jsx', '.tsx', '.html', '.json', '.xml'].includes(fileExt)) {
      return { errors, warnings };
    }
    
    const content = yield* Effect.tryPromise({
      try: () => fs.promises.readFile(fullPath, "utf-8"),
      catch: (error) => {
        throw new Error(`Failed to read ${filePath}: ${error}`);
      },
    });
    
    if (!content) {
      return { errors, warnings };
    }
    
    // Check for server-side database calls (more precise patterns)
    const sqlPatterns = [
      /\b(SELECT|INSERT|UPDATE|DELETE)\s+/gi,
      /\.(query|execute)\s*\(/gi,
      /sql\s*`/gi,
    ];
    
    const hasSqlQueries = sqlPatterns.some(pattern => pattern.test(content));
    if (hasSqlQueries && !content.includes('<!-- SQL example -->')) {
      errors.push(`${filePath}: Contains SQL queries - not compatible with SSG`);
    }
    
    // Check for Yjs collaborative features
    if (content.includes('yjs') || content.includes('Y.Doc') || content.includes('awareness')) {
      errors.push(`${filePath}: Contains Yjs collaborative features - not compatible with SSG`);
    }
    
    // Check for server-side APIs
    if (content.includes('fetch(') && content.includes('/api/')) {
      warnings.push(`${filePath}: Contains API calls - ensure these work with static hosting`);
    }
    
    // Check for WebSocket usage
    if (content.includes('WebSocket') || content.includes('ws://') || content.includes('wss://')) {
      errors.push(`${filePath}: Contains WebSocket usage - not compatible with SSG`);
    }
    
    // Check for server-side rendering patterns
    if (content.includes('getServerSideProps') || 
        content.includes('getInitialProps') ||
        content.includes('loader:') && content.includes('Effect')) {
      errors.push(`${filePath}: Contains server-side rendering - not compatible with SSG`);
    }
    
    return { errors, warnings };
  });
}

function checkForDynamicDependencies(pkg: any): string[] {
  const warnings: string[] = [];
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  
  // Known problematic dependencies
  const dynamicDeps = [
    'yjs',
    'y-websocket',
    'express',
    'fastify',
    'prisma',
    'drizzle-orm',
    'kysely',
  ];
  
  for (const dep of dynamicDeps) {
    if (dependencies[dep]) {
      warnings.push(`Dependency '${dep}' may indicate dynamic features`);
    }
  }
  
  return warnings;
}

function checkWildcardResolution(
  sitemapContent: string, 
  sourceDir: string
): Effect.Effect<{ errors: string[]; warnings: string[] }, Error> {
  return Effect.gen(function* () {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Parse sitemap to extract patterns
    const patterns = extractSitemapPatterns(sitemapContent);
    
    for (const pattern of patterns) {
      const resolution = yield* resolvePattern(pattern, sourceDir).pipe(
        Effect.catchAll((error) => {
          errors.push(`Cannot resolve pattern '${pattern}': ${error.message}`);
          return Effect.succeed([]);
        })
      );
      
      if (resolution.length === 0) {
        if (pattern.includes('{') || pattern.includes('*')) {
          errors.push(`Wildcard pattern '${pattern}' matches no files`);
        }
      } else {
        warnings.push(`Pattern '${pattern}' resolves to ${resolution.length} routes: ${resolution.slice(0, 3).join(', ')}${resolution.length > 3 ? '...' : ''}`);
      }
    }
    
    return { errors, warnings };
  });
}

function extractSitemapPatterns(sitemapContent: string): string[] {
  const patterns: string[] = [];
  
  // Extract src attributes from map:read elements
  const srcMatches = sitemapContent.match(/src="([^"]+)"/g) || [];
  for (const match of srcMatches) {
    const src = match.match(/src="([^"]+)"/)?.[1];
    if (src) {
      patterns.push(src);
    }
  }
  
  return patterns;
}

function resolvePattern(
  pattern: string, 
  sourceDir: string
): Effect.Effect<string[], Error> {
  return Effect.gen(function* () {
    // If pattern has no wildcards, check if file exists
    if (!pattern.includes('{') && !pattern.includes('*')) {
      const fullPath = path.join(sourceDir, pattern);
      const exists = yield* Effect.tryPromise({
        try: () => fs.promises.access(fullPath).then(() => true),
        catch: (error) => new Error(`Cannot access file: ${error}`),
      }).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      );
      return exists ? [pattern] : [];
    }
    
    // Handle wildcard patterns like "data/profile-{1}.json"
    const routes: string[] = [];
    
    if (pattern.includes('{1}')) {
      // Convert pattern to glob: "data/profile-{1}.json" → "data/profile-*.json"
      const globPattern = pattern.replace(/\{1\}/g, '*');
      const matchingFiles = yield* findMatchingFiles(sourceDir, globPattern);
      
      // Extract wildcard values from filenames
      const regex = createPatternRegex(pattern);
      for (const file of matchingFiles) {
        const match = file.match(regex);
        if (match && match[1]) {
          routes.push(match[1]);
        }
      }
    }
    
    return routes;
  });
}

function findMatchingFiles(
  sourceDir: string, 
  globPattern: string
): Effect.Effect<string[], Error> {
  return Effect.tryPromise({
    try: async () => {
      const files: string[] = [];
      const [dirPattern, filePattern] = globPattern.split('/').reduce((acc, part, index, arr) => {
        if (part.includes('*')) {
          return [arr.slice(0, index).join('/'), part];
        }
        return acc;
      }, ['', '']);
      
      const searchDir = path.join(sourceDir, dirPattern || '');
      
      try {
        const entries = await fs.promises.readdir(searchDir, { withFileTypes: true });
        
        // Simple glob matching for patterns like "profile-*.json"
        const regexPattern = filePattern.replace(/\*/g, '(.+)');
        const regex = new RegExp(`^${regexPattern}$`);
        
        for (const entry of entries) {
          if (entry.isFile() && regex.test(entry.name)) {
            files.push(path.join(dirPattern, entry.name));
          }
        }
      } catch {
        // Directory doesn't exist, return empty array
      }
      
      return files;
    },
    catch: (error) => new Error(`Failed to find matching files for ${globPattern}: ${error}`),
  });
}

function createPatternRegex(pattern: string): RegExp {
  // Convert "data/profile-{1}.json" to regex that captures the wildcard value
  const escapedPattern = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
    .replace(/\\\{1\\\}/g, '(.+)');          // Replace {1} with capture group
  
  return new RegExp(`^${escapedPattern}$`);
}