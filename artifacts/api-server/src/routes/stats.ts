import { Router, type IRouter, type Request, type Response } from "express";
import { db, componentsTable, modelsTable } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/inventory", async (_req: Request, res: Response) => {
  const [models] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(modelsTable);
  const [comps] = await db
    .select({
      total: sql<number>`count(*)::int`,
      onHand: sql<number>`coalesce(sum(${componentsTable.onHand}),0)::int`,
      reserved: sql<number>`coalesce(sum(${componentsTable.reserved}),0)::int`,
      onOrder: sql<number>`coalesce(sum(${componentsTable.onOrder}),0)::int`,
      lowStock: sql<number>`coalesce(sum(case when (${componentsTable.onHand} - ${componentsTable.reserved}) > 0 and (${componentsTable.onHand} - ${componentsTable.reserved}) <= 2 then 1 else 0 end),0)::int`,
      outOfStock: sql<number>`coalesce(sum(case when (${componentsTable.onHand} - ${componentsTable.reserved}) <= 0 then 1 else 0 end),0)::int`,
    })
    .from(componentsTable);

  res.json({
    totalModels: models?.total ?? 0,
    totalComponents: comps?.total ?? 0,
    totalOnHand: comps?.onHand ?? 0,
    totalReserved: comps?.reserved ?? 0,
    totalOnOrder: comps?.onOrder ?? 0,
    totalAvailable: (comps?.onHand ?? 0) - (comps?.reserved ?? 0),
    lowStockCount: comps?.lowStock ?? 0,
    outOfStockCount: comps?.outOfStock ?? 0,
  });
});

router.get("/stats/by-model", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      modelId: modelsTable.id,
      modelName: modelsTable.name,
      componentCount: sql<number>`coalesce(count(${componentsTable.id}),0)::int`,
      onHand: sql<number>`coalesce(sum(${componentsTable.onHand}),0)::int`,
      available: sql<number>`coalesce(sum(${componentsTable.onHand} - ${componentsTable.reserved}),0)::int`,
    })
    .from(modelsTable)
    .leftJoin(componentsTable, eq(componentsTable.modelId, modelsTable.id))
    .groupBy(modelsTable.id, modelsTable.name);
  res.json(rows);
});

router.get("/stats/by-status", async (_req: Request, res: Response) => {
  const [r] = await db
    .select({
      available: sql<number>`coalesce(sum(case when (${componentsTable.onHand} - ${componentsTable.reserved}) > 2 then 1 else 0 end),0)::int`,
      low: sql<number>`coalesce(sum(case when (${componentsTable.onHand} - ${componentsTable.reserved}) > 0 and (${componentsTable.onHand} - ${componentsTable.reserved}) <= 2 then 1 else 0 end),0)::int`,
      out: sql<number>`coalesce(sum(case when (${componentsTable.onHand} - ${componentsTable.reserved}) <= 0 then 1 else 0 end),0)::int`,
    })
    .from(componentsTable);
  res.json([
    { status: "available", count: r?.available ?? 0 },
    { status: "low", count: r?.low ?? 0 },
    { status: "out", count: r?.out ?? 0 },
  ]);
});

router.get("/stats/recent-activity", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      componentId: componentsTable.id,
      code: componentsTable.code,
      description: componentsTable.description,
      partNumber: componentsTable.partNumber,
      modelName: modelsTable.name,
      updatedAt: componentsTable.updatedAt,
    })
    .from(componentsTable)
    .innerJoin(modelsTable, eq(modelsTable.id, componentsTable.modelId))
    .orderBy(desc(componentsTable.updatedAt))
    .limit(10);
  res.json(
    rows.map((r) => ({
      ...r,
      updatedAt: r.updatedAt.toISOString(),
    })),
  );
});

export default router;
