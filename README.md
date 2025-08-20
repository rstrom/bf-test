# server-rewrite-test

Exported from Moneta Studio.

## Quick Deploy

### GitHub Pages (2 clicks!)
1. **Push to GitHub** 
2. **[Click here to enable Pages](../../settings/pages)** → Set Source to "GitHub Actions"
3. **Done!** Your site will be live at `https://YOUR-USERNAME.github.io/server-rewrite-test`

**That's it!** The GitHub Action builds your site automatically using Butterfly.

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
bun ./butterfly-cli/cli/index.ts serve
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

The Butterfly CLI is included as **editable TypeScript source code** - giving you complete control:

- **Debug & fix issues** - Full access to all CLI source code
- **Customize routing** - Modify `butterfly-cli/services/sitemap-router.ts`
- **Extend build process** - Edit `butterfly-cli/cli/commands/build.ts`
- **Add new features** - Expand `butterfly-cli/cli/index.ts`

**Note:** The CLI currently has some bugs but you have the full source to fix them! This ensures you always own your static site generator.

All changes take effect immediately using Bun's native TypeScript execution.

## GitHub Pages Custom Routes

This export includes a 404.html fallback that enables custom routes beyond standard patterns like:
- `/about` → serves `/about/index.html`
- `/docs/` → serves `/docs/index.html`
- `/api/users` → fallback redirects to handle client-side routing

## Troubleshooting

**Build failing?** [Click here](../../settings/pages) → Set Source to "GitHub Actions" (not "Deploy from a branch")

Learn more about [Butterfly](https://github.com/moneta-studio/moneta/tree/main/packages/butterfly).
