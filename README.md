# Operator dashboard

Reusable operator SPA for a Codixus Admin API. Browse collections, edit documents as JSON, manage journeys, and inspect push delivery.

## Run

```bash
bun install
cp .env.example .env
bun run dev
```

The repository contains no app-specific API URL or branding profile. `bun run dev` and `bun run build` read the required lowercase `appslug` variable, fetch `GET /api/v1/dashboard-configs/:appSlug` from the Codixus backend, validate the complete public configuration, and expose only the allowlisted values to Vite.

For Cloudflare Workers Builds, set one build variable: `appslug=<registered-app-slug>`. Do not add `VITE_*` branding variables to the deployment. A missing slug, unknown app, unavailable config endpoint, or invalid response stops the build instead of producing a dashboard with the wrong identity.

Local development can point to a local control plane with `DASHBOARD_CONFIG_BASE_URL`; see `.env.example`. This override is not required in Cloudflare.

The admin token is typed on the login screen. It is stored in `sessionStorage` under `codixus.adminToken` and sent as `X-Codixus-Admin` on every request. Do not put the token in `VITE_*` env vars; those values are compiled into the client bundle.

## Scripts

- `bun run dev` - fetch config, then start the Vite dev server
- `bun run ci:build` - run the configured build against a product-neutral local config API fixture
- `bun run test` - Vitest
- `bun run typecheck` - TypeScript project build
- `bun run build` - typecheck, fetch config, then create the production build
