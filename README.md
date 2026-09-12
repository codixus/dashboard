# Codixus dashboard

Operator SPA for a Codixus Admin API. Browse collections, edit documents as JSON, and send a single-device push.

## Run

```bash
bun install
cp .env.example .env
bun run dev
```

`VITE_API_URL` is the API host prefix (default `http://localhost:3001/oknok`). Example production value: `https://api.codixus.com/oknok`.

The admin token is typed on the login screen. It is stored in `sessionStorage` under `codixus.adminToken` and sent as `X-Codixus-Admin` on every request. Do not put the token in `VITE_*` env vars; those values are compiled into the client bundle.

## Scripts

- `bun run dev` - Vite dev server
- `bun run test` - Vitest
- `bun run typecheck` - TypeScript project build
- `bun run build` - production build
