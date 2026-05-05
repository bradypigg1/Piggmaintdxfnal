import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  maintenanceEventsTable,
  pmDocumentsTable,
  type MaintenanceEvent,
  type PmDocument,
} from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";
import {
  CreateMaintenanceEventBody,
  UpdateMaintenanceEventBody,
  CreatePmDocumentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeEvent(e: MaintenanceEvent) {
  return {
    id: e.id,
    modelId: e.modelId,
    title: e.title,
    description: e.description,
    scheduledFor: e.scheduledFor.toISOString(),
    durationHours: e.durationHours,
    status: e.status,
    assignedTo: e.assignedTo,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function serializePm(p: PmDocument) {
  return {
    id: p.id,
    modelId: p.modelId,
    title: p.title,
    partCode: p.partCode,
    objectPath: p.objectPath,
    fileName: p.fileName,
    fileSize: p.fileSize,
    contentType: p.contentType,
    notes: p.notes,
    uploadedAt: p.uploadedAt.toISOString(),
  };
}

// ---------------- Maintenance events ----------------

router.get("/maintenance/events", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(maintenanceEventsTable)
    .orderBy(asc(maintenanceEventsTable.scheduledFor));
  res.json(rows.map(serializeEvent));
});

router.post("/maintenance/events", async (req: Request, res: Response) => {
  const parsed = CreateMaintenanceEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid maintenance event input" });
    return;
  }
  const d = parsed.data;
  try {
    const [row] = await db
      .insert(maintenanceEventsTable)
      .values({
        modelId: d.modelId ?? null,
        title: d.title,
        description: d.description ?? null,
        scheduledFor: new Date(d.scheduledFor),
        durationHours: d.durationHours ?? null,
        status: d.status ?? "scheduled",
        assignedTo: d.assignedTo ?? null,
        notes: d.notes ?? null,
      })
      .returning();
    res.status(201).json(serializeEvent(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create maintenance event");
    res.status(500).json({ error: "Failed to create maintenance event" });
  }
});

router.patch(
  "/maintenance/events/:eventId",
  async (req: Request, res: Response) => {
    const id = Number(req.params.eventId);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateMaintenanceEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const d = parsed.data;
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (d.modelId !== undefined) update.modelId = d.modelId;
    if (d.title !== undefined) update.title = d.title;
    if (d.description !== undefined) update.description = d.description;
    if (d.scheduledFor !== undefined)
      update.scheduledFor = new Date(d.scheduledFor);
    if (d.durationHours !== undefined) update.durationHours = d.durationHours;
    if (d.status !== undefined) update.status = d.status;
    if (d.assignedTo !== undefined) update.assignedTo = d.assignedTo;
    if (d.notes !== undefined) update.notes = d.notes;

    const [row] = await db
      .update(maintenanceEventsTable)
      .set(update)
      .where(eq(maintenanceEventsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(serializeEvent(row));
  },
);

router.delete(
  "/maintenance/events/:eventId",
  async (req: Request, res: Response) => {
    const id = Number(req.params.eventId);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [row] = await db
      .delete(maintenanceEventsTable)
      .where(eq(maintenanceEventsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  },
);

// ---------------- PM documents ----------------

router.get("/maintenance/pms", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(pmDocumentsTable)
    .orderBy(desc(pmDocumentsTable.uploadedAt));
  res.json(rows.map(serializePm));
});

router.post("/maintenance/pms", async (req: Request, res: Response) => {
  const parsed = CreatePmDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid PM document input" });
    return;
  }
  const d = parsed.data;
  try {
    const [row] = await db
      .insert(pmDocumentsTable)
      .values({
        modelId: d.modelId ?? null,
        title: d.title,
        partCode: d.partCode ?? null,
        objectPath: d.objectPath,
        fileName: d.fileName ?? null,
        fileSize: d.fileSize ?? null,
        contentType: d.contentType ?? null,
        notes: d.notes ?? null,
      })
      .returning();
    res.status(201).json(serializePm(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create PM document");
    res.status(500).json({ error: "Failed to create PM document" });
  }
});

router.delete("/maintenance/pms/:pmId", async (req: Request, res: Response) => {
  const id = Number(req.params.pmId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .delete(pmDocumentsTable)
    .where(eq(pmDocumentsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

export default router;
