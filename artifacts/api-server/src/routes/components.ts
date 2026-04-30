import { Router, type IRouter, type Request, type Response } from "express";
import { db, componentsTable, modelsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateComponentBody, UpdateComponentBody } from "@workspace/api-zod";

const CreateComponentRequest = CreateComponentBody;
const UpdateComponentRequest = UpdateComponentBody;

const router: IRouter = Router();

function serialize(c: typeof componentsTable.$inferSelect) {
  return {
    id: c.id,
    modelId: c.modelId,
    code: c.code,
    description: c.description,
    partNumber: c.partNumber,
    meshName: c.meshName,
    manufacturer: c.manufacturer,
    weightKg: c.weightKg,
    connectionType: c.connectionType,
    wrenchSize: c.wrenchSize,
    lengthMm: c.lengthMm,
    toolsRequired: c.toolsRequired,
    toolSize: c.toolSize,
    onHand: c.onHand,
    reserved: c.reserved,
    onOrder: c.onOrder,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/models/:id/components", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select()
    .from(componentsTable)
    .where(eq(componentsTable.modelId, id))
    .orderBy(desc(componentsTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/models/:id/components", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = CreateComponentRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid component input" });
    return;
  }

  const [model] = await db
    .select({ id: modelsTable.id })
    .from(modelsTable)
    .where(eq(modelsTable.id, id));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  try {
    const d = parsed.data;
    const [row] = await db
      .insert(componentsTable)
      .values({
        modelId: id,
        code: d.code,
        description: d.description,
        partNumber: d.partNumber,
        meshName: d.meshName?.trim() ? d.meshName : null,
        manufacturer: d.manufacturer ?? null,
        weightKg: d.weightKg ?? null,
        connectionType: d.connectionType ?? null,
        wrenchSize: d.wrenchSize ?? null,
        lengthMm: d.lengthMm ?? null,
        toolsRequired: d.toolsRequired ?? null,
        toolSize: d.toolSize ?? null,
        onHand: d.onHand ?? 0,
        reserved: d.reserved ?? 0,
        onOrder: d.onOrder ?? 0,
        notes: d.notes ?? null,
      })
      .returning();
    res.status(201).json(serialize(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create component");
    res.status(500).json({ error: "Failed to create component" });
  }
});

router.patch("/components/:componentId", async (req: Request, res: Response) => {
  const id = Number(req.params.componentId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateComponentRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const d = parsed.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of [
    "code",
    "description",
    "partNumber",
    "meshName",
    "manufacturer",
    "weightKg",
    "connectionType",
    "wrenchSize",
    "lengthMm",
    "toolsRequired",
    "toolSize",
    "onHand",
    "reserved",
    "onOrder",
    "notes",
  ] as const) {
    if (d[key] !== undefined) {
      // Normalize blank meshName to null so name-based mesh lookups stay clean.
      if (key === "meshName") {
        const v = d.meshName;
        update[key] = typeof v === "string" && v.trim() ? v : null;
      } else {
        update[key] = d[key];
      }
    }
  }
  const [row] = await db
    .update(componentsTable)
    .set(update)
    .where(eq(componentsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(row));
});

router.delete("/components/:componentId", async (req: Request, res: Response) => {
  const id = Number(req.params.componentId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .delete(componentsTable)
    .where(eq(componentsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

export default router;
