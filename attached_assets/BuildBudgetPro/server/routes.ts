import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import sharp from "sharp";
import { AuthService, requireAuth, requireAdmin, requireSupplier } from "./auth";
import { exportDatabase } from "./export-database";
import { 
  insertMaterialSchema,
  insertProjectSchema,
  insertBudgetSchema,
  insertBudgetItemSchema,
  insertActivityCompositionSchema,
  insertCityPriceFactorSchema,
  insertSupplierCompanySchema,
  insertMaterialSupplierPriceSchema,
  insertUserMaterialPriceSchema,
  insertCompanyAdvertisementSchema,
  insertToolSchema,
  insertLaborCategorySchema,
  insertActivitySchema,
  insertConsultationMessageSchema
} from "@shared/schema";
import { z } from "zod";

// Configurar multer para subida de archivos
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `logo-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

// Configuración específica para PDFs (usando memoria)
const uploadPDF = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max para PDFs
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Servir archivos estáticos (uploads)
  app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });
  app.use('/uploads', express.static(uploadsDir));

  // =============== FILE UPLOAD ROUTES ===============
  
  // Upload logo endpoint
  app.post("/api/upload/logo", upload.single('logo'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se ha subido ningún archivo" });
      }

      const logoUrl = `/uploads/${req.file.filename}`;
      res.json({ logoUrl });
    } catch (error) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ message: "Error al subir el archivo" });
    }
  });

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { user, token } = await AuthService.register(req.body);
      
      // Don't send password in response
      const { password, ...userWithoutPassword } = user;
      
      res.json({ user: userWithoutPassword, token });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Admin registration route
  app.post("/api/auth/register-admin", async (req, res) => {
    try {
      const userData = {
        ...req.body,
        role: 'admin'
      };
      const { user, token } = await AuthService.register(userData);
      
      // Don't send password in response
      const { password, ...userWithoutPassword } = user;
      
      res.json({ user: userWithoutPassword, token });
    } catch (error: any) {
      console.error("Admin registration error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { user, token } = await AuthService.login(req.body);
      
      // Don't send password in response
      const { password, ...userWithoutPassword } = user;
      
      res.json({ user: userWithoutPassword, token });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      const { password, ...userWithoutPassword } = req.user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Error fetching user data" });
    }
  });

  // Statistics
  app.get("/api/statistics", async (req, res) => {
    try {
      const stats = await storage.getStatistics();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  app.get("/api/growth-data", async (req, res) => {
    try {
      const growthData = await storage.getGrowthData();
      res.json(growthData);
    } catch (error) {
      console.error("Error fetching growth data:", error);
      res.status(500).json({ message: "Failed to fetch growth data" });
    }
  });

  // Material Categories
  app.get("/api/material-categories", async (req, res) => {
    try {
      const categories = await storage.getMaterialCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching material categories:", error);
      res.status(500).json({ message: "Failed to fetch material categories" });
    }
  });

  // Construction Phases
  app.get("/api/construction-phases", async (req, res) => {
    try {
      const phases = await storage.getConstructionPhases();
      res.json(phases);
    } catch (error) {
      console.error("Error fetching construction phases:", error);
      res.status(500).json({ message: "Failed to fetch construction phases" });
    }
  });

  // Activities
  app.get("/api/activities", async (req, res) => {
    try {
      const { phaseId, withCompositions } = req.query;
      let activities;
      
      if (phaseId) {
        activities = await storage.getActivitiesByPhase(Number(phaseId));
      } else {
        activities = await storage.getActivities();
      }

      // Filter only activities with compositions if requested
      if (withCompositions === 'true') {
        const { db } = await import("./db");
        const { activityCompositions } = await import("@shared/schema");
        
        const activitiesWithCompositions = await db
          .selectDistinct({ activityId: activityCompositions.activityId })
          .from(activityCompositions);
        
        const compositionActivityIds = new Set(activitiesWithCompositions.map(a => a.activityId));
        activities = activities.filter(activity => compositionActivityIds.has(activity.id));
      }
      
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Admin: Create activity
  app.post("/api/activities", requireAuth, requireAdmin, async (req, res) => {
    try {
      const activityData = insertActivitySchema.parse(req.body);
      const activity = await storage.createActivity(activityData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      console.error("Error creating activity:", error);
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  // Admin: Update activity
  app.put("/api/activities/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const activityData = insertActivitySchema.partial().parse(req.body);
      const activity = await storage.updateActivity(Number(req.params.id), activityData);
      res.json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      console.error("Error updating activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  // Admin: Delete activity
  app.delete("/api/activities/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const activityId = Number(req.params.id);
      
      // Check if activity has budget items
      const budgetItems = await storage.getBudgetItemsByActivity(activityId);
      if (budgetItems.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete activity with existing budget items" 
        });
      }
      
      // Delete compositions first
      await storage.deleteActivityCompositionsByActivity(activityId);
      
      // Delete activity
      await storage.deleteActivity(activityId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });

  // Activity Compositions
  app.get("/api/activity-compositions/:activityId", async (req, res) => {
    try {
      const activityId = Number(req.params.activityId);
      const compositions = await storage.getActivityCompositionsByActivity(activityId);
      res.json(compositions);
    } catch (error) {
      console.error("Error fetching activity compositions:", error);
      res.status(500).json({ message: "Failed to fetch activity compositions" });
    }
  });

  // Materials with personalized prices
  app.get("/api/materials", requireAuth, async (req: any, res) => {
    try {
      const { categoryId, search } = req.query;
      const userId = req.user.id;
      console.log("Materials query params:", { categoryId, search });
      let materials;
      
      if (search) {
        console.log("Searching materials with:", search);
        materials = await storage.searchMaterials(String(search));
      } else if (categoryId) {
        console.log("Filtering by category:", categoryId);
        materials = await storage.getMaterialsWithCustomPricesByCategory(userId, Number(categoryId));
      } else {
        console.log("Getting all materials with custom prices for user:", userId);
        materials = await storage.getMaterialsWithCustomPrices(userId);
      }
      
      console.log("Returning", materials.length, "materials");
      res.json(materials);
    } catch (error) {
      console.error("Error fetching materials:", error);
      res.status(500).json({ message: "Failed to fetch materials" });
    }
  });

  app.get("/api/materials/:id", async (req, res) => {
    try {
      const material = await storage.getMaterial(Number(req.params.id));
      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }
      res.json(material);
    } catch (error) {
      console.error("Error fetching material:", error);
      res.status(500).json({ message: "Failed to fetch material" });
    }
  });

  app.post("/api/materials", async (req, res) => {
    try {
      const materialData = insertMaterialSchema.parse(req.body);
      const material = await storage.createMaterial(materialData);
      res.status(201).json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid material data", errors: error.errors });
      }
      console.error("Error creating material:", error);
      res.status(500).json({ message: "Failed to create material" });
    }
  });

  app.put("/api/materials/:id", async (req, res) => {
    try {
      const materialData = insertMaterialSchema.partial().parse(req.body);
      const material = await storage.updateMaterial(Number(req.params.id), materialData);
      res.json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid material data", errors: error.errors });
      }
      console.error("Error updating material:", error);
      res.status(500).json({ message: "Failed to update material" });
    }
  });

  app.delete("/api/materials/:id", async (req, res) => {
    try {
      await storage.deleteMaterial(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting material:", error);
      res.status(500).json({ message: "Failed to delete material" });
    }
  });

  // Precios personalizados de materiales por usuario
  app.post("/api/materials/:id/custom-price", requireAuth, async (req: any, res) => {
    try {
      const materialId = Number(req.params.id);
      const userId = req.user.id;
      const data = insertUserMaterialPriceSchema.parse({
        ...req.body,
        userId,
        materialId
      });
      
      const customPrice = await storage.createUserMaterialPrice(data);
      res.status(201).json(customPrice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating custom price:", error);
      res.status(500).json({ message: "Failed to create custom price" });
    }
  });

  app.delete("/api/materials/:id/custom-price", requireAuth, async (req: any, res) => {
    try {
      const materialId = Number(req.params.id);
      const userId = req.user.id;
      
      await storage.deleteUserMaterialPrice(userId, materialId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom price:", error);
      res.status(500).json({ message: "Failed to delete custom price" });
    }
  });

  // Endpoints públicos (sin autenticación requerida)
  app.get("/api/public/materials", async (req, res) => {
    try {
      const materials = await storage.getMaterialsPublic();
      res.json(materials);
    } catch (error) {
      console.error("Error fetching public materials:", error);
      res.status(500).json({ message: "Failed to fetch materials" });
    }
  });

  app.get("/api/public/material-categories", async (req, res) => {
    try {
      const categories = await storage.getMaterialCategoriesPublic();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching public categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/public/suppliers", async (req, res) => {
    try {
      const suppliers = await storage.getSupplierCompaniesPublic();
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching public suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  // Sistema de publicidad (get random active advertisement)
  app.get("/api/public/advertisement", async (req, res) => {
    try {
      const randomAd = await storage.getRandomActiveAdvertisement();
      res.json(randomAd);
    } catch (error) {
      console.error("Error fetching advertisement:", error);
      res.status(500).json({ message: "Failed to fetch advertisement" });
    }
  });

  // Get dual advertisements for side-by-side display
  app.get("/api/public/dual-advertisements", async (req, res) => {
    try {
      const dualAds = await storage.getDualRandomActiveAdvertisements();
      res.json(dualAds);
    } catch (error) {
      console.error("Error fetching dual advertisements:", error);
      res.status(500).json({ message: "Failed to fetch dual advertisements" });
    }
  });



  // Projects
  app.get("/api/projects", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const projects = await storage.getProjectsByUser(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(Number(req.params.id));
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", requireAuth, async (req: any, res) => {
    try {
      console.log("Datos recibidos para crear proyecto:", req.body);
      
      const { startDate, ...otherData } = req.body;
      const projectData = {
        ...otherData,
        userId: req.user.id,
        startDate: startDate ? new Date(startDate) : null
      };
      
      console.log("Datos del proyecto antes de validar:", projectData);
      
      const validatedData = insertProjectSchema.parse(projectData);
      console.log("Datos validados:", validatedData);
      
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Error de validación Zod:", error.errors);
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const projectData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(Number(req.params.id), projectData);
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProject(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Budgets
  app.get("/api/budgets", requireAuth, async (req: any, res) => {
    try {
      const { projectId } = req.query;
      const userId = req.user.id;
      let budgets;
      
      if (projectId) {
        budgets = await storage.getBudgetsByProject(Number(projectId));
      } else {
        budgets = await storage.getBudgetsByUser(userId);
      }
      
      res.json(budgets);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.get("/api/budgets/:id", async (req, res) => {
    try {
      const budget = await storage.getBudget(Number(req.params.id));
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      res.json(budget);
    } catch (error) {
      console.error("Error fetching budget:", error);
      res.status(500).json({ message: "Failed to fetch budget" });
    }
  });

  app.post("/api/budgets", async (req, res) => {
    try {
      console.log("Creating budget with data:", req.body);
      const budgetData = insertBudgetSchema.parse(req.body);
      const budget = await storage.createBudget(budgetData);
      res.status(201).json(budget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Budget validation error:", error.errors);
        return res.status(400).json({ message: "Invalid budget data", errors: error.errors });
      }
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  // Budget Items
  app.get("/api/budgets/:budgetId/items", async (req, res) => {
    try {
      const items = await storage.getBudgetItems(Number(req.params.budgetId));
      res.json(items);
    } catch (error) {
      console.error("Error fetching budget items:", error);
      res.status(500).json({ message: "Failed to fetch budget items" });
    }
  });

  app.get("/api/budget-items", async (req, res) => {
    try {
      const { budgetId } = req.query;
      if (!budgetId) {
        return res.status(400).json({ message: "budgetId parameter is required" });
      }
      const items = await storage.getBudgetItems(Number(budgetId));
      res.json(items);
    } catch (error) {
      console.error("Error fetching budget items:", error);
      res.status(500).json({ message: "Failed to fetch budget items" });
    }
  });

  app.post("/api/budget-items", async (req, res) => {
    try {
      console.log("Creating budget item with data:", req.body);
      const itemData = insertBudgetItemSchema.parse(req.body);
      const item = await storage.createBudgetItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Budget item validation error:", error.errors);
        return res.status(400).json({ message: "Invalid budget item data", errors: error.errors });
      }
      console.error("Error creating budget item:", error);
      res.status(500).json({ message: "Failed to create budget item" });
    }
  });

  app.post("/api/budgets/:budgetId/items", async (req, res) => {
    try {
      const itemData = insertBudgetItemSchema.parse({
        ...req.body,
        budgetId: Number(req.params.budgetId)
      });
      const item = await storage.createBudgetItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid budget item data", errors: error.errors });
      }
      console.error("Error creating budget item:", error);
      res.status(500).json({ message: "Failed to create budget item" });
    }
  });

  app.put("/api/budget-items/:id", async (req, res) => {
    try {
      const itemData = insertBudgetItemSchema.partial().parse(req.body);
      const item = await storage.updateBudgetItem(Number(req.params.id), itemData);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid budget item data", errors: error.errors });
      }
      console.error("Error updating budget item:", error);
      res.status(500).json({ message: "Failed to update budget item" });
    }
  });

  app.delete("/api/budget-items/:id", async (req, res) => {
    try {
      await storage.deleteBudgetItem(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting budget item:", error);
      res.status(500).json({ message: "Failed to delete budget item" });
    }
  });

  // Import materials from SQL file
  app.post("/api/import-materials", async (req, res) => {
    try {
      const { importMaterialsFromSQL } = await import("./import-materials");
      const result = await importMaterialsFromSQL();
      res.json(result);
    } catch (error) {
      console.error("Error importing materials:", error);
      res.status(500).json({ message: "Failed to import materials" });
    }
  });

  // Import complete data from SQL file (empresas, herramientas, mano de obra)
  app.post("/api/import-complete-data", requireAdmin, async (req, res) => {
    try {
      const { importCompleteDataFromSQL } = await import("./import-complete-data");
      const result = await importCompleteDataFromSQL();
      res.json(result);
    } catch (error) {
      console.error("Error importing complete data:", error);
      res.status(500).json({ message: "Failed to import complete data" });
    }
  });

  // Activity Compositions
  app.get("/api/activity-compositions", requireAuth, async (req, res) => {
    try {
      const compositions = await storage.getActivityCompositions();
      res.json(compositions);
    } catch (error) {
      console.error("Error fetching activity compositions:", error);
      res.status(500).json({ message: "Failed to fetch activity compositions" });
    }
  });

  app.get("/api/activities/:activityId/compositions", async (req, res) => {
    try {
      const compositions = await storage.getActivityCompositionsByActivity(Number(req.params.activityId));
      res.json(compositions);
    } catch (error) {
      console.error("Error fetching activity compositions:", error);
      res.status(500).json({ message: "Failed to fetch activity compositions" });
    }
  });

  app.post("/api/activity-compositions", requireAuth, async (req, res) => {
    try {
      console.log("Creating activity composition with data:", req.body);
      const compositionData = insertActivityCompositionSchema.parse(req.body);
      const composition = await storage.createActivityComposition(compositionData);
      res.status(201).json(composition);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Activity composition validation error:", error.errors);
        return res.status(400).json({ message: "Invalid composition data", errors: error.errors });
      }
      console.error("Error creating activity composition:", error);
      res.status(500).json({ message: "Failed to create activity composition" });
    }
  });

  app.delete("/api/activity-compositions/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteActivityComposition(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting activity composition:", error);
      res.status(500).json({ message: "Failed to delete activity composition" });
    }
  });

  // Get compositions for a specific activity
  app.get("/api/activities/:id/compositions", async (req, res) => {
    try {
      const activityId = Number(req.params.id);
      const compositions = await storage.getActivityCompositionsByActivity(activityId);
      res.json(compositions);
    } catch (error) {
      console.error("Error fetching activity compositions:", error);
      res.status(500).json({ message: "Failed to fetch activity compositions" });
    }
  });

  // Get APU calculation for a specific activity
  app.get("/api/activities/:id/apu-calculation", async (req, res) => {
    try {
      const activityId = Number(req.params.id);
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      
      const { calculateAPUPrice } = await import("./apu-calculator");
      const calculation = await calculateAPUPrice(activityId, projectId);
      
      res.json(calculation);
    } catch (error) {
      console.error("Error calculating APU:", error);
      res.status(500).json({ message: "Failed to calculate APU" });
    }
  });

  // Get composition breakdown for a specific activity (for PDF generation)
  app.get("/api/activities/:id/composition", async (req, res) => {
    try {
      const activityId = Number(req.params.id);
      const compositions = await storage.getActivityCompositionsByActivity(activityId);
      
      // Agrupar por tipo para el PDF
      const materials = compositions.filter(c => c.type === 'material');
      const labor = compositions.filter(c => c.type === 'labor');
      const tools = compositions.filter(c => c.type === 'tool');
      
      res.json({
        materials: materials.map(m => ({
          description: m.description,
          unit: m.unit,
          quantity: parseFloat(m.quantity),
          unitPrice: parseFloat(m.unitCost)
        })),
        labor: labor.map(l => ({
          description: l.description,
          unit: l.unit,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitCost)
        })),
        tools: tools.map(t => ({
          description: t.description,
          unit: t.unit,
          quantity: parseFloat(t.quantity),
          unitPrice: parseFloat(t.unitCost)
        }))
      });
    } catch (error) {
      console.error("Error fetching activity composition:", error);
      res.status(500).json({ message: "Failed to fetch activity composition" });
    }
  });

  // Price settings routes (Admin only)
  app.get("/api/price-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getPriceSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error getting price settings:", error);
      res.status(500).json({ message: "Failed to get price settings" });
    }
  });

  app.put("/api/price-settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.updatePriceSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating price settings:", error);
      res.status(500).json({ message: "Failed to update price settings" });
    }
  });

  app.post("/api/apply-price-adjustment", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { factor, updatedBy } = req.body;
      const result = await storage.applyGlobalPriceAdjustment(factor, updatedBy);
      res.json(result);
    } catch (error) {
      console.error("Error applying price adjustment:", error);
      res.status(500).json({ message: "Failed to apply price adjustment" });
    }
  });

  // Admin material price update
  app.put("/api/admin/materials/:id/price", requireAuth, requireAdmin, async (req, res) => {
    try {
      const materialId = Number(req.params.id);
      const { price } = req.body;
      
      if (!price || price <= 0) {
        return res.status(400).json({ message: "Invalid price" });
      }

      const updatedMaterial = await storage.updateMaterialPrice(materialId, price);
      res.json(updatedMaterial);
    } catch (error) {
      console.error("Error updating material price:", error);
      res.status(500).json({ message: "Failed to update material price" });
    }
  });

  // Admin activity phase update
  app.put("/api/admin/activities/:id/phase", requireAuth, requireAdmin, async (req, res) => {
    try {
      const activityId = Number(req.params.id);
      const { phaseId } = req.body;
      
      if (!phaseId) {
        return res.status(400).json({ message: "Phase ID is required" });
      }

      const updatedActivity = await storage.updateActivityPhase(activityId, phaseId);
      res.json(updatedActivity);
    } catch (error) {
      console.error("Error updating activity phase:", error);
      res.status(500).json({ message: "Failed to update activity phase" });
    }
  });

  // User material prices (personalized pricing)
  app.post("/api/user-material-prices", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const validatedData = insertUserMaterialPriceSchema.parse({
        ...req.body,
        userId
      });

      const userPrice = await storage.createUserMaterialPrice(validatedData);
      res.json(userPrice);
    } catch (error) {
      console.error("Error creating user material price:", error);
      res.status(500).json({ message: "Failed to save material price" });
    }
  });

  app.get("/api/user-material-prices", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const userPrices = await storage.getUserMaterialPrices(userId);
      res.json(userPrices);
    } catch (error) {
      console.error("Error getting user material prices:", error);
      res.status(500).json({ message: "Failed to get material prices" });
    }
  });

  app.put("/api/user-material-prices/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const priceId = Number(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { price } = req.body;
      if (!price || price <= 0) {
        return res.status(400).json({ message: "Invalid price" });
      }

      const updatedPrice = await storage.updateUserMaterialPrice(priceId, userId, price);
      res.json(updatedPrice);
    } catch (error) {
      console.error("Error updating user material price:", error);
      res.status(500).json({ message: "Failed to update material price" });
    }
  });

  app.delete("/api/user-material-prices/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const priceId = Number(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      await storage.deleteUserMaterialPrice(priceId, userId);
      res.json({ message: "Material price deleted successfully" });
    } catch (error) {
      console.error("Error deleting user material price:", error);
      res.status(500).json({ message: "Failed to delete material price" });
    }
  });

  // Bulk move activities
  app.post("/api/admin/activities/bulk-move", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { fromPhaseId, toPhaseId, keyword } = req.body;
      
      if (!fromPhaseId || !toPhaseId || !keyword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const result = await storage.bulkMoveActivities(fromPhaseId, toPhaseId, keyword);
      res.json(result);
    } catch (error) {
      console.error("Error bulk moving activities:", error);
      res.status(500).json({ message: "Failed to bulk move activities" });
    }
  });

  // APU Import and Calculation
  app.post("/api/import-apu", requireAuth, async (req, res) => {
    try {
      const { importAPUCompositions } = await import("./import-apu");
      
      // Configurar timeout extendido para importación masiva
      req.setTimeout(30 * 60 * 1000); // 30 minutos
      res.setTimeout(30 * 60 * 1000);
      
      const result = await importAPUCompositions();
      res.json(result);
    } catch (error: any) {
      console.error("Error importing APU compositions:", error);
      res.status(500).json({ 
        message: "Failed to import APU compositions", 
        error: error?.message || "Error desconocido"
      });
    }
  });

  // Reorganize existing activities by phase
  app.post("/api/reorganize-activities", requireAuth, async (req, res) => {
    try {
      const { reorganizeExistingActivities } = await import("./reorganize-activities");
      const result = await reorganizeExistingActivities();
      res.json(result);
    } catch (error) {
      console.error("Error reorganizing activities:", error);
      res.status(500).json({ 
        message: "Error reorganizing activities",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/activities/:activityId/calculate-price", requireAuth, async (req, res) => {
    try {
      const { calculateActivityPrice } = await import("./import-apu");
      const price = await calculateActivityPrice(Number(req.params.activityId));
      res.json({ price });
    } catch (error) {
      console.error("Error calculating activity price:", error);
      res.status(500).json({ message: "Failed to calculate activity price" });
    }
  });

  // Calculate and update all activity prices
  app.post("/api/calculate-all-prices", requireAdmin, async (req, res) => {
    try {
      const { updateActivityPricesFromCompositions } = await import("./price-calculator");
      const result = await updateActivityPricesFromCompositions();
      res.json(result);
    } catch (error) {
      console.error("Error calculating all activity prices:", error);
      res.status(500).json({ 
        message: "Error calculating activity prices",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // City Price Factors
  app.get("/api/city-price-factors", requireAuth, async (req, res) => {
    try {
      const factors = await storage.getCityPriceFactors();
      res.json(factors);
    } catch (error) {
      console.error("Error fetching city price factors:", error);
      res.status(500).json({ message: "Failed to fetch city price factors" });
    }
  });

  app.get("/api/city-price-factors/:city", requireAuth, async (req, res) => {
    try {
      const { city } = req.params;
      const { country = "Bolivia" } = req.query;
      const factor = await storage.getCityPriceFactor(city, country as string);
      if (!factor) {
        return res.status(404).json({ message: "City price factor not found" });
      }
      res.json(factor);
    } catch (error) {
      console.error("Error fetching city price factor:", error);
      res.status(500).json({ message: "Failed to fetch city price factor" });
    }
  });

  app.post("/api/city-price-factors", requireAdmin, async (req, res) => {
    try {
      const factorData = insertCityPriceFactorSchema.parse(req.body);
      const factor = await storage.createCityPriceFactor(factorData);
      res.status(201).json(factor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating city price factor:", error);
      res.status(500).json({ message: "Failed to create city price factor" });
    }
  });

  app.patch("/api/city-price-factors/:id", requireAdmin, async (req, res) => {
    try {
      const factorData = insertCityPriceFactorSchema.partial().parse(req.body);
      const factor = await storage.updateCityPriceFactor(Number(req.params.id), factorData);
      res.json(factor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating city price factor:", error);
      res.status(500).json({ message: "Failed to update city price factor" });
    }
  });

  app.delete("/api/city-price-factors/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCityPriceFactor(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting city price factor:", error);
      res.status(500).json({ message: "Failed to delete city price factor" });
    }
  });

  // Update user location
  app.patch("/api/users/:id/location", requireAuth, async (req, res) => {
    try {
      const { city, country = "Bolivia" } = req.body;
      if (!city) {
        return res.status(400).json({ message: "City is required" });
      }
      const user = await storage.updateUserLocation(Number(req.params.id), city, country);
      res.json(user);
    } catch (error) {
      console.error("Error updating user location:", error);
      res.status(500).json({ message: "Failed to update user location" });
    }
  });

  // Geographic price adjustments
  app.post("/api/calculate-geographic-adjustment", requireAuth, async (req, res) => {
    try {
      const { basePrice, city, country = "Bolivia" } = req.body;
      if (!basePrice || !city) {
        return res.status(400).json({ message: "Base price and city are required" });
      }
      
      const { applyGeographicPriceAdjustment } = await import("./city-price-calculator");
      const adjustment = await applyGeographicPriceAdjustment(basePrice, city, country);
      
      if (!adjustment) {
        return res.status(404).json({ message: "City price factor not found" });
      }
      
      res.json(adjustment);
    } catch (error) {
      console.error("Error calculating geographic adjustment:", error);
      res.status(500).json({ message: "Failed to calculate geographic adjustment" });
    }
  });

  app.get("/api/city-price-info/:city", requireAuth, async (req, res) => {
    try {
      const { city } = req.params;
      const { country = "Bolivia" } = req.query;
      
      const { getCityPriceInfo } = await import("./city-price-calculator");
      const info = await getCityPriceInfo(city, country as string);
      
      if (!info) {
        return res.status(404).json({ message: "City price information not found" });
      }
      
      res.json(info);
    } catch (error) {
      console.error("Error fetching city price info:", error);
      res.status(500).json({ message: "Failed to fetch city price info" });
    }
  });

  // =============== SUPPLIER COMPANIES ROUTES ===============

  // Get all supplier companies
  app.get("/api/supplier-companies", async (req, res) => {
    try {
      const companies = await storage.getSupplierCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching supplier companies:", error);
      res.status(500).json({ message: "Failed to fetch supplier companies" });
    }
  });

  // Get supplier company by ID
  app.get("/api/supplier-companies/:id", async (req, res) => {
    try {
      const company = await storage.getSupplierCompany(Number(req.params.id));
      if (!company) {
        return res.status(404).json({ message: "Supplier company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Error fetching supplier company:", error);
      res.status(500).json({ message: "Failed to fetch supplier company" });
    }
  });

  // Get current user's supplier company
  app.get("/api/my-supplier-company", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const company = await storage.getSupplierCompanyByUser(userId);
      res.json(company || null);
    } catch (error) {
      console.error("Error fetching user's supplier company:", error);
      res.status(500).json({ message: "Failed to fetch supplier company" });
    }
  });

  // Create supplier company
  app.post("/api/supplier-companies", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Check if user already has a supplier company
      const existingCompany = await storage.getSupplierCompanyByUser(userId);
      if (existingCompany) {
        return res.status(400).json({ message: "User already has a supplier company" });
      }

      const companyData = insertSupplierCompanySchema.parse({
        ...req.body,
        userId
      });
      
      const company = await storage.createSupplierCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid company data", errors: error.errors });
      }
      console.error("Error creating supplier company:", error);
      res.status(500).json({ message: "Failed to create supplier company" });
    }
  });

  // Update supplier company
  app.put("/api/supplier-companies/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const companyId = Number(req.params.id);
      
      // Check if user owns this company
      const existingCompany = await storage.getSupplierCompany(companyId);
      if (!existingCompany || existingCompany.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const companyData = insertSupplierCompanySchema.partial().parse(req.body);
      const company = await storage.updateSupplierCompany(companyId, companyData);
      res.json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid company data", errors: error.errors });
      }
      console.error("Error updating supplier company:", error);
      res.status(500).json({ message: "Failed to update supplier company" });
    }
  });

  // =============== MATERIAL SUPPLIER PRICES ROUTES ===============

  // Get supplier prices for a material
  app.get("/api/materials/:materialId/supplier-prices", async (req, res) => {
    try {
      const materialId = Number(req.params.materialId);
      const prices = await storage.getMaterialSupplierPrices(materialId);
      res.json(prices);
    } catch (error) {
      console.error("Error fetching material supplier prices:", error);
      res.status(500).json({ message: "Failed to fetch supplier prices" });
    }
  });

  // Get supplier's material prices
  app.get("/api/supplier-companies/:supplierId/prices", async (req, res) => {
    try {
      const supplierId = Number(req.params.supplierId);
      const prices = await storage.getSupplierPrices(supplierId);
      res.json(prices);
    } catch (error) {
      console.error("Error fetching supplier prices:", error);
      res.status(500).json({ message: "Failed to fetch supplier prices" });
    }
  });

  // Create material supplier price
  app.post("/api/material-supplier-prices", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Get user's supplier company
      const company = await storage.getSupplierCompanyByUser(userId);
      if (!company) {
        return res.status(403).json({ message: "User must have a supplier company to add prices" });
      }

      const priceData = insertMaterialSupplierPriceSchema.parse({
        ...req.body,
        supplierId: company.id
      });
      
      const price = await storage.createMaterialSupplierPrice(priceData);
      res.status(201).json(price);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid price data", errors: error.errors });
      }
      console.error("Error creating material supplier price:", error);
      res.status(500).json({ message: "Failed to create supplier price" });
    }
  });

  // Update material supplier price
  app.put("/api/material-supplier-prices/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const priceId = Number(req.params.id);
      
      // Get user's supplier company
      const company = await storage.getSupplierCompanyByUser(userId);
      if (!company) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify this price belongs to the user's company
      const supplierPrices = await storage.getSupplierPrices(company.id);
      const existingPrice = supplierPrices.find(p => p.id === priceId);
      if (!existingPrice) {
        return res.status(403).json({ message: "Access denied" });
      }

      const priceData = insertMaterialSupplierPriceSchema.partial().parse(req.body);
      const price = await storage.updateMaterialSupplierPrice(priceId, priceData);
      res.json(price);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid price data", errors: error.errors });
      }
      console.error("Error updating material supplier price:", error);
      res.status(500).json({ message: "Failed to update supplier price" });
    }
  });

  // Delete material supplier price
  app.delete("/api/material-supplier-prices/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const priceId = Number(req.params.id);
      
      // Get user's supplier company
      const company = await storage.getSupplierCompanyByUser(userId);
      if (!company) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify this price belongs to the user's company
      const supplierPrices = await storage.getSupplierPrices(company.id);
      const existingPrice = supplierPrices.find(p => p.id === priceId);
      if (!existingPrice) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteMaterialSupplierPrice(priceId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting material supplier price:", error);
      res.status(500).json({ message: "Failed to delete supplier price" });
    }
  });

  // =============== SUPPLIER QUOTES ROUTES ===============
  
  // Get supplier's quotes
  app.get("/api/supplier/quotes", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Get user's supplier company
      const company = await storage.getSupplierCompanyByUser(userId);
      if (!company) {
        return res.status(403).json({ message: "Access denied - Not a supplier" });
      }

      const quotes = await storage.getSupplierPrices(company.id);
      
      // Add status field for frontend compatibility
      const quotesWithStatus = quotes.map(quote => ({
        ...quote,
        status: quote.isActive ? 'active' : 'inactive'
      }));
      
      res.json(quotesWithStatus);
    } catch (error) {
      console.error("Error fetching supplier quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  // Create supplier quote
  app.post("/api/supplier/quotes", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Get user's supplier company
      const company = await storage.getSupplierCompanyByUser(userId);
      if (!company) {
        return res.status(403).json({ message: "Access denied - Not a supplier" });
      }

      const quoteData = insertMaterialSupplierPriceSchema.parse({
        ...req.body,
        supplierId: company.id,
        currency: req.body.currency || "BOB",
        minimumQuantity: req.body.minimumQuantity || "1.00",
        leadTimeDays: req.body.leadTimeDays || 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
      });
      
      const quote = await storage.createMaterialSupplierPrice(quoteData);
      res.status(201).json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Validation errors:", error.errors);
        console.log("Request body:", req.body);
        return res.status(400).json({ message: "Invalid quote data", errors: error.errors });
      }
      console.error("Error creating supplier quote:", error);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  // =============== MARKETPLACE ROUTES ===============
  
  // Get materials with supplier offers
  app.get("/api/marketplace/materials", async (req, res) => {
    try {
      const { category, search } = req.query;
      
      // Get materials with their supplier prices using storage
      const allMaterials = await storage.getMaterials();
      const allCategories = await storage.getMaterialCategories();
      const allCompanies = await storage.getSupplierCompanies();
      
      // Get all active supplier prices
      const allSupplierPrices = await Promise.all(
        allCompanies.map(async (company) => {
          const prices = await storage.getSupplierPrices(company.id);
          return prices.map(price => ({
            ...price,
            supplier: company
          }));
        })
      );
      
      const flatPrices = allSupplierPrices.flat();

      // Filter materials based on category and search
      let filteredMaterials = allMaterials;
      
      if (category && category !== 'all') {
        filteredMaterials = filteredMaterials.filter(m => m.categoryId === Number(category));
      }
      
      if (search) {
        filteredMaterials = filteredMaterials.filter(m => 
          m.name.toLowerCase().includes(search.toString().toLowerCase())
        );
      }

      // Group materials with their offers
      const materialsWithOffers = filteredMaterials.map(material => {
        const category = allCategories.find(c => c.id === material.categoryId);
        const materialOffers = flatPrices.filter(price => price.materialId === material.id);
        
        return {
          id: material.id,
          name: material.name,
          category: category,
          price: material.price,
          unit: material.unit,
          offers: materialOffers.map(offer => ({
            id: offer.id,
            price: offer.price,
            supplier: {
              id: offer.supplier.id,
              companyName: offer.supplier.companyName,
              city: offer.supplier.city,
              membershipType: offer.supplier.membershipType,
              rating: offer.supplier.rating ? parseFloat(offer.supplier.rating.toString()) : 0,
              speciality: offer.supplier.speciality,
              phone: offer.supplier.phone,
              website: offer.supplier.website
            },
            validUntil: offer.validUntil,
            leadTimeDays: offer.leadTimeDays || 0,
            minimumQuantity: offer.minimumQuantity || "1.00"
          })).sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
        };
      });

      res.json(materialsWithOffers);
    } catch (error) {
      console.error("Error fetching marketplace materials:", error);
      res.status(500).json({ message: "Failed to fetch marketplace materials" });
    }
  });

  // =============== TOOLS ROUTES ===============
  
  app.get("/api/tools", async (req, res) => {
    try {
      const tools = await storage.getTools();
      res.json(tools);
    } catch (error) {
      console.error("Error fetching tools:", error);
      res.status(500).json({ message: "Failed to fetch tools" });
    }
  });

  app.get("/api/tools/:id", async (req, res) => {
    try {
      const tool = await storage.getTool(Number(req.params.id));
      if (!tool) {
        return res.status(404).json({ message: "Tool not found" });
      }
      res.json(tool);
    } catch (error) {
      console.error("Error fetching tool:", error);
      res.status(500).json({ message: "Failed to fetch tool" });
    }
  });

  app.post("/api/tools", requireAuth, async (req, res) => {
    try {
      const toolData = insertToolSchema.parse(req.body);
      const tool = await storage.createTool(toolData);
      res.status(201).json(tool);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid tool data", errors: error.errors });
      }
      console.error("Error creating tool:", error);
      res.status(500).json({ message: "Failed to create tool" });
    }
  });

  app.put("/api/tools/:id", requireAuth, async (req, res) => {
    try {
      const toolData = insertToolSchema.partial().parse(req.body);
      const tool = await storage.updateTool(Number(req.params.id), toolData);
      res.json(tool);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid tool data", errors: error.errors });
      }
      console.error("Error updating tool:", error);
      res.status(500).json({ message: "Failed to update tool" });
    }
  });

  app.delete("/api/tools/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTool(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tool:", error);
      res.status(500).json({ message: "Failed to delete tool" });
    }
  });

  // =============== LABOR CATEGORIES ROUTES ===============
  
  app.get("/api/labor-categories", async (req, res) => {
    try {
      const laborCategories = await storage.getLaborCategories();
      res.json(laborCategories);
    } catch (error) {
      console.error("Error fetching labor categories:", error);
      res.status(500).json({ message: "Failed to fetch labor categories" });
    }
  });

  app.get("/api/labor-categories/:id", async (req, res) => {
    try {
      const laborCategory = await storage.getLaborCategory(Number(req.params.id));
      if (!laborCategory) {
        return res.status(404).json({ message: "Labor category not found" });
      }
      res.json(laborCategory);
    } catch (error) {
      console.error("Error fetching labor category:", error);
      res.status(500).json({ message: "Failed to fetch labor category" });
    }
  });

  app.post("/api/labor-categories", requireAuth, async (req, res) => {
    try {
      const laborData = insertLaborCategorySchema.parse(req.body);
      const laborCategory = await storage.createLaborCategory(laborData);
      res.status(201).json(laborCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid labor category data", errors: error.errors });
      }
      console.error("Error creating labor category:", error);
      res.status(500).json({ message: "Failed to create labor category" });
    }
  });

  app.put("/api/labor-categories/:id", requireAuth, async (req, res) => {
    try {
      const laborData = insertLaborCategorySchema.partial().parse(req.body);
      const laborCategory = await storage.updateLaborCategory(Number(req.params.id), laborData);
      res.json(laborCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid labor category data", errors: error.errors });
      }
      console.error("Error updating labor category:", error);
      res.status(500).json({ message: "Failed to update labor category" });
    }
  });

  app.delete("/api/labor-categories/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteLaborCategory(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting labor category:", error);
      res.status(500).json({ message: "Failed to delete labor category" });
    }
  });

  // =============== COMPANY ADVERTISEMENTS ROUTES ===============

  // Get company's advertisements
  app.get("/api/advertisements", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Get user's supplier company
      const company = await storage.getSupplierCompanyByUser(userId);
      if (!company) {
        return res.status(404).json({ message: "No supplier company found for user" });
      }
      
      const advertisements = await storage.getCompanyAdvertisements(company.id);
      res.json(advertisements);
    } catch (error) {
      console.error("Error fetching advertisements:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  // Create advertisement
  app.post("/api/advertisements", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Get user's supplier company
      const company = await storage.getSupplierCompanyByUser(userId);
      if (!company) {
        return res.status(404).json({ message: "No supplier company found for user" });
      }
      
      console.log("Creating advertisement with data:", {
        ...req.body,
        supplierId: company.id
      });
      
      const adData = insertCompanyAdvertisementSchema.parse({
        ...req.body,
        supplierId: company.id
      });
      
      const advertisement = await storage.createCompanyAdvertisement(adData);
      res.status(201).json(advertisement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Advertisement validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid advertisement data", errors: error.errors });
      }
      console.error("Error creating advertisement:", error);
      res.status(500).json({ message: "Failed to create advertisement" });
    }
  });

  // Update advertisement
  app.put("/api/advertisements/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const adId = Number(req.params.id);
      
      // Get user's supplier company
      const company = await storage.getSupplierCompanyByUser(userId);
      if (!company) {
        return res.status(404).json({ message: "No supplier company found for user" });
      }
      
      // Check if advertisement belongs to user's company
      const existingAd = await storage.getCompanyAdvertisement(adId);
      if (!existingAd || existingAd.supplierId !== company.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const adData = insertCompanyAdvertisementSchema.partial().parse(req.body);
      const advertisement = await storage.updateCompanyAdvertisement(adId, adData);
      res.json(advertisement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid advertisement data", errors: error.errors });
      }
      console.error("Error updating advertisement:", error);
      res.status(500).json({ message: "Failed to update advertisement" });
    }
  });

  // Delete advertisement
  app.delete("/api/advertisements/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const adId = Number(req.params.id);
      
      // Get user's supplier company
      const company = await storage.getSupplierCompanyByUser(userId);
      if (!company) {
        return res.status(404).json({ message: "No supplier company found for user" });
      }
      
      // Check if advertisement belongs to user's company
      const existingAd = await storage.getCompanyAdvertisement(adId);
      if (!existingAd || existingAd.supplierId !== company.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteCompanyAdvertisement(adId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting advertisement:", error);
      res.status(500).json({ message: "Failed to delete advertisement" });
    }
  });

  // Update advertisement statistics
  app.post("/api/advertisements/:id/view", async (req, res) => {
    try {
      const adId = Number(req.params.id);
      await storage.incrementAdvertisementViews(adId);
      res.status(200).json({ message: "View count updated" });
    } catch (error) {
      console.error("Error updating advertisement views:", error);
      res.status(500).json({ message: "Failed to update view count" });
    }
  });

  app.post("/api/advertisements/:id/click", async (req, res) => {
    try {
      const adId = Number(req.params.id);
      await storage.incrementAdvertisementClicks(adId);
      res.status(200).json({ message: "Click count updated" });
    } catch (error) {
      console.error("Error updating advertisement clicks:", error);
      res.status(500).json({ message: "Failed to update click count" });
    }
  });

  // Upload and process advertisement images
  app.post("/api/upload-advertisement-image", requireAuth, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const userId = (req as any).user.id;
      
      // Get user's supplier company
      const company = await storage.getSupplierCompanyByUser(userId);
      if (!company) {
        return res.status(404).json({ message: "No supplier company found for user" });
      }

      const originalPath = req.file.path;
      const timestamp = Date.now();
      const filename = `ad-${company.id}-${timestamp}.jpg`;
      const outputPath = path.join(uploadsDir, filename);

      // Process image: resize to 400x400 square format with smart crop
      await sharp(originalPath)
        .resize(400, 400, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({
          quality: 85,
          progressive: true
        })
        .toFile(outputPath);

      // Delete the original uploaded file
      fs.unlinkSync(originalPath);

      // Return the URL for the processed image
      const imageUrl = `/uploads/${filename}`;
      res.json({ 
        imageUrl,
        message: "Image uploaded and processed successfully"
      });

    } catch (error) {
      console.error("Error processing advertisement image:", error);
      
      // Clean up files on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ message: "Failed to process image" });
    }
  });

  // PDF text extraction using pdfjs-dist
  app.post("/api/extract-pdf-text", requireAuth, uploadPDF.single('pdf'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó archivo PDF" });
      }

      console.log("Processing PDF file:", req.file.originalname, "Size:", req.file.size);
      
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
        
        // Configurar worker
        pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.js';
        
        // Cargar el PDF
        const loadingTask = pdfjs.getDocument({ data: req.file.buffer });
        const pdf = await loadingTask.promise;
        
        console.log(`PDF loaded. Pages: ${pdf.numPages}`);
        
        let fullText = '';
        
        // Extraer texto de todas las páginas
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText) {
            fullText += pageText + '\n';
          }
        }
        
        console.log(`Text extraction completed. Length: ${fullText.length}`);
        
        if (fullText.trim().length === 0) {
          return res.json({
            text: `El PDF "${req.file.originalname}" no contiene texto extraíble.\n\nPuede ser una imagen escaneada. Para continuar:\n\n1. Abre el PDF en tu computadora\n2. Selecciona todo el texto visible (Ctrl+A)\n3. Copia el texto (Ctrl+C)\n4. Pega el texto en el área de abajo`,
            pages: pdf.numPages,
            info: { 
              title: req.file.originalname,
              size: req.file.size,
              type: "no_text"
            }
          });
        }
        
        res.json({ 
          text: fullText.trim(),
          pages: pdf.numPages,
          info: { 
            title: req.file.originalname,
            size: req.file.size,
            method: "pdfjs_extraction"
          }
        });
        
      } catch (pdfError) {
        console.error("PDF processing error:", pdfError);
        
        // Guardar PDF para acceso manual
        const fs = await import('fs');
        const path = await import('path');
        
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const fileName = `pdf_${Date.now()}_${req.file.originalname}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, req.file.buffer);
        
        res.json({
          text: `Error procesando PDF "${req.file.originalname}".\n\nArchivo guardado para revisión manual.\n\nPara continuar:\n1. Abre el PDF original\n2. Copia todo el texto\n3. Pégalo en el área de abajo`,
          pages: "Error",
          info: { 
            title: req.file.originalname,
            size: req.file.size,
            error: (pdfError as Error).message,
            savedPath: fileName
          }
        });
      }
      
    } catch (error) {
      console.error("Error processing PDF:", error);
      res.status(500).json({ message: "Error al procesar PDF: " + (error as Error).message });
    }
  });

  // Bulk company import route
  app.post("/api/import-companies-bulk", requireAuth, async (req, res) => {
    try {
      const { companies } = req.body;
      const userId = (req as any).user?.id;

      if (!Array.isArray(companies) || companies.length === 0) {
        return res.status(400).json({ message: "No se proporcionaron empresas para importar" });
      }

      let imported = 0;
      let errors = 0;

      for (const companyData of companies) {
        try {
          // Create user for the company first
          const username = companyData.name.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .substring(0, 50);
          
          let finalUsername = username;
          let counter = 1;
          
          // Ensure unique username
          while (await storage.getUserByUsername(finalUsername)) {
            finalUsername = `${username}_${counter}`;
            counter++;
          }

          const newUser = await storage.createUser({
            username: finalUsername,
            email: companyData.email || `${finalUsername}@example.com`,
            password: await AuthService.hashPassword("defaultpassword123"),
            role: "user",
            userType: "supplier"
          });

          // Create supplier company
          await storage.createSupplierCompany({
            userId: newUser.id,
            companyName: companyData.name,
            businessType: companyData.businessType || "General",
            description: companyData.services || "",
            address: companyData.address || "",
            city: companyData.city || "La Paz",
            phone: companyData.phone || "",
            website: companyData.website || "",
            speciality: companyData.businessType || "General"
          });

          imported++;
        } catch (error) {
          console.error(`Error importing company ${companyData.name}:`, error);
          errors++;
        }
      }

      res.json({ 
        imported,
        errors,
        total: companies.length,
        message: `Se importaron ${imported} empresas correctamente${errors > 0 ? `, ${errors} errores` : ''}`
      });
    } catch (error) {
      console.error("Error in bulk import:", error);
      res.status(500).json({ message: "Error al importar empresas" });
    }
  });

  // Admin routes for supplier companies management
  app.get("/api/admin/supplier-companies", requireAuth, async (req, res) => {
    try {
      const companies = await storage.getSupplierCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching supplier companies:", error);
      res.status(500).json({ message: "Failed to fetch supplier companies" });
    }
  });

  app.patch("/api/admin/supplier-companies/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedCompany = await storage.updateSupplierCompany(parseInt(id), updates);
      res.json(updatedCompany);
    } catch (error) {
      console.error("Error updating supplier company:", error);
      res.status(500).json({ message: "Failed to update supplier company" });
    }
  });

  app.delete("/api/admin/supplier-companies/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      await storage.deleteSupplierCompany(parseInt(id));
      res.json({ message: "Supplier company deleted successfully" });
    } catch (error) {
      console.error("Error deleting supplier company:", error);
      res.status(500).json({ message: "Failed to delete supplier company" });
    }
  });

  // Admin company management routes
  app.get("/api/admin/companies", requireAuth, requireAdmin, async (req, res) => {
    try {
      const companies = await storage.getAllSupplierCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.put("/api/admin/companies/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const updateData = req.body;
      
      const updatedCompany = await storage.updateSupplierCompany(companyId, updateData);
      res.json(updatedCompany);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.post("/api/admin/companies/:id/logo", requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      if (!req.file) {
        return res.status(400).json({ message: "No logo file provided" });
      }

      const logoPath = `/uploads/${req.file.filename}`;
      await storage.updateSupplierCompanyLogo(companyId, logoPath);
      
      res.json({ logoPath });
    } catch (error) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  // Admin advertisements management routes
  app.get("/api/admin/advertisements", requireAuth, requireAdmin, async (req, res) => {
    try {
      const advertisements = await storage.getAllAdvertisements();
      res.json(advertisements);
    } catch (error) {
      console.error("Error fetching advertisements:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  app.post("/api/admin/advertisements", requireAuth, requireAdmin, async (req, res) => {
    try {
      const adData = req.body;
      const advertisement = await storage.createAdvertisement(adData);
      res.json(advertisement);
    } catch (error) {
      console.error("Error creating advertisement:", error);
      res.status(500).json({ message: "Failed to create advertisement" });
    }
  });

  app.put("/api/admin/advertisements/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const adId = parseInt(req.params.id);
      const updateData = req.body;
      
      const updatedAd = await storage.updateAdvertisement(adId, updateData);
      res.json(updatedAd);
    } catch (error) {
      console.error("Error updating advertisement:", error);
      res.status(500).json({ message: "Failed to update advertisement" });
    }
  });

  app.delete("/api/admin/advertisements/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const adId = parseInt(req.params.id);
      await storage.deleteAdvertisement(adId);
      res.json({ message: "Advertisement deleted successfully" });
    } catch (error) {
      console.error("Error deleting advertisement:", error);
      res.status(500).json({ message: "Failed to delete advertisement" });
    }
  });

  app.post("/api/admin/advertisements/upload-image", requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const imagePath = `/uploads/${req.file.filename}`;
      res.json({ imagePath });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Database export endpoint - allow any authenticated user
  app.get("/api/admin/export-database", requireAuth, async (req, res) => {
    try {
      console.log("Starting database export...");
      const fileName = await exportDatabase();
      
      // Send the file as download
      const filePath = path.join(process.cwd(), fileName);
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("Error downloading file:", err);
          res.status(500).json({ message: "Error downloading export file" });
        } else {
          // Optionally delete the file after download
          setTimeout(() => {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }, 60000); // Delete after 1 minute
        }
      });
    } catch (error) {
      console.error("Error exporting database:", error);
      res.status(500).json({ message: "Failed to export database: " + (error as Error).message });
    }
  });

  // Internal messaging system routes
  app.post("/api/consultation-messages", async (req, res) => {
    try {
      const validatedData = insertConsultationMessageSchema.parse(req.body);
      const message = await storage.createConsultationMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating consultation message:", error);
      res.status(500).json({ message: "Failed to create consultation message" });
    }
  });

  app.get("/api/admin/consultation-messages", requireAuth, requireAdmin, async (req, res) => {
    try {
      const messages = await storage.getAllConsultationMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching consultation messages:", error);
      res.status(500).json({ message: "Failed to fetch consultation messages" });
    }
  });

  app.patch("/api/admin/consultation-messages/:id/status", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminResponse } = req.body;
      
      const updatedMessage = await storage.updateConsultationMessageStatus(
        parseInt(id), 
        status, 
        adminResponse
      );
      res.json(updatedMessage);
    } catch (error) {
      console.error("Error updating consultation message status:", error);
      res.status(500).json({ message: "Failed to update consultation message status" });
    }
  });

  app.get("/api/public/consultation-messages", async (req, res) => {
    try {
      const publicMessages = await storage.getPublicConsultationMessages();
      res.json(publicMessages);
    } catch (error) {
      console.error("Error fetching public consultation messages:", error);
      res.status(500).json({ message: "Failed to fetch public consultation messages" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
