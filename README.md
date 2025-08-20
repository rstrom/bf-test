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
npm install
npm run serve
```

## Commands

- `npm run build` - Build static site for deployment
- `npm run validate` - Validate SSG compatibility  
- `npm run serve` - Serve locally for development

## Site Structure

- `/.moneta/sitemap.xml` - Routing configuration  
- `/assets/` - Static assets (HTML, CSS, JS, images)
- `/butterfly-cli/` - Bundled Butterfly CLI (no npm install needed)
- `/src/worker.js` - Cloudflare Worker entry point
- `/404.html` - GitHub Pages fallback for custom routes

## GitHub Pages Custom Routes

This export includes a 404.html fallback that enables custom routes beyond standard patterns like:
- `/about` → serves `/about/index.html`
- `/docs/` → serves `/docs/index.html`
- `/api/users` → fallback redirects to handle client-side routing

Learn more about [Butterfly](https://github.com/moneta-studio/moneta/tree/main/packages/butterfly).
