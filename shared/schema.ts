import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  originalUrl: text("original_url").notNull(),
  filename: text("filename").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const detectedObjects = pgTable("detected_objects", {
  id: serial("id").primaryKey(),
  imageId: integer("image_id").references(() => images.id).notNull(),
  objectName: text("object_name").notNull(), // chair, table, wall, floor, etc.
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(), // 0.0 to 1.0
  boundingBox: jsonb("bounding_box").notNull(), // {x, y, width, height}
  selectionPath: jsonb("selection_path"), // user's circle/path coordinates
  refinedPath: text("refined_path"), // AI-generated precise SVG path outline
  isUserSelected: boolean("is_user_selected").default(false).notNull(),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
});

export const objectCategories = pgTable("object_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // furniture, flooring, walls, lighting, etc.
  description: text("description"),
  color: text("color").default("#6366f1").notNull(), // hex color for UI display
});

export const objectModifications = pgTable("object_modifications", {
  id: serial("id").primaryKey(),
  objectId: integer("object_id").references(() => detectedObjects.id).notNull(),
  originalImageUrl: text("original_image_url").notNull(),
  modifiedImageUrl: text("modified_image_url").notNull(),
  modificationPrompt: text("modification_prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const imagesRelations = relations(images, ({ many }) => ({
  detectedObjects: many(detectedObjects),
}));

export const detectedObjectsRelations = relations(detectedObjects, ({ one, many }) => ({
  image: one(images, {
    fields: [detectedObjects.imageId],
    references: [images.id],
  }),
  modifications: many(objectModifications),
}));

export const objectModificationsRelations = relations(objectModifications, ({ one }) => ({
  object: one(detectedObjects, {
    fields: [objectModifications.objectId],
    references: [detectedObjects.id],
  }),
}));

// Insert schemas
export const insertImageSchema = createInsertSchema(images).omit({
  id: true,
  uploadedAt: true,
});

export const insertDetectedObjectSchema = createInsertSchema(detectedObjects).omit({
  id: true,
  detectedAt: true,
});

export const insertObjectCategorySchema = createInsertSchema(objectCategories).omit({
  id: true,
});

export const insertObjectModificationSchema = createInsertSchema(objectModifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type Image = typeof images.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;

export type DetectedObject = typeof detectedObjects.$inferSelect;
export type InsertDetectedObject = z.infer<typeof insertDetectedObjectSchema>;

export type ObjectCategory = typeof objectCategories.$inferSelect;
export type InsertObjectCategory = z.infer<typeof insertObjectCategorySchema>;

export type ObjectModification = typeof objectModifications.$inferSelect;
export type InsertObjectModification = z.infer<typeof insertObjectModificationSchema>;
