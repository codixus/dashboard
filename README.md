# Operator dashboard

Reusable operator SPA for a Codixus Admin API. Browse collections, edit documents as JSON, manage journeys, and inspect push delivery.

## Run

```bash
bun install
cp .env.example .env
bun run dev
```

`VITE_API_URL` is the API host prefix (default `http://localhost:3001/oknok`). Example production value: `https://api.codixus.com/oknok`.

All visible product branding is deployment configuration. `VITE_DASHBOARD_NAME`, `VITE_DASHBOARD_SHORT_NAME`, `VITE_DASHBOARD_TITLE`, `VITE_DASHBOARD_DESCRIPTION`, and `VITE_DASHBOARD_FAVICON_URL` control identity and browser metadata. The `VITE_DASHBOARD_*_COLOR` variables control the light palette and charts. `.env.example` contains the production-ready OK or NOK? profile; configure the same public values in the Cloudflare Pages project's build variables. Missing or invalid branding values fall back to a neutral dashboard identity and palette.

The admin token is typed on the login screen. It is stored in `sessionStorage` under `codixus.adminToken` and sent as `X-Codixus-Admin` on every request. Do not put the token in `VITE_*` env vars; those values are compiled into the client bundle.

## Scripts

- `bun run dev` - Vite dev server
- `bun run test` - Vitest
- `bun run typecheck` - TypeScript project build
- `bun run build` - production build
