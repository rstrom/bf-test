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
      const sitemapPath = path.join(sourceDir, ".moneta", "sitemap.xml");
      const hasSitemap = yield* Effect.tryPromise({
        try: () => fs.promises.access(sitemapPath).then(() => true),
        catch: () => false,
      });

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
        }
      } else {
        warnings.push("No sitemap.xml found - will use default routing rules");
      }

      // Scan all files for dynamic features
      const allFiles = yield* discoverAllFiles(sourceDir);
      
      for (const file of allFiles) {
        const issues = yield* validateFile(file, sourceDir);
        errors.push(...issues.errors);
        warnings.push(...issues.warnings);
      }

      // Check for package.json dependencies that indicate dynamic features
      const packageJsonPath = path.join(sourceDir, "package.json");
      const hasPackageJson = yield* Effect.tryPromise({
        try: () => fs.promises.access(packageJsonPath).then(() => true),
        catch: () => false,
      });

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

function discoverAllFiles(sourceDir: string): Effect.Effect<string[], never> {
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
    catch: (error) => new Error(`Failed to discover files: ${error}`),
  }).pipe(Effect.orDie);
}

function validateFile(
  filePath: string,
  sourceDir: string
): Effect.Effect<{ errors: string[]; warnings: string[] }, never> {
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
      catch: () => "",
    }).pipe(Effect.orDie);
    
    if (!content) {
      return { errors, warnings };
    }
    
    // Check for server-side database calls
    if (content.includes('SELECT ') || 
        content.includes('INSERT ') || 
        content.includes('UPDATE ') || 
        content.includes('DELETE ')) {
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