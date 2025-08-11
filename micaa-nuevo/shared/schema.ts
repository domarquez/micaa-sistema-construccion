import { pgTable, serial, text, integer, decimal, timestamp, boolean, jsonb, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  fullName: text('full_name'),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Materials table
export const materials = pgTable('materials', {
  id: serial('id').primaryKey(),
  description: text('description').notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  category: varchar('category', { length: 100 }),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }),
  currentPrice: decimal('current_price', { precision: 10, scale: 2 }),
  supplierId: integer('supplier_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Activities table
export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  unit: varchar('unit', { length: 20 }).notNull(),
  phaseId: integer('phase_id'),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }),
  createdBy: integer('created_by'),
  originalActivityId: integer('original_activity_id'),
  isUserCreated: boolean('is_user_created').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Activity compositions table
export const activityCompositions = pgTable('activity_compositions', {
  id: serial('id').primaryKey(),
  activityId: integer('activity_id').notNull(),
  materialId: integer('material_id'),
  laborId: integer('labor_id'),
  toolId: integer('tool_id'),
  quantity: decimal('quantity', { precision: 10, scale: 4 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }),
  type: varchar('type', { length: 20 }).notNull() // 'material', 'labor', 'tool'
});

// Companies table
export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  businessType: varchar('business_type', { length: 100 }),
  speciality: varchar('speciality', { length: 100 }),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  website: text('website'),
  logo: text('logo'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Projects table
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  location: text('location'),
  cityId: integer('city_id'),
  userId: integer('user_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  totalBudget: decimal('total_budget', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Budget items table
export const budgetItems = pgTable('budget_items', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  activityId: integer('activity_id').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
  phase: varchar('phase', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// City price factors table
export const cityPriceFactors = pgTable('city_price_factors', {
  id: serial('id').primaryKey(),
  cityName: varchar('city_name', { length: 100 }).notNull(),
  departmentName: varchar('department_name', { length: 100 }),
  materialsFactor: decimal('materials_factor', { precision: 5, scale: 3 }).notNull().default('1.000'),
  laborFactor: decimal('labor_factor', { precision: 5, scale: 3 }).notNull().default('1.000'),
  equipmentFactor: decimal('equipment_factor', { precision: 5, scale: 3 }).notNull().default('1.000'),
  transportFactor: decimal('transport_factor', { precision: 5, scale: 3 }).notNull().default('1.000'),
  isActive: boolean('is_active').notNull().default(true)
});

// Tools table
export const tools = pgTable('tools', {
  id: serial('id').primaryKey(),
  description: text('description').notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  category: varchar('category', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true)
});

// Labor table
export const labor = pgTable('labor', {
  id: serial('id').primaryKey(),
  description: text('description').notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  skillLevel: varchar('skill_level', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true)
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  activities: many(activities)
}));

export const materialsRelations = relations(materials, ({ one, many }) => ({
  supplier: one(companies, {
    fields: [materials.supplierId],
    references: [companies.id]
  }),
  compositions: many(activityCompositions)
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  creator: one(users, {
    fields: [activities.createdBy],
    references: [users.id]
  }),
  originalActivity: one(activities, {
    fields: [activities.originalActivityId],
    references: [activities.id]
  }),
  compositions: many(activityCompositions),
  budgetItems: many(budgetItems)
}));

export const activityCompositionsRelations = relations(activityCompositions, ({ one }) => ({
  activity: one(activities, {
    fields: [activityCompositions.activityId],
    references: [activities.id]
  }),
  material: one(materials, {
    fields: [activityCompositions.materialId],
    references: [materials.id]
  }),
  labor: one(labor, {
    fields: [activityCompositions.laborId],
    references: [labor.id]
  }),
  tool: one(tools, {
    fields: [activityCompositions.toolId],
    references: [tools.id]
  })
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id]
  }),
  budgetItems: many(budgetItems)
}));

export const budgetItemsRelations = relations(budgetItems, ({ one }) => ({
  project: one(projects, {
    fields: [budgetItems.projectId],
    references: [projects.id]
  }),
  activity: one(activities, {
    fields: [budgetItems.activityId],
    references: [activities.id]
  })
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertBudgetItemSchema = createInsertSchema(budgetItems).omit({
  id: true,
  createdAt: true
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Material = typeof materials.$inferSelect;
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type ActivityComposition = typeof activityCompositions.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type BudgetItem = typeof budgetItems.$inferSelect;
export type InsertBudgetItem = z.infer<typeof insertBudgetItemSchema>;
export type CityPriceFactor = typeof cityPriceFactors.$inferSelect;
export type Tool = typeof tools.$inferSelect;
export type Labor = typeof labor.$inferSelect;