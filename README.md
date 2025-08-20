# server-rewrite-test

Exported from Moneta Studio.

## Quick Deploy

### GitHub Pages
1. Push to GitHub - automatically deploys via GitHub Actions
2. Enable Pages in Settings → Pages → Source: GitHub Actions

### Cloudflare Workers  
1. Get API token from Cloudflare dashboard
2. Run: `npx wrangler deploy`

## Local Development
```bash
bun install
bun run serve
```

Run TypeScript directly:
```bash
bun ./butterfly-cli/index.ts serve
```

## Commands

- `bun run build` - Build static site for deployment
- `bun run validate` - Validate SSG compatibility  
- `bun run serve` - Serve locally for development

## Site Structure

- `/.moneta/sitemap.xml` - Routing configuration  
- `/assets/` - Static assets (HTML, CSS, JS, images)
- `/butterfly-cli/` - **Editable TypeScript source** for Butterfly CLI
- `/tsconfig.json` - TypeScript configuration
- `/src/worker.js` - Cloudflare Worker entry point
- `/404.html` - GitHub Pages fallback for custom routes

## Customization

The Butterfly CLI is included as **editable TypeScript source code** - not compiled JavaScript. You can:

- Modify routing logic in `butterfly-cli/services/sitemap-router.ts`
- Customize build process in `butterfly-cli/cli/commands/build.ts`
- Add new CLI commands in `butterfly-cli/cli/index.ts`
- Extend sitemap parsing in `butterfly-cli/parsers/sitemap-parser.ts`

All changes take effect immediately using Bun's native TypeScript execution.

## GitHub Pages Custom Routes

This export includes a 404.html fallback that enables custom routes beyond standard patterns like:
- `/about` → serves `/about/index.html`
- `/docs/` → serves `/docs/index.html`
- `/api/users` → fallback redirects to handle client-side routing

Learn more about [Butterfly](https://github.com/moneta-studio/moneta/tree/main/packages/butterfly).
