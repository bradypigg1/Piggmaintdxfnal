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
  meshName: text("mesh_name"),
  manufacturer: text("manufacturer"),
  weightKg: doublePrecision("weight_kg"),
  connectionType: text("connection_type"),
  wrenchSize: text("wrench_size"),
  lengthMm: doublePrecision("length_mm"),
  toolsRequired: text("tools_required"),
  toolSize: text("tool_size"),
  qtyRequired: integer("qty_required").default(1).notNull(),
  onHand: integer("on_hand").default(0).notNull(),
  reserved: integer("reserved").default(0).notNull(),
  onOrder: integer("on_order").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const maintenanceEventsTable = pgTable("maintenance_events", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").references(() => modelsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  durationHours: doublePrecision("duration_hours"),
  status: text("status").default("scheduled").notNull(),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pmDocumentsTable = pgTable("pm_documents", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").references(() => modelsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  partCode: text("part_code"),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  contentType: text("content_type"),
  notes: text("notes"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Model = typeof modelsTable.$inferSelect;
export type NewModel = typeof modelsTable.$inferInsert;
export type Component = typeof componentsTable.$inferSelect;
export type NewComponent = typeof componentsTable.$inferInsert;
export type MaintenanceEvent = typeof maintenanceEventsTable.$inferSelect;
export type NewMaintenanceEvent = typeof maintenanceEventsTable.$inferInsert;
export type PmDocument = typeof pmDocumentsTable.$inferSelect;
export type NewPmDocument = typeof pmDocumentsTable.$inferInsert;
