import { Router, type IRouter, type Request, type Response } from "express";
import { db, modelsTable, componentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateModelBody, UpdateModelBody } from "@workspace/api-zod";

const CreateModelRequest = CreateModelBody;
const UpdateModelRequest = UpdateModelBody;

const router: IRouter = Router();

function serializeModel(m: typeof modelsTable.$inferSelect) {
  return {
    id: m.id,
    name: m.name,
    projectName: m.projectName,
    modelName: m.modelName,
    serialNumber: m.serialNumber,
    revision: m.revision,
    objectPath: m.objectPath,
    fileName: m.fileName,
    fileSize: m.fileSize,
    notes: m.notes,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/models", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(modelsTable)
      .orderBy(desc(modelsTable.createdAt));
    res.json(rows.map(serializeModel));
  } catch (err) {
    req.log.error({ err }, "Failed to list models");
    res.status(500).json({ error: "Failed to list models" });
  }
});

router.post("/models", async (req: Request, res: Response) => {
  const parsed = CreateModelRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid model input" });
    return;
  }
  try {
    const [row] = await db
      .insert(modelsTable)
      .values({
        name: parsed.data.name,
        projectName: parsed.data.projectName ?? null,
        modelName: parsed.data.modelName ?? null,
        serialNumber: parsed.data.serialNumber ?? null,
        revision: parsed.data.revision ?? null,
        objectPath: parsed.data.objectPath,
        fileName: parsed.data.fileName ?? null,
        fileSize: parsed.data.fileSize ?? null,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    res.status(201).json(serializeModel(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create model");
    res.status(500).json({ error: "Failed to create model" });
  }
});

router.get("/models/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(modelsTable).where(eq(modelsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeModel(row));
});

router.patch("/models/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateModelRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const [row] = await db
      .update(modelsTable)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.projectName !== undefined
          ? { projectName: parsed.data.projectName }
          : {}),
        ...(parsed.data.modelName !== undefined
          ? { modelName: parsed.data.modelName }
          : {}),
        ...(parsed.data.serialNumber !== undefined
          ? { serialNumber: parsed.data.serialNumber }
          : {}),
        ...(parsed.data.revision !== undefined
          ? { revision: parsed.data.revision }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      })
      .where(eq(modelsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(serializeModel(row));
  } catch (err) {
    req.log.error({ err }, "Failed to update model");
    res.status(500).json({ error: "Failed to update model" });
  }
});

router.delete("/models/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .delete(modelsTable)
    .where(eq(modelsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

export default router;
