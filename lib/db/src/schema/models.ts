import { pgTable, serial, text, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";

export const modelsTable = pgTable("models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  projectName: text("project_name"),
  modelName: text("model_name"),
  serialNumber: text("serial_number"),
  revision: text("revision"),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const componentsTable = pgTable("components", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id")
    .notNull()
    .references(() => modelsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  description: text("description").notNull(),
  partNumber: text("part_number").notNull(),
  manufacturer: text("manufacturer"),
  weightKg: doublePrecision("weight_kg"),
  connectionType: text("connection_type"),
  wrenchSize: text("wrench_size"),
  lengthMm: doublePrecision("length_mm"),
  toolsRequired: text("tools_required"),
  toolSize: text("tool_size"),
  onHand: integer("on_hand").default(0).notNull(),
  reserved: integer("reserved").default(0).notNull(),
  onOrder: integer("on_order").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Model = typeof modelsTable.$inferSelect;
export type NewModel = typeof modelsTable.$inferInsert;
export type Component = typeof componentsTable.$inferSelect;
export type NewComponent = typeof componentsTable.$inferInsert;
