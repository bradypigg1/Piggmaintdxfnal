# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **api-server** (`/api`) — Express 5 backend with Drizzle ORM, exposes models/components/stats/storage routes.
- **data-app** (`/`) — "Parts & Inventory 3D Viewer". React + Vite + Tailwind v4. Industrial dark UI with sidebar nav, GLTF 3D viewer (`@react-three/fiber` + `drei`), service/replacement panel, components table, dashboard, parts catalog, inventory, tools, documents, settings. Uses generated React Query hooks from `@workspace/api-client-react`.
- **mockup-sandbox** (`/__mockup`) — design exploration sandbox.

## Domain

- `models` table: GLTF model metadata (projectName, modelName, serialNumber, revision, objectPath).
- `components` table: parts on a model with code, partNumber, manufacturer, weightKg, connectionType, wrenchSize, lengthMm, toolsRequired, toolSize, onHand, reserved, onOrder, notes.
- Status derivation (client): `available = onHand - reserved`; `<=0 OUT`, `<=2 LOW`, else AVAILABLE.
- GLTF upload: request presigned URL → PUT to GCS → POST `/api/models` with `objectPath` → load via `useGLTF("/api/storage" + objectPath)`.
