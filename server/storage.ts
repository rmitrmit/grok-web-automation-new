import { 
  images, detectedObjects, objectCategories,
  type Image, type InsertImage, type DetectedObject, 
  type InsertDetectedObject, type ObjectCategory, type InsertObjectCategory
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Images
  createImage(image: InsertImage): Promise<Image>;
  getImage(id: number): Promise<Image | undefined>;
  getImages(): Promise<Image[]>;

  // Detected Objects
  createDetectedObject(object: InsertDetectedObject): Promise<DetectedObject>;
  getDetectedObjects(imageId: number): Promise<DetectedObject[]>;
  updateDetectedObject(id: number, updates: Partial<InsertDetectedObject>): Promise<DetectedObject>;

  // Object Categories
  getObjectCategories(): Promise<ObjectCategory[]>;
  createObjectCategory(category: InsertObjectCategory): Promise<ObjectCategory>;
}

export class DatabaseStorage implements IStorage {
  async createImage(insertImage: InsertImage): Promise<Image> {
    const [image] = await db.insert(images).values(insertImage).returning();
    return image;
  }

  async getImage(id: number): Promise<Image | undefined> {
    const [image] = await db.select().from(images).where(eq(images.id, id));
    return image || undefined;
  }

  async getImages(): Promise<Image[]> {
    return await db.select().from(images).orderBy(desc(images.uploadedAt));
  }

  async createDetectedObject(insertObject: InsertDetectedObject): Promise<DetectedObject> {
    const [object] = await db.insert(detectedObjects).values(insertObject).returning();
    return object;
  }

  async getDetectedObjects(imageId: number): Promise<DetectedObject[]> {
    return await db.select().from(detectedObjects)
      .where(eq(detectedObjects.imageId, imageId))
      .orderBy(desc(detectedObjects.confidence));
  }

  async updateDetectedObject(id: number, updates: Partial<InsertDetectedObject>): Promise<DetectedObject> {
    const [object] = await db.update(detectedObjects)
      .set(updates)
      .where(eq(detectedObjects.id, id))
      .returning();
    return object;
  }

  async getObjectCategories(): Promise<ObjectCategory[]> {
    return await db.select().from(objectCategories);
  }

  async createObjectCategory(category: InsertObjectCategory): Promise<ObjectCategory> {
    const [newCategory] = await db.insert(objectCategories).values(category).returning();
    return newCategory;
  }
}

export const storage = new DatabaseStorage();