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

- **api-server** (`/api`) — Express 5 backend with Drizzle ORM, exposes models/components/stats/storage/maintenance routes.
- **data-app** (`/`) — "Parts & Inventory 3D Viewer". React + Vite + Tailwind v4. Industrial dark UI with sidebar nav, GLTF 3D viewer (`@react-three/fiber` + `drei`), service/replacement panel, components table, dashboard, parts catalog, inventory, tools, maintenance calendar + PM documents, documents, settings. Uses generated React Query hooks from `@workspace/api-client-react`.
- **mockup-sandbox** (`/__mockup`) — design exploration sandbox.

## Domain

- `models` table: GLTF model metadata (projectName, modelName, serialNumber, revision, objectPath).
- `components` table: parts on a model with code, partNumber, meshName, manufacturer, weightKg, connectionType, wrenchSize, lengthMm, toolsRequired, toolSize, qtyRequired (integer, default 1), onHand, reserved, onOrder, notes. `meshName` links a component to a named node in the GLTF scene; the API normalizes blank strings to NULL on create/update.
- `maintenance_events` table: scheduled preventive-maintenance tasks with title, scheduledFor (timestamptz, stored as UTC instant — UI picks local date+time and converts via `toISOString()`), durationHours, status (`scheduled` | `completed` | `overdue`, enforced as enum in OpenAPI/zod), assignedTo, notes, optional `modelId` FK with `ON DELETE SET NULL`.
- `pm_documents` table: uploaded Preventive Maintenance reference files. Title, optional modelId/partCode, objectPath (presigned-URL upload via existing `/storage/uploads/request-url`), fileName, fileSize, contentType, notes. Download via `/api/storage{objectPath}`.
- Maintenance page (`/maintenance`): custom date-fns month grid (Sunday-aligned weeks) with event chips per day, prev/next/TODAY nav, click empty day → schedule dialog pre-filled to that date, click chip → edit dialog (with delete). Day cells are `role="gridcell" tabIndex={0}` (Enter/Space) and chips are real `<button>`s — no nested interactives. Right-side UPCOMING sidebar shows the next 8 future events; overdue scheduled items are auto-styled red. PM upload dialog enforces a safe-filename regex before requesting an upload URL.
- Status derivation (client): `available = onHand - reserved`; `<=0 OUT`, `<=2 LOW`, else AVAILABLE.
- GLTF upload: request presigned URL → PUT to GCS → POST `/api/models` with `objectPath` → load via `useGLTF("/api/storage" + objectPath)`.

## Workspace UX

- 3D viewer (`components/model-viewer.tsx`) clones GLTF scene + materials per instance, disposes cloned materials on unmount/url change to avoid GPU leaks, walks click events up to the nearest named ancestor, and applies emissive highlight only for active interactions: orange (`#ff6a00`) = currently selected component, sky-blue (`#38bdf8`) = preview (clicked but not yet tagged). Tagged-but-not-selected parts deliberately retain their original GLTF material colors so the assembly looks clean regardless of how many parts are catalogued or their stock state.
- Exploded view: a slider overlay at the bottom-center of the 3D viewport (0–200%) pushes top-level model parts outward from the model's bounding-box centroid. ModelViewer collapses single-child chains to find the first level with multiple mesh-bearing children, then for each it stores `{originalPos, offsetDir = childCenter − sceneCenter, both converted to parent-local space via worldToLocal}` so rotated/scaled ancestor transforms are handled correctly. Position is restored on cleanup; slider auto-resets to 0 when the user switches models.
- Click on a named mesh: if a component is already linked, it becomes selected. Otherwise the mesh is highlighted in sky-blue and a confirm overlay appears at the top-center of the viewport ("PART HIGHLIGHTED" with mesh name + CANCEL / TAG THIS PART buttons). Only on TAG THIS PART does the Add Component form open, pre-linked to the mesh with a suggested code derived from the mesh name. Duplicate mesh names trigger a one-time toast warning per name; first match wins.
- Selection state persists across sidebar tab navigation via `hooks/use-selected-model.ts` — URL is the source of truth on the workspace page, localStorage backs it elsewhere, and a `storage` event keeps multiple tabs in sync. Underlying models (Postgres `models` table) and uploaded GLTF files (object storage) are durable across sessions and redeployments.
- Right-side "SERVICE & REPLACEMENT INFO" panel (360px wide) renders one card per component. Card header is `<CODE> – <DESCRIPTION>` (uppercase). When `toolsRequired`/`toolSize` are set, a "Replacement Tools" sub-section with a bullet appears above the field rows. Field rows (Connection Type, Wrench Size, Length, Part Number) hide themselves when empty; values render in sky-blue (`#38bdf8`) accent. The Inventory row always renders with its value colored by stock status (green/yellow/red). The whole list is collapsible via the chevron in the section header (`aria-expanded`/`aria-controls` wired to `#service-info-list`); the COMPONENT NOTES panel below intentionally remains visible while the list is collapsed.
