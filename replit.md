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
- `components` table: parts on a model with code, partNumber, meshName, manufacturer, weightKg, connectionType, wrenchSize, lengthMm, toolsRequired, toolSize, onHand, reserved, onOrder, notes. `meshName` links a component to a named node in the GLTF scene; the API normalizes blank strings to NULL on create/update.
- Status derivation (client): `available = onHand - reserved`; `<=0 OUT`, `<=2 LOW`, else AVAILABLE.
- GLTF upload: request presigned URL → PUT to GCS → POST `/api/models` with `objectPath` → load via `useGLTF("/api/storage" + objectPath)`.

## Workspace UX

- 3D viewer (`components/model-viewer.tsx`) clones GLTF scene + materials per instance, disposes cloned materials on unmount/url change to avoid GPU leaks, walks click events up to the nearest named ancestor, and applies emissive highlight: orange = selected, yellow = preview (clicked but not yet tagged), blue = tagged-but-not-selected.
- Click on a named mesh: if a component is already linked, it becomes selected. Otherwise the mesh is highlighted yellow and a confirm overlay appears at the top-center of the viewport ("PART HIGHLIGHTED" with mesh name + CANCEL / TAG THIS PART buttons). Only on TAG THIS PART does the Add Component form open, pre-linked to the mesh with a suggested code derived from the mesh name. Duplicate mesh names trigger a one-time toast warning per name; first match wins.
- Selection state persists across sidebar tab navigation via `hooks/use-selected-model.ts` — URL is the source of truth on the workspace page, localStorage backs it elsewhere, and a `storage` event keeps multiple tabs in sync. Underlying models (Postgres `models` table) and uploaded GLTF files (object storage) are durable across sessions and redeployments.
