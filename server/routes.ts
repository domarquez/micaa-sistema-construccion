import { Router, Request, Response } from 'express';
import { db } from './db';
import { storage as dbStorage } from './storage';
import { users, materials, activities, projects, supplierCompanies, cityPriceFactors, constructionPhases, materialCategories, tools, laborCategories, companyAdvertisements, budgets, activityCompositions, priceSettings, userMaterialPrices, userActivities, userActivityCompositions, customActivities, customActivityCompositions } from '../shared/schema';
import { eq, like, desc, asc, and, sql } from 'drizzle-orm';
import jwt, { JwtPayload } from 'jsonwebtoken';

// Custom JWT payload interface
interface CustomJwtPayload extends JwtPayload {
  userId: number;
}

// Middleware de autenticación
const requireAuth = async (req: Request & { user?: any }, res: Response, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Token de autenticación requerido" });
    }

    const token = authHeader.substring(7);
    
    // Verificar token JWT
    let decoded: CustomJwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'micaa-secret-key') as CustomJwtPayload;
    } catch (error) {
      return res.status(401).json({ message: "Token inválido" });
    }

    // Buscar usuario
    const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    
    if (user.length === 0) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    req.user = user[0];
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Error de autenticación" });
  }
};

export async function registerRoutes(app: any) {
  const router = Router();
  // Usar la instancia de storage ya inicializada

  // Test route to verify DB connection
  router.get('/test-db', async (req, res) => {
    try {
      const userCount = await db.select().from(users).limit(1);
      const materialCount = await db.select().from(materials).limit(1);
      const activityCount = await db.select().from(activities).limit(1);
      
      res.json({
        message: 'Database connection successful',
        tables: {
          users: userCount.length > 0 ? 'Connected' : 'Empty',
          materials: materialCount.length > 0 ? 'Connected' : 'Empty',
          activities: activityCount.length > 0 ? 'Connected' : 'Empty'
        }
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Database connection failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Users routes
  router.get('/users', async (req, res) => {
    try {
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Materials routes with category information and custom pricing
  router.get('/materials', async (req, res) => {
    try {
      // Deshabilitar caché
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const { search, category, limit = '50' } = req.query;
      
      // Try to get user ID from auth token if present (optional)
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          console.log('🔑 Token received:', token.substring(0, 20) + '...');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'micaa-secret-key') as any;
          userId = decoded.userId;
          console.log('🔍 Materials request with user ID:', userId);
        } catch (error) {
          console.log('⚠️ Token validation failed:', error instanceof Error ? error.message : error);
        }
      } else {
        console.log('⚠️ No Authorization header found');
      }
      
      // Build where conditions
      let whereConditions = [];
      
      if (search && typeof search === 'string') {
        whereConditions.push(like(materials.name, `%${search}%`));
      }
      
      if (category && typeof category === 'string') {
        whereConditions.push(eq(materials.categoryId, parseInt(category)));
      }
      
      // Build the query
      let materialsQuery = db.select().from(materials);
      
      if (whereConditions.length > 0) {
        materialsQuery = materialsQuery.where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions));
      }
      
      const materialsData = await materialsQuery.limit(parseInt(limit as string));
      
      // Get all categories
      const categories = await db.select().from(materialCategories).orderBy(asc(materialCategories.name));
      
      // Get user's custom prices if authenticated
      let userCustomPrices = [];
      if (userId) {
        userCustomPrices = await db.select().from(userMaterialPrices).where(eq(userMaterialPrices.userId, userId));
          console.log('🔧 Found custom prices for user:', userId, 'count:', userCustomPrices.length);
        userCustomPrices.forEach(cp => {
          console.log(`  - ${cp.originalMaterialName} -> ${cp.customMaterialName} (${cp.price})`);
        });
      } else {
        console.log('📋 No user authentication, showing public materials only');
      }
      
      // Combine materials with category information and create duplicates for custom pricing
      let allMaterials = [];
      
      // Add original materials
      materialsData.forEach(material => {
        const category = categories.find(c => c.id === material.categoryId);
        allMaterials.push({
          ...material,
          category: category || { id: 0, name: 'Sin Categoría' },
          hasCustomPrice: false,
          customPrice: null,
          isOriginal: true
        });
      });
      
      // Add custom price materials as separate entries
      if (userId) {
        userCustomPrices.forEach(customPrice => {
          const originalMaterial = materialsData.find(m => m.name === customPrice.originalMaterialName);
          if (originalMaterial) {
            const category = categories.find(c => c.id === originalMaterial.categoryId);
            allMaterials.push({
              ...originalMaterial,
              id: `custom_${originalMaterial.id}_${customPrice.id}`, // Unique ID for custom version
              name: customPrice.customMaterialName,
              price: parseFloat(customPrice.price.toString()),
              category: category || { id: 0, name: 'Sin Categoría' },
              hasCustomPrice: true,
              customPrice: {
                customPrice: customPrice.price,
                customName: customPrice.customMaterialName,
                reason: customPrice.reason,
                originalName: customPrice.originalMaterialName
              },
              isOriginal: false
            });
          }
        });
      }
      
      const materialsWithCategories = allMaterials;
      
      // Sort materials by category name, then by material name
      materialsWithCategories.sort((a, b) => {
        const categoryCompare = a.category.name.localeCompare(b.category.name);
        if (categoryCompare !== 0) return categoryCompare;
        return a.name.localeCompare(b.name);
      });
      
      res.json(materialsWithCategories);
    } catch (error) {
      console.error('Materials fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch materials' });
    }
  });

  // Material categories
  router.get('/material-categories', async (req, res) => {
    try {
      const categories = await db.select().from(materialCategories).orderBy(asc(materialCategories.name));
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch material categories' });
    }
  });

  // Activities routes with phase information
  router.get('/activities', async (req: Request, res: Response) => {
    try {
      const { search, phase, limit = '100', offset = '0' } = req.query;
      
      // Try to get user ID from auth token (optional)
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'micaa-secret-key') as any;
          userId = decoded.userId;
          console.log('🔍 Activities request with user ID:', userId);
        } catch (error) {
          console.log('⚠️ Activities request without valid auth');
        }
      }
      
      // Build where conditions
      let whereConditions = [];
      
      if (search && typeof search === 'string') {
        whereConditions.push(like(activities.name, `%${search}%`));
      }
      
      if (phase && typeof phase === 'string') {
        whereConditions.push(eq(activities.phaseId, parseInt(phase)));
      }
      
      // Build activities query
      let activitiesQuery = db.select().from(activities);
      
      if (whereConditions.length > 0) {
        const whereClause = whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions);
        activitiesQuery = activitiesQuery.where(whereClause);
      }
      
      const activitiesData = await activitiesQuery
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));
      
      // Get total count for pagination
      let countQuery = db.select({ count: sql`count(*)`.as('count') }).from(activities);
      
      if (whereConditions.length > 0) {
        const whereClause = whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions);
        countQuery = countQuery.where(whereClause);
      }
      
      const totalCountResult = await countQuery;
      const totalCount = Number(totalCountResult[0]?.count) || 0;
      
      // Get all phases
      const phases = await db.select().from(constructionPhases);
      
      // Combine activities with phase information
      let activitiesWithPhases = activitiesData.map(activity => {
        const phase = phases.find(p => p.id === activity.phaseId);
        return {
          ...activity,
          phase: phase || { id: 0, name: 'Sin Fase', description: '' },
          isOriginal: true,
          hasCustomActivity: false
        };
      });

      // If user is authenticated, get their custom activities and merge them
      if (userId) {
        const userCustomActivities = await db.select({
          id: userActivities.id,
          originalActivityId: userActivities.originalActivityId,
          customActivityName: userActivities.customActivityName,
          phaseId: userActivities.phaseId,
          unit: userActivities.unit,
          description: userActivities.description,
        })
          .from(userActivities)
          .where(eq(userActivities.userId, userId));

        console.log(`🔧 Found ${userCustomActivities.length} custom activities for user ${userId}`);

        // Add custom activities to the results
        const customActivitiesFormatted = userCustomActivities.map(customActivity => {
          const phase = phases.find(p => p.id === customActivity.phaseId);
          return {
            id: customActivity.id + 10000, // Use a different ID range to avoid conflicts
            phaseId: customActivity.phaseId,
            name: customActivity.customActivityName,
            unit: customActivity.unit,
            description: customActivity.description,
            unitPrice: "0",
            phase: phase || { id: 0, name: 'Sin Fase', description: '' },
            isOriginal: false,
            hasCustomActivity: true,
            originalActivityId: customActivity.originalActivityId
          };
        });

        // Mark original activities that have custom versions
        activitiesWithPhases = activitiesWithPhases.map(activity => {
          const hasCustom = userCustomActivities.some(custom => custom.originalActivityId === activity.id);
          return {
            ...activity,
            hasCustomActivity: hasCustom
          };
        });

        // Insert custom activities right after their originals
        const mergedActivities = [];
        for (const activity of activitiesWithPhases) {
          mergedActivities.push(activity);
          // Find if there's a custom version of this activity
          const customActivity = customActivitiesFormatted.find(custom => custom.originalActivityId === activity.id);
          if (customActivity) {
            mergedActivities.push(customActivity);
          }
        }
        activitiesWithPhases = mergedActivities;
      }
      
      res.json({
        activities: activitiesWithPhases,
        totalCount: totalCount,
        currentPage: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
        totalPages: Math.ceil(totalCount / parseInt(limit as string)),
        limit: parseInt(limit as string)
      });
    } catch (error) {
      console.error('Activities fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch activities' });
    }
  });

  // Get activity compositions
  router.get('/activities/:id/compositions', async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      if (isNaN(activityId)) {
        return res.status(400).json({ error: 'Invalid activity ID' });
      }

      let compositions;
      
      // Check if this is a custom activity (ID > 10000)
      if (activityId > 10000) {
        const realActivityId = activityId - 10000;
        console.log(`🔧 Getting compositions for custom activity ${activityId} (real ID: ${realActivityId})`);
        compositions = await db.select()
          .from(userActivityCompositions)
          .where(eq(userActivityCompositions.userActivityId, realActivityId));
      } else {
        console.log(`🔧 Getting compositions for original activity ${activityId}`);
        compositions = await db.select()
          .from(activityCompositions)
          .where(eq(activityCompositions.activityId, activityId));
      }

      console.log(`📋 Found ${compositions.length} compositions for activity ${activityId}`);
      res.json(compositions);
    } catch (error) {
      console.error('Activity compositions fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch activity compositions' });
    }
  });

  // Get activity APU calculation
  router.get('/activities/:id/apu-calculation', async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      if (isNaN(activityId)) {
        return res.status(400).json({ error: 'Invalid activity ID' });
      }

      // Import APU calculator
      const { calculateAPU } = await import('./apu-calculator');
      const calculation = await calculateAPU(activityId);
      
      res.json(calculation);
    } catch (error) {
      console.error('APU calculation error:', error);
      res.status(500).json({ error: 'Failed to calculate APU' });
    }
  });

  // Duplicate activity for user customization
  router.post('/activities/:id/duplicate', async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      if (isNaN(activityId)) {
        return res.status(400).json({ error: 'Invalid activity ID' });
      }

      // Get user ID from auth token
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'micaa-secret-key') as any;
          userId = decoded.userId;
        } catch (error) {
          return res.status(401).json({ error: 'Invalid authentication token' });
        }
      } else {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get original activity
      const [originalActivity] = await db.select().from(activities).where(eq(activities.id, activityId));
      if (!originalActivity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      // Check if user already has this activity duplicated
      const existingDuplicate = await db.select()
        .from(userActivities)
        .where(and(
          eq(userActivities.userId, userId),
          eq(userActivities.originalActivityId, activityId)
        ));

      if (existingDuplicate.length > 0) {
        return res.status(400).json({ error: 'Activity already duplicated by this user' });
      }

      // Create user activity
      const [userActivity] = await db.insert(userActivities).values({
        userId,
        originalActivityId: activityId,
        originalActivityName: originalActivity.name,
        customActivityName: `${originalActivity.name} (Personalizada)`,
        phaseId: originalActivity.phaseId,
        unit: originalActivity.unit,
        description: originalActivity.description,
        reason: 'Actividad duplicada para personalización'
      }).returning();

      // Get original activity compositions
      const originalCompositions = await db.select()
        .from(activityCompositions)
        .where(eq(activityCompositions.activityId, activityId));

      // Duplicate compositions for user activity
      if (originalCompositions.length > 0) {
        const userCompositions = originalCompositions.map(comp => ({
          userActivityId: userActivity.id,
          materialId: comp.materialId,
          laborId: comp.laborId,
          toolId: comp.toolId,
          description: comp.description,
          unit: comp.unit,
          quantity: comp.quantity,
          unitCost: comp.unitCost,
          type: comp.type
        }));

        await db.insert(userActivityCompositions).values(userCompositions);
      }

      console.log(`✅ Activity ${activityId} duplicated for user ${userId} as user activity ${userActivity.id}`);
      
      res.json({
        success: true,
        userActivity,
        message: 'Activity duplicated successfully'
      });
    } catch (error) {
      console.error('Activity duplication error:', error);
      res.status(500).json({ error: 'Failed to duplicate activity' });
    }
  });

  // Update user activity composition
  router.put('/user-activities/:userActivityId/compositions/:compositionId', async (req, res) => {
    try {
      const userActivityId = parseInt(req.params.userActivityId);
      const compositionId = parseInt(req.params.compositionId);
      const { quantity, unitCost, description } = req.body;

      if (isNaN(userActivityId) || isNaN(compositionId)) {
        return res.status(400).json({ error: 'Invalid IDs' });
      }

      // Get user ID from auth token
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'micaa-secret-key') as any;
          userId = decoded.userId;
        } catch (error) {
          return res.status(401).json({ error: 'Invalid authentication token' });
        }
      } else {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify the user owns this activity
      const [userActivity] = await db.select()
        .from(userActivities)
        .where(and(
          eq(userActivities.id, userActivityId),
          eq(userActivities.userId, userId)
        ));

      if (!userActivity) {
        return res.status(404).json({ error: 'User activity not found or access denied' });
      }

      // Update the composition
      const [updatedComposition] = await db.update(userActivityCompositions)
        .set({
          quantity: quantity ? String(quantity) : undefined,
          unitCost: unitCost ? String(unitCost) : undefined,
          description: description || undefined,
          updatedAt: new Date()
        })
        .where(and(
          eq(userActivityCompositions.id, compositionId),
          eq(userActivityCompositions.userActivityId, userActivityId)
        ))
        .returning();

      if (!updatedComposition) {
        return res.status(404).json({ error: 'Composition not found' });
      }

      console.log(`✅ Updated composition ${compositionId} for user activity ${userActivityId}`);
      res.json({ success: true, composition: updatedComposition });
    } catch (error) {
      console.error('Composition update error:', error);
      res.status(500).json({ error: 'Failed to update composition' });
    }
  });

  // Add new composition to user activity
  router.post('/user-activities/:userActivityId/compositions', async (req, res) => {
    try {
      const userActivityId = parseInt(req.params.userActivityId);
      const { type, description, unit, quantity, unitCost, materialId, laborId, toolId } = req.body;

      if (isNaN(userActivityId)) {
        return res.status(400).json({ error: 'Invalid user activity ID' });
      }

      // Get user ID from auth token
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'micaa-secret-key') as any;
          userId = decoded.userId;
        } catch (error) {
          return res.status(401).json({ error: 'Invalid authentication token' });
        }
      } else {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify the user owns this activity
      const [userActivity] = await db.select()
        .from(userActivities)
        .where(and(
          eq(userActivities.id, userActivityId),
          eq(userActivities.userId, userId)
        ));

      if (!userActivity) {
        return res.status(404).json({ error: 'User activity not found or access denied' });
      }

      // Create new composition
      const [newComposition] = await db.insert(userActivityCompositions).values({
        userActivityId,
        type: type || 'material',
        description: description || '',
        unit: unit || 'UN',
        quantity: String(quantity || 1),
        unitCost: String(unitCost || 0),
        materialId: materialId || null,
        laborId: laborId || null,
        toolId: toolId || null
      }).returning();

      console.log(`✅ Added new composition to user activity ${userActivityId}`);
      res.json({ success: true, composition: newComposition });
    } catch (error) {
      console.error('Composition creation error:', error);
      res.status(500).json({ error: 'Failed to create composition' });
    }
  });

  // Delete user activity composition
  router.delete('/user-activities/:userActivityId/compositions/:compositionId', async (req, res) => {
    try {
      const userActivityId = parseInt(req.params.userActivityId);
      const compositionId = parseInt(req.params.compositionId);

      if (isNaN(userActivityId) || isNaN(compositionId)) {
        return res.status(400).json({ error: 'Invalid IDs' });
      }

      // Get user ID from auth token
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'micaa-secret-key') as any;
          userId = decoded.userId;
        } catch (error) {
          return res.status(401).json({ error: 'Invalid authentication token' });
        }
      } else {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify the user owns this activity
      const [userActivity] = await db.select()
        .from(userActivities)
        .where(and(
          eq(userActivities.id, userActivityId),
          eq(userActivities.userId, userId)
        ));

      if (!userActivity) {
        return res.status(404).json({ error: 'User activity not found or access denied' });
      }

      // Delete the composition
      const deletedComposition = await db.delete(userActivityCompositions)
        .where(and(
          eq(userActivityCompositions.id, compositionId),
          eq(userActivityCompositions.userActivityId, userActivityId)
        ))
        .returning();

      if (deletedComposition.length === 0) {
        return res.status(404).json({ error: 'Composition not found' });
      }

      console.log(`✅ Deleted composition ${compositionId} from user activity ${userActivityId}`);
      res.json({ success: true, message: 'Composition deleted successfully' });
    } catch (error) {
      console.error('Composition deletion error:', error);
      res.status(500).json({ error: 'Failed to delete composition' });
    }
  });

  // Get user activities for statistics
  router.get('/user-activities', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const userDuplicatedActivities = await db.select({
        id: userActivities.id,
        originalActivityId: userActivities.originalActivityId,
        customActivityName: userActivities.customActivityName,
        phaseId: userActivities.phaseId,
        unit: userActivities.unit,
        description: userActivities.description,
        createdAt: userActivities.createdAt,
        updatedAt: userActivities.updatedAt
      })
      .from(userActivities)
      .where(eq(userActivities.userId, userId))
      .orderBy(desc(userActivities.createdAt));

      console.log(`📋 Found ${userDuplicatedActivities.length} duplicated activities for user ${userId}`);
      res.json(userDuplicatedActivities);
    } catch (error) {
      console.error('Error fetching user activities:', error);
      res.status(500).json({ error: 'Failed to fetch user activities' });
    }
  });

  // ==================== CUSTOM ACTIVITIES (COMPLETELY NEW) ====================
  
  // Get all custom activities for authenticated user
  router.get('/custom-activities', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const userCustomActivities = await db.select({
        id: customActivities.id,
        name: customActivities.name,
        unit: customActivities.unit,
        description: customActivities.description,
        phaseId: customActivities.phaseId,
        createdAt: customActivities.createdAt,
        updatedAt: customActivities.updatedAt,
        phaseName: constructionPhases.name
      })
      .from(customActivities)
      .leftJoin(constructionPhases, eq(customActivities.phaseId, constructionPhases.id))
      .where(eq(customActivities.userId, userId))
      .orderBy(desc(customActivities.createdAt));

      console.log(`📋 Found ${userCustomActivities.length} custom activities for user ${userId}`);
      res.json(userCustomActivities);
    } catch (error) {
      console.error('Error fetching custom activities:', error);
      res.status(500).json({ error: 'Failed to fetch custom activities' });
    }
  });

  // Create new custom activity
  router.post('/custom-activities', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name, unit, description, phaseId } = req.body;

      if (!name || !unit) {
        return res.status(400).json({ error: 'Name and unit are required' });
      }

      const [newActivity] = await db.insert(customActivities).values({
        userId,
        name,
        unit,
        description,
        phaseId: phaseId || null
      }).returning();

      console.log(`✅ Created custom activity "${name}" for user ${userId}`);
      res.status(201).json(newActivity);
    } catch (error) {
      console.error('Error creating custom activity:', error);
      res.status(500).json({ error: 'Failed to create custom activity' });
    }
  });

  // Get compositions for custom activity
  router.get('/custom-activities/:id/compositions', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const activityId = parseInt(req.params.id);

      if (isNaN(activityId)) {
        return res.status(400).json({ error: 'Invalid activity ID' });
      }

      // Verify user owns the activity
      const [activity] = await db.select()
        .from(customActivities)
        .where(and(
          eq(customActivities.id, activityId),
          eq(customActivities.userId, userId)
        ));

      if (!activity) {
        return res.status(404).json({ error: 'Custom activity not found or access denied' });
      }

      // Get compositions
      const compositions = await db.select()
        .from(customActivityCompositions)
        .where(eq(customActivityCompositions.customActivityId, activityId))
        .orderBy(customActivityCompositions.type, customActivityCompositions.description);

      console.log(`📋 Found ${compositions.length} compositions for custom activity ${activityId}`);
      res.json(compositions);
    } catch (error) {
      console.error('Error fetching custom activity compositions:', error);
      res.status(500).json({ error: 'Failed to fetch compositions' });
    }
  });

  // Add composition to custom activity
  router.post('/custom-activities/:id/compositions', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const activityId = parseInt(req.params.id);
      const { type, description, unit, quantity, unitCost, materialId, laborId, toolId } = req.body;

      if (isNaN(activityId)) {
        return res.status(400).json({ error: 'Invalid activity ID' });
      }

      if (!type || !description || !unit) {
        return res.status(400).json({ error: 'Type, description, and unit are required' });
      }

      // Verify user owns the activity
      const [activity] = await db.select()
        .from(customActivities)
        .where(and(
          eq(customActivities.id, activityId),
          eq(customActivities.userId, userId)
        ));

      if (!activity) {
        return res.status(404).json({ error: 'Custom activity not found or access denied' });
      }

      const [newComposition] = await db.insert(customActivityCompositions).values({
        customActivityId: activityId,
        type,
        description,
        unit,
        quantity: quantity || 0,
        unitCost: unitCost || 0,
        materialId,
        laborId,
        toolId
      }).returning();

      console.log(`✅ Added composition "${description}" to custom activity ${activityId}`);
      res.status(201).json(newComposition);
    } catch (error) {
      console.error('Error adding custom activity composition:', error);
      res.status(500).json({ error: 'Failed to add composition' });
    }
  });

  // Construction phases
  router.get('/construction-phases', async (req, res) => {
    try {
      const phases = await db.select().from(constructionPhases).orderBy(asc(constructionPhases.id));
      res.json(phases);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch construction phases' });
    }
  });

  // Projects routes
  router.get('/projects', async (req, res) => {
    try {
      const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
      res.json(allProjects);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Supplier companies routes
  router.get('/suppliers', async (req: Request, res: Response) => {
    try {
      const { search, specialty, limit = '20' } = req.query;
      
      let whereConditions = [eq(supplierCompanies.isActive, true)];
      
      if (search && typeof search === 'string') {
        whereConditions.push(like(supplierCompanies.companyName, `%${search}%`));
      }
      
      const suppliers = await db.select()
        .from(supplierCompanies)
        .where(and(...whereConditions))
        .limit(parseInt(limit as string));
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  });

  // Tools routes
  router.get('/tools', async (req, res) => {
    try {
      const toolsList = await db.select().from(tools).where(eq(tools.isActive, true)).orderBy(asc(tools.name));
      res.json(toolsList);
    } catch (error) {
      console.error('Tools fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch tools' });
    }
  });

  // Labor categories routes
  router.get('/labor-categories', async (req, res) => {
    try {
      const laborList = await db.select().from(laborCategories).where(eq(laborCategories.isActive, true)).orderBy(asc(laborCategories.name));
      res.json(laborList);
    } catch (error) {
      console.error('Labor categories fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch labor categories' });
    }
  });

  // Update labor category hourly rate (admin only)
  router.put('/labor-categories/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { hourlyRate } = req.body;

      if (!hourlyRate || isNaN(parseFloat(hourlyRate))) {
        return res.status(400).json({ error: 'Valid hourly rate is required' });
      }

      const result = await db.update(laborCategories)
        .set({ 
          hourlyRate: hourlyRate,
          updatedAt: new Date()
        })
        .where(eq(laborCategories.id, parseInt(id)))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Labor category not found' });
      }

      console.log(`Labor category ${id} updated: hourly rate = ${hourlyRate} BOB`);
      res.json({ 
        success: true, 
        message: 'Hourly rate updated successfully',
        category: result[0]
      });
    } catch (error) {
      console.error('Labor category update error:', error);
      res.status(500).json({ error: 'Failed to update labor category' });
    }
  });

  // City price factors
  router.get('/city-factors', async (req, res) => {
    try {
      const factors = await db.select().from(cityPriceFactors).where(eq(cityPriceFactors.isActive, true));
      res.json(factors);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch city factors' });
    }
  });

  // User custom material pricing endpoints
  router.post('/materials/:id/custom-price', requireAuth, async (req: any, res) => {
    try {
      const materialId = parseInt(req.params.id);
      const { customPrice, reason } = req.body;
      const userId = req.user.id;

      if (!customPrice || customPrice <= 0) {
        return res.status(400).json({ error: 'Precio personalizado inválido' });
      }

      // Get the original material
      const material = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
      if (material.length === 0) {
        return res.status(404).json({ error: 'Material no encontrado' });
      }

      // Check if user already has a custom price for this material
      const existingCustomPrice = await db.select()
        .from(userMaterialPrices)
        .where(and(
          eq(userMaterialPrices.userId, userId),
          eq(userMaterialPrices.originalMaterialName, material[0].name)
        ))
        .limit(1);

      if (existingCustomPrice.length > 0) {
        // Update existing custom price
        const updated = await db.update(userMaterialPrices)
          .set({
            price: customPrice.toString(),
            customMaterialName: `${material[0].name} (Personalizado)`,
            reason: reason || 'Precio personalizado actualizado',
            updatedAt: new Date()
          })
          .where(eq(userMaterialPrices.id, existingCustomPrice[0].id))
          .returning();

        res.json({ success: true, customPrice: updated[0] });
      } else {
        // Create new custom price
        const newCustomPrice = await db.insert(userMaterialPrices)
          .values({
            userId,
            materialId: materialId, // Agregar material_id
            originalMaterialName: material[0].name,
            customMaterialName: `${material[0].name} (Personalizado)`,
            price: customPrice.toString(),
            unit: material[0].unit,
            reason: reason || 'Precio personalizado'
          })
          .returning();

        res.json({ success: true, customPrice: newCustomPrice[0] });
      }
    } catch (error) {
      console.error('Error saving custom price:', error);
      res.status(500).json({ error: 'Error al guardar precio personalizado' });
    }
  });

  router.delete('/materials/:id/custom-price', requireAuth, async (req: any, res) => {
    try {
      const materialId = parseInt(req.params.id);
      const userId = req.user.id;

      // Get the original material
      const material = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
      if (material.length === 0) {
        return res.status(404).json({ error: 'Material no encontrado' });
      }

      // Delete user's custom price
      await db.delete(userMaterialPrices)
        .where(and(
          eq(userMaterialPrices.userId, userId),
          eq(userMaterialPrices.originalMaterialName, material[0].name)
        ));

      res.json({ success: true, message: 'Precio personalizado eliminado' });
    } catch (error) {
      console.error('Error removing custom price:', error);
      res.status(500).json({ error: 'Error al eliminar precio personalizado' });
    }
  });

  // Statistics route
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const userCount = await db.select({ count: sql`count(*)`.as('count') }).from(users);
      const materialCount = await db.select({ count: sql`count(*)`.as('count') }).from(materials);
      const activityCount = await db.select({ count: sql`count(*)`.as('count') }).from(activities);
      const supplierCount = await db.select({ count: sql`count(*)`.as('count') }).from(supplierCompanies);
      
      res.json({
        users: Number(userCount[0]?.count) || 0,
        materials: Number(materialCount[0]?.count) || 0,
        activities: Number(activityCount[0]?.count) || 0,
        suppliers: Number(supplierCount[0]?.count) || 0
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // Public routes (no authentication required)
  app.get("/api/public/materials", async (req: Request, res: Response) => {
    try {
      const materialsData = await db.select().from(materials).limit(100);
      const categories = await db.select().from(materialCategories).orderBy(asc(materialCategories.name));
      
      const materialsWithCategories = materialsData.map(material => {
        const category = categories.find(c => c.id === material.categoryId);
        return {
          ...material,
          category: category || { id: 0, name: 'Sin Categoría' }
        };
      });
      
      // Sort materials by category name, then by material name
      materialsWithCategories.sort((a, b) => {
        const categoryCompare = a.category.name.localeCompare(b.category.name);
        if (categoryCompare !== 0) return categoryCompare;
        return a.name.localeCompare(b.name);
      });
      
      res.json(materialsWithCategories);
    } catch (error) {
      console.error("Error fetching public materials:", error);
      res.status(500).json({ message: "Failed to fetch materials" });
    }
  });

  app.get("/api/public/material-categories", async (req: Request, res: Response) => {
    try {
      const categories = await db.select().from(materialCategories);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching public categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/public/suppliers", async (req: Request, res: Response) => {
    try {
      const suppliers = await db.select().from(supplierCompanies).where(eq(supplierCompanies.isActive, true)).limit(50);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching public suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.get("/api/public/dual-advertisements", async (req: Request, res: Response) => {
    try {
      const activeAds = await db
        .select({
          id: companyAdvertisements.id,
          title: companyAdvertisements.title,
          description: companyAdvertisements.description,
          imageUrl: companyAdvertisements.imageUrl,
          linkUrl: companyAdvertisements.linkUrl,
          viewCount: companyAdvertisements.viewCount,
          clickCount: companyAdvertisements.clickCount,
          supplier: {
            id: supplierCompanies.id,
            companyName: supplierCompanies.companyName,
          }
        })
        .from(companyAdvertisements)
        .leftJoin(supplierCompanies, eq(companyAdvertisements.supplierId, supplierCompanies.id))
        .where(
          and(
            eq(companyAdvertisements.isActive, true),
            sql`(${companyAdvertisements.endDate} IS NULL OR ${companyAdvertisements.endDate} > NOW())`,
            sql`(${companyAdvertisements.startDate} IS NULL OR ${companyAdvertisements.startDate} <= NOW())`
          )
        )
        .orderBy(sql`RANDOM()`)
        .limit(2);

      // Increment view counts
      for (const ad of activeAds) {
        await db
          .update(companyAdvertisements)
          .set({ viewCount: sql`${companyAdvertisements.viewCount} + 1` })
          .where(eq(companyAdvertisements.id, ad.id));
      }

      res.json(activeAds);
    } catch (error) {
      console.error("Error fetching advertisements:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  app.get("/api/statistics", async (req: Request, res: Response) => {
    try {
      const [materialsCount] = await db.select({ count: sql`count(*)`.as('count') }).from(materials);
      const [activitiesCount] = await db.select({ count: sql`count(*)`.as('count') }).from(activities);
      const [suppliersCount] = await db.select({ count: sql`count(*)`.as('count') }).from(supplierCompanies);
      const [usersCount] = await db.select({ count: sql`count(*)`.as('count') }).from(users);
      // Query budgets and projects with error handling
      let budgetsCount = { count: 0 };
      let projectsCount = { count: 0 };
      let totalValue = { total: 0 };
      
      try {
        [budgetsCount] = await db.select({ count: sql`count(*)`.as('count') }).from(budgets);
      } catch (e) {
        console.log('Budgets table query failed, using direct SQL');
        const result = await db.execute(sql`SELECT count(*) as count FROM budgets`);
        budgetsCount = { count: Number(result.rows[0].count) };
      }
      
      try {
        [projectsCount] = await db.select({ count: sql`count(*)`.as('count') }).from(projects);
      } catch (e) {
        console.log('Projects table query failed, using direct SQL');
        const result = await db.execute(sql`SELECT count(*) as count FROM projects`);
        projectsCount = { count: Number(result.rows[0].count) };
      }
      
      try {
        [totalValue] = await db.select({ total: sql`coalesce(sum(total), 0)`.as('total') }).from(budgets);
      } catch (e) {
        console.log('Budget total query failed, using direct SQL');
        const result = await db.execute(sql`SELECT coalesce(sum(total), 0) as total FROM budgets`);
        totalValue = { total: Number(result.rows[0].total) };
      }
      
      res.json({
        totalMaterials: Number(materialsCount.count),
        totalActivities: Number(activitiesCount.count),
        totalSuppliers: Number(suppliersCount.count),
        totalUsers: Number(usersCount.count),
        activeBudgets: Number(budgetsCount.count),
        totalProjects: Number(projectsCount.count),
        totalProjectValue: Number(totalValue.total),
        // Legacy format for backward compatibility
        materials: Number(materialsCount.count),
        activities: Number(activitiesCount.count),
        suppliers: Number(suppliersCount.count),
        users: Number(usersCount.count)
      });
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Fix composition connections - Development tool
  app.post('/api/admin/fix-composition-connections', requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { fixCompositionConnections } = await import('./fix-composition-connections.js');
      const results = await fixCompositionConnections();
      
      res.json({
        success: true,
        message: 'Composition connections fixed successfully',
        results
      });
    } catch (error) {
      console.error('❌ Error fixing composition connections:', error);
      res.status(500).json({ error: 'Failed to fix composition connections' });
    }
  });

  app.get("/api/growth-data", async (req, res) => {
    try {
      // Generate realistic growth data for the last 6 months
      const months = ['Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const growthData = months.map((month, index) => ({
        month,
        users: 120 + (index * 25) + Math.floor(Math.random() * 20),
        projects: 45 + (index * 8) + Math.floor(Math.random() * 10),
        budgets: 75 + (index * 15) + Math.floor(Math.random() * 15),
        suppliers: 30 + (index * 5) + Math.floor(Math.random() * 8),
        materials: 1200 + (index * 100) + Math.floor(Math.random() * 50),
        activities: 300 + (index * 25) + Math.floor(Math.random() * 20)
      }));
      
      res.json(growthData);
    } catch (error) {
      console.error("Error fetching growth data:", error);
      res.status(500).json({ message: "Failed to fetch growth data" });
    }
  });

  app.get("/api/growth-data", async (req, res) => {
    try {
      // Simple growth data for dashboard
      res.json([
        { month: "Ene", materials: 1200, activities: 300 },
        { month: "Feb", materials: 1400, activities: 350 },
        { month: "Mar", materials: 1600, activities: 400 },
        { month: "Abr", materials: 1762, activities: 455 }
      ]);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch growth data" });
    }
  });

  // Authentication routes (must be before /api middleware)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (user.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verificar contraseña con bcrypt
      const bcrypt = await import('bcryptjs');
      const isValidPassword = await bcrypt.default.compare(password, user[0].password);
      
      if (isValidPassword) {
        // Generar token JWT real
        const jwt = await import('jsonwebtoken');
        const token = jwt.default.sign(
          {
            userId: user[0].id,
            username: user[0].username,
            email: user[0].email,
            role: user[0].role
          },
          process.env.JWT_SECRET || 'micaa-secret-key',
          { expiresIn: '24h' }
        );
        
        res.json({
          success: true,
          user: {
            id: user[0].id,
            username: user[0].username,
            email: user[0].email,
            role: user[0].role
          },
          token: token
        });
      } else {
        res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password, firstName, lastName, userType } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ message: "Campos requeridos faltantes" });
      }

      // Check if username exists
      const existingUserByUsername = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existingUserByUsername.length > 0) {
        return res.status(409).json({ message: "El nombre de usuario ya existe" });
      }

      // Check if email exists
      const existingUserByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUserByEmail.length > 0) {
        return res.status(409).json({ message: "El email ya está registrado. ¿Olvidaste tu contraseña?" });
      }

      // Hash password
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash(password, 10);

      const newUser = await db.insert(users).values({
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: userType === 'supplier' ? 'supplier' : 'user'
      }).returning();

      // If supplier, create supplier company entry
      if (userType === 'supplier') {
        await db.insert(supplierCompanies).values({
          userId: newUser[0].id,
          companyName: `${firstName} ${lastName}`,
          businessType: 'construction',
          isActive: true
        });
      }

      res.json({
        success: true,
        user: {
          id: newUser[0].id,
          username: newUser[0].username,
          email: newUser[0].email,
          role: newUser[0].role
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Error en el registro" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "No authorization header" });
      }

      const token = authHeader.substring(7);
      
      // Verificar token JWT
      const jwt = await import('jsonwebtoken');
      let decoded;
      try {
        decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'micaa-secret-key');
      } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Buscar usuario actual en base de datos
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
      
      if (user.length === 0) {
        return res.status(401).json({ message: "User not found" });
      }

      const userData = user[0];
      res.json({
        id: userData.id,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        userType: userData.userType,
        city: userData.city,
        country: userData.country
      });
    } catch (error) {
      console.error("Auth verification error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  app.post("/api/auth/password-recovery", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email es requerido" });
      }

      // Buscar usuario por email
      const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      if (user.length === 0) {
        return res.status(404).json({ message: "No se encontró un usuario con ese email" });
      }

      const userData = user[0];
      
      // Generar contraseña temporal de 6 caracteres fácil de recordar
      const tempPassword = generateSimplePassword();
      // Hash de la nueva contraseña temporal
      const bcrypt = await import('bcryptjs');
      const hashedTempPassword = await bcrypt.default.hash(tempPassword, 10);
      
      // Actualizar contraseña en base de datos
      await db.update(users)
        .set({ password: hashedTempPassword })
        .where(eq(users.id, userData.id));
      
      // Enviar email con nueva contraseña temporal
      try {
        const emailServiceModule = await import('./email-service.js');
        const emailService = emailServiceModule.emailService;
        
        const emailSent = await emailService.sendPasswordRecovery(email, {
          username: userData.username,
          tempPassword: tempPassword,
          firstName: userData.firstName || userData.username,
          loginUrl: process.env.FRONTEND_URL || 'http://localhost:5000'
        });
        
        if (emailSent) {
          res.json({ 
            success: true, 
            message: "Se ha enviado una nueva contraseña temporal a tu email"
          });
        } else {
          res.json({
            success: true,
            message: "Contraseña temporal generada: " + tempPassword,
            tempPassword: tempPassword
          });
        }
      } catch (emailError) {
        console.error("Email service error:", emailError);
        res.json({
          success: true,
          message: "Contraseña temporal generada: " + tempPassword,
          tempPassword: tempPassword
        });
      }


      
    } catch (error) {
      console.error("Password recovery error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Función para generar contraseña simple de 6 caracteres
  function generateSimplePassword(): string {
    const words = ['casa', 'sol', 'mar', 'rio', 'luz', 'paz', 'red', 'azul', 'oro', 'luna'];
    const numbers = ['123', '456', '789', '101', '202', '303', '505', '606', '707', '808'];
    
    const word = words[Math.floor(Math.random() * words.length)];
    const number = numbers[Math.floor(Math.random() * numbers.length)];
    
    return word + number;
  }

  // Endpoint para cambiar contraseña del usuario autenticado
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Token de autenticación requerido" });
      }
      
      const token = authHeader.substring(7);
      
      // Verificar token JWT
      const jwt = await import('jsonwebtoken');
      let decoded;
      try {
        decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'micaa-secret-key');
      } catch (error) {
        return res.status(401).json({ message: "Token inválido" });
      }
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Contraseña actual y nueva son requeridas" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "La nueva contraseña debe tener al menos 6 caracteres" });
      }
      
      // Buscar usuario
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
      
      if (user.length === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const userData = user[0];
      
      // Verificar contraseña actual
      const bcrypt = await import('bcryptjs');
      const isValidPassword = await bcrypt.default.compare(currentPassword, userData.password);
      
      if (!isValidPassword) {
        return res.status(400).json({ message: "Contraseña actual incorrecta" });
      }
      
      // Hash de la nueva contraseña
      const hashedNewPassword = await bcrypt.default.hash(newPassword, 10);
      
      // Actualizar contraseña
      await db.update(users)
        .set({ password: hashedNewPassword })
        .where(eq(users.id, userData.id));
      
      res.json({ 
        success: true, 
        message: "Contraseña actualizada exitosamente" 
      });
      
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Crear proyecto
  app.post("/api/projects", requireAuth, async (req: any, res) => {
    try {
      console.log("Datos recibidos para crear proyecto:", req.body);
      
      const { startDate, ...otherData } = req.body;
      const projectData = {
        ...otherData,
        userId: req.user.id,
        startDate: startDate ? new Date(startDate) : null
      };
      
      console.log("Datos del proyecto antes de insertar:", projectData);
      
      // Insertar proyecto directamente en base de datos
      const [project] = await db.insert(projects).values(projectData).returning();
      
      console.log("Proyecto creado exitosamente:", project);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Obtener proyectos del usuario autenticado
  app.get("/api/projects", requireAuth, async (req: any, res) => {
    try {
      const userProjects = await db.select()
        .from(projects)
        .where(eq(projects.userId, req.user.id))
        .orderBy(desc(projects.createdAt));
      
      res.json(userProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // =====================================
  // ADMIN ROUTES - CRUD COMPLETO
  // =====================================

  // Admin middleware
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Token de autenticación requerido" });
      }

      const token = authHeader.substring(7);
      
      // Verificar token JWT
      const jwt = await import('jsonwebtoken');
      let decoded;
      try {
        decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'micaa-secret-key');
      } catch (error) {
        return res.status(401).json({ message: "Token inválido" });
      }

      // Buscar usuario
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
      
      if (user.length === 0) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      if (user[0].role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado: Se requiere rol de administrador' });
      }

      req.user = user[0];
      next();
    } catch (error) {
      console.error("Admin middleware error:", error);
      res.status(500).json({ message: "Error de autenticación" });
    }
  };

  // CRUD MATERIALES - ADMIN
  app.get("/api/admin/materials", requireAdmin, async (req, res) => {
    try {
      const { search, category, limit = '100' } = req.query;
      
      let materialsQuery = db.select().from(materials);
      
      if (search && typeof search === 'string') {
        materialsQuery = materialsQuery.where(like(materials.name, `%${search}%`));
      }
      
      if (category && typeof category === 'string') {
        materialsQuery = materialsQuery.where(eq(materials.categoryId, parseInt(category)));
      }
      
      const materialsData = await materialsQuery.limit(parseInt(limit as string));
      const categories = await db.select().from(materialCategories).orderBy(asc(materialCategories.name));
      
      const materialsWithCategories = materialsData.map(material => {
        const category = categories.find(c => c.id === material.categoryId);
        return {
          ...material,
          category: category || { id: 0, name: 'Sin Categoría' }
        };
      });
      
      res.json(materialsWithCategories);
    } catch (error) {
      console.error("Error fetching admin materials:", error);
      res.status(500).json({ message: "Failed to fetch materials" });
    }
  });

  app.post("/api/admin/materials", requireAdmin, async (req, res) => {
    try {
      const { name, unit, price, categoryId } = req.body;
      
      if (!name || !unit || !price || !categoryId) {
        return res.status(400).json({ message: "Todos los campos son requeridos" });
      }

      const newMaterial = await db.insert(materials).values({
        name,
        unit,
        price: parseFloat(price),
        categoryId: parseInt(categoryId)
      }).returning();

      res.status(201).json(newMaterial[0]);
    } catch (error) {
      console.error("Error creating material:", error);
      res.status(500).json({ message: "Failed to create material" });
    }
  });

  app.put("/api/admin/materials/:id", requireAdmin, async (req, res) => {
    try {
      const materialId = parseInt(req.params.id);
      const { name, unit, price, categoryId } = req.body;
      
      const updatedMaterial = await db.update(materials)
        .set({
          name,
          unit,
          price: parseFloat(price),
          categoryId: parseInt(categoryId)
        })
        .where(eq(materials.id, materialId))
        .returning();

      if (updatedMaterial.length === 0) {
        return res.status(404).json({ message: "Material no encontrado" });
      }

      res.json(updatedMaterial[0]);
    } catch (error) {
      console.error("Error updating material:", error);
      res.status(500).json({ message: "Failed to update material" });
    }
  });

  app.delete("/api/admin/materials/:id", requireAdmin, async (req, res) => {
    try {
      const materialId = parseInt(req.params.id);
      
      const deletedMaterial = await db.delete(materials)
        .where(eq(materials.id, materialId))
        .returning();

      if (deletedMaterial.length === 0) {
        return res.status(404).json({ message: "Material no encontrado" });
      }

      res.json({ message: "Material eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting material:", error);
      res.status(500).json({ message: "Failed to delete material" });
    }
  });

  // CRUD ANUNCIOS - ADMIN
  app.get("/api/admin/advertisements", requireAdmin, async (req, res) => {
    try {
      const advertisements = await db
        .select({
          id: companyAdvertisements.id,
          supplierId: companyAdvertisements.supplierId,
          title: companyAdvertisements.title,
          description: companyAdvertisements.description,
          imageUrl: companyAdvertisements.imageUrl,
          linkUrl: companyAdvertisements.linkUrl,
          startDate: companyAdvertisements.startDate,
          endDate: companyAdvertisements.endDate,
          isActive: companyAdvertisements.isActive,
          viewCount: companyAdvertisements.viewCount,
          clickCount: companyAdvertisements.clickCount,
          createdAt: companyAdvertisements.createdAt,
          supplier: {
            id: supplierCompanies.id,
            companyName: supplierCompanies.companyName,
          }
        })
        .from(companyAdvertisements)
        .leftJoin(supplierCompanies, eq(companyAdvertisements.supplierId, supplierCompanies.id))
        .orderBy(desc(companyAdvertisements.createdAt));

      res.json(advertisements);
    } catch (error) {
      console.error("Error fetching advertisements:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  app.post("/api/admin/advertisements", requireAdmin, async (req, res) => {
    try {
      const { supplierId, title, description, imageUrl, linkUrl, startDate, endDate, isActive } = req.body;
      
      if (!supplierId || !title || !description) {
        return res.status(400).json({ message: "Campos requeridos faltantes" });
      }

      const newAd = await db.insert(companyAdvertisements).values({
        supplierId: parseInt(supplierId),
        title,
        description,
        imageUrl,
        linkUrl,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive || true,
        viewCount: 0,
        clickCount: 0
      }).returning();

      res.status(201).json(newAd[0]);
    } catch (error) {
      console.error("Error creating advertisement:", error);
      res.status(500).json({ message: "Failed to create advertisement" });
    }
  });

  app.put("/api/admin/advertisements/:id", requireAdmin, async (req, res) => {
    try {
      const adId = parseInt(req.params.id);
      const { supplierId, title, description, imageUrl, linkUrl, startDate, endDate, isActive } = req.body;
      
      const updatedAd = await db.update(companyAdvertisements)
        .set({
          supplierId: parseInt(supplierId),
          title,
          description,
          imageUrl,
          linkUrl,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          isActive
        })
        .where(eq(companyAdvertisements.id, adId))
        .returning();

      if (updatedAd.length === 0) {
        return res.status(404).json({ message: "Anuncio no encontrado" });
      }

      res.json(updatedAd[0]);
    } catch (error) {
      console.error("Error updating advertisement:", error);
      res.status(500).json({ message: "Failed to update advertisement" });
    }
  });

  app.delete("/api/admin/advertisements/:id", requireAdmin, async (req, res) => {
    try {
      const adId = parseInt(req.params.id);
      
      const deletedAd = await db.delete(companyAdvertisements)
        .where(eq(companyAdvertisements.id, adId))
        .returning();

      if (deletedAd.length === 0) {
        return res.status(404).json({ message: "Anuncio no encontrado" });
      }

      res.json({ message: "Anuncio eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting advertisement:", error);
      res.status(500).json({ message: "Failed to delete advertisement" });
    }
  });

  // CRUD USUARIOS - ADMIN
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { role, isActive } = req.body;
      
      const updatedUser = await db.update(users)
        .set({
          role,
          isActive
        })
        .where(eq(users.id, userId))
        .returning();

      if (updatedUser.length === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      res.json(updatedUser[0]);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      const deletedUser = await db.delete(users)
        .where(eq(users.id, userId))
        .returning();

      if (deletedUser.length === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      res.json({ message: "Usuario eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // CRUD EMPRESAS PROVEEDORAS - ADMIN
  app.get("/api/admin/suppliers", requireAdmin, async (req, res) => {
    try {
      const suppliers = await db
        .select()
        .from(supplierCompanies)
        .orderBy(desc(supplierCompanies.createdAt));

      // Get user data separately for each supplier
      const suppliersWithUsers = await Promise.all(
        suppliers.map(async (supplier) => {
          let userData = null;
          if (supplier.userId) {
            const user = await db.select().from(users).where(eq(users.id, supplier.userId)).limit(1);
            if (user.length > 0) {
              userData = {
                id: user[0].id,
                username: user[0].username,
                email: user[0].email,
                role: user[0].role
              };
            }
          }
          return {
            ...supplier,
            user: userData
          };
        })
      );

      res.json(suppliersWithUsers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.put("/api/admin/suppliers/:id", requireAdmin, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const { companyName, businessType, phone, email, address, isActive } = req.body;
      
      const updatedSupplier = await db.update(supplierCompanies)
        .set({
          companyName,
          businessType,
          phone,
          email,
          address,
          isActive
        })
        .where(eq(supplierCompanies.id, supplierId))
        .returning();

      if (updatedSupplier.length === 0) {
        return res.status(404).json({ message: "Proveedor no encontrado" });
      }

      res.json(updatedSupplier[0]);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ message: "Failed to update supplier" });
    }
  });

  app.delete("/api/admin/suppliers/:id", requireAdmin, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      
      // Primero eliminar anuncios asociados
      await db.delete(companyAdvertisements)
        .where(eq(companyAdvertisements.supplierId, supplierId));
      
      // Luego eliminar el proveedor
      const deletedSupplier = await db.delete(supplierCompanies)
        .where(eq(supplierCompanies.id, supplierId))
        .returning();

      if (deletedSupplier.length === 0) {
        return res.status(404).json({ message: "Proveedor no encontrado" });
      }

      res.json({ message: "Proveedor eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ message: "Failed to delete supplier" });
    }
  });

  // GESTIÓN DE PRECIOS GLOBALES - ADMIN
  app.put("/api/admin/materials/:id/price", requireAdmin, async (req: any, res) => {
    try {
      console.log("=== ADMIN PRICE UPDATE REQUEST ===");
      console.log("Material ID:", req.params.id);
      console.log("Request body:", req.body);
      console.log("User:", req.user?.username, "Role:", req.user?.role);
      
      const materialId = parseInt(req.params.id);
      const { price } = req.body;
      
      if (!price || price <= 0) {
        console.log("Invalid price provided:", price);
        return res.status(400).json({ message: "Precio inválido" });
      }

      console.log("Updating material", materialId, "to price", price);
      const updatedMaterial = await db.update(materials)
        .set({ price: parseFloat(price) })
        .where(eq(materials.id, materialId))
        .returning();

      if (updatedMaterial.length === 0) {
        console.log("Material not found:", materialId);
        return res.status(404).json({ message: "Material no encontrado" });
      }

      console.log("Material updated successfully:", updatedMaterial[0]);
      res.json(updatedMaterial[0]);
    } catch (error) {
      console.error("Error updating material price:", error);
      res.status(500).json({ message: "Failed to update material price" });
    }
  });

  // NUEVA RUTA ALTERNATIVA PARA ACTUALIZAR PRECIOS
  app.post("/api/admin/update-material-price", requireAdmin, async (req: any, res) => {
    try {
      console.log("=== NUEVA RUTA PARA ACTUALIZAR PRECIO ===");
      console.log("Request body:", req.body);
      console.log("User:", req.user?.username, "Role:", req.user?.role);
      
      const { materialId, price } = req.body;
      
      if (!materialId || !price || price <= 0) {
        console.log("Invalid data provided:", { materialId, price });
        return res.status(400).json({ message: "Datos inválidos" });
      }

      console.log("Updating material", materialId, "to price", price);
      const updatedMaterial = await db.update(materials)
        .set({ price: parseFloat(price) })
        .where(eq(materials.id, parseInt(materialId)))
        .returning();

      if (updatedMaterial.length === 0) {
        console.log("Material not found:", materialId);
        return res.status(404).json({ message: "Material no encontrado" });
      }

      console.log("Material updated successfully:", updatedMaterial[0]);
      res.json({ 
        success: true,
        material: updatedMaterial[0],
        message: "Precio actualizado exitosamente" 
      });
    } catch (error) {
      console.error("Error updating material price:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/admin/bulk-price-update", requireAdmin, async (req, res) => {
    try {
      const { adjustmentFactor, categoryId } = req.body;
      
      if (!adjustmentFactor || adjustmentFactor <= 0) {
        return res.status(400).json({ message: "Factor de ajuste inválido" });
      }

      let updateQuery = db.update(materials)
        .set({ price: sql`${materials.price} * ${adjustmentFactor}` });

      if (categoryId) {
        updateQuery = updateQuery.where(eq(materials.categoryId, parseInt(categoryId)));
      }

      const result = await updateQuery.returning();

      res.json({ 
        message: "Precios actualizados exitosamente", 
        updatedMaterials: result.length 
      });
    } catch (error) {
      console.error("Error bulk updating prices:", error);
      res.status(500).json({ message: "Failed to update prices" });
    }
  });

  // PRICE SETTINGS ROUTES
  // Get current price settings
  app.get("/api/price-settings", async (req, res) => {
    try {
      const settings = await db.select().from(priceSettings).orderBy(desc(priceSettings.lastUpdated)).limit(1);
      
      if (settings.length === 0) {
        // Create default settings if none exist
        const defaultSettings = await db.insert(priceSettings).values({
          usdExchangeRate: "6.96",
          inflationFactor: "1.0000",
          globalAdjustmentFactor: "1.0000",
          updatedBy: "Sistema"
        }).returning();
        
        res.json(defaultSettings[0]);
      } else {
        res.json(settings[0]);
      }
    } catch (error) {
      console.error("Error fetching price settings:", error);
      res.status(500).json({ message: "Failed to fetch price settings" });
    }
  });

  // Update price settings
  app.put("/api/price-settings", requireAuth, async (req: any, res) => {
    try {
      const { usdExchangeRate, inflationFactor, globalAdjustmentFactor, updatedBy } = req.body;
      
      console.log("=== UPDATING PRICE SETTINGS ===");
      console.log("Request body:", req.body);
      console.log("User:", req.user?.username);

      // Get current settings or create default
      const currentSettings = await db.select().from(priceSettings).orderBy(desc(priceSettings.lastUpdated)).limit(1);
      
      let updatedSettings;
      if (currentSettings.length === 0) {
        // Insert new settings
        updatedSettings = await db.insert(priceSettings).values({
          usdExchangeRate: usdExchangeRate || "6.96",
          inflationFactor: inflationFactor || "1.0000",
          globalAdjustmentFactor: globalAdjustmentFactor || "1.0000",
          updatedBy: updatedBy || req.user?.username || "Usuario"
        }).returning();
      } else {
        // Update existing settings
        const updateData: any = {
          lastUpdated: new Date(),
          updatedBy: updatedBy || req.user?.username || "Usuario"
        };
        
        if (usdExchangeRate !== undefined) updateData.usdExchangeRate = usdExchangeRate;
        if (inflationFactor !== undefined) updateData.inflationFactor = inflationFactor;
        if (globalAdjustmentFactor !== undefined) updateData.globalAdjustmentFactor = globalAdjustmentFactor;
        
        updatedSettings = await db.update(priceSettings)
          .set(updateData)
          .where(eq(priceSettings.id, currentSettings[0].id))
          .returning();
      }

      console.log("Settings updated successfully:", updatedSettings[0]);
      res.json(updatedSettings[0]);
    } catch (error) {
      console.error("Error updating price settings:", error);
      res.status(500).json({ message: "Failed to update price settings" });
    }
  });

  // Apply global price adjustment to all materials
  app.post("/api/apply-price-adjustment", requireAuth, async (req: any, res) => {
    try {
      const { factor, updatedBy } = req.body;
      
      console.log("=== APPLYING GLOBAL PRICE ADJUSTMENT ===");
      console.log("Factor:", factor, "Updated by:", updatedBy);
      
      if (!factor || factor <= 0) {
        return res.status(400).json({ message: "Factor de ajuste inválido" });
      }

      // Apply adjustment to all materials
      const updatedMaterials = await db.update(materials)
        .set({ 
          price: sql`${materials.price} * ${factor}`,
          updatedAt: new Date()
        })
        .returning();

      // Update the global adjustment factor in settings
      const currentSettings = await db.select().from(priceSettings).orderBy(desc(priceSettings.lastUpdated)).limit(1);
      
      if (currentSettings.length > 0) {
        await db.update(priceSettings)
          .set({
            globalAdjustmentFactor: factor.toString(),
            lastUpdated: new Date(),
            updatedBy: updatedBy || req.user?.username || "Usuario"
          })
          .where(eq(priceSettings.id, currentSettings[0].id));
      }

      console.log(`Applied factor ${factor} to ${updatedMaterials.length} materials`);
      res.json({ 
        affectedMaterials: updatedMaterials.length,
        factor: factor,
        message: "Ajuste global aplicado exitosamente"
      });
    } catch (error) {
      console.error("Error applying price adjustment:", error);
      res.status(500).json({ message: "Failed to apply price adjustment" });
    }
  });

  // IMAGE UPLOAD ROUTE FOR ADMIN ADVERTISEMENTS
  const multer = await import('multer');
  const path = await import('path');
  const fs = await import('fs');

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.default.join(process.cwd(), 'uploads');
  if (!fs.default.existsSync(uploadsDir)) {
    fs.default.mkdirSync(uploadsDir, { recursive: true });
  }

  // Configure multer for image uploads
  const storage = multer.default.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const ext = path.default.extname(file.originalname);
      const filename = `admin-ad-${timestamp}${ext}`;
      cb(null, filename);
    }
  });

  const upload = multer.default({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes.'), false);
      }
    }
  });

  // Admin image upload route
  app.post("/api/admin/advertisements/upload-image", requireAdmin, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó archivo de imagen" });
      }

      const imagePath = `/uploads/${req.file.filename}`;
      
      console.log(`Image uploaded successfully: ${imagePath}`);
      
      res.json({ 
        imagePath,
        message: "Imagen subida exitosamente"
      });
    } catch (error) {
      console.error("Error uploading admin advertisement image:", error);
      res.status(500).json({ message: "Error al subir la imagen" });
    }
  });

  // Serve uploaded files statically
  app.use('/uploads', (await import('express')).static(uploadsDir));

  // BULK EMAIL ROUTES FOR ADMIN
  const { bulkEmailService } = await import('./email-bulk-service');

  // Crear trabajo de envío masivo
  app.post("/api/admin/bulk-email", requireAdmin, async (req, res) => {
    try {
      const { template, customSubject } = req.body;
      
      if (!['password_update', 'advertisement_reminder', 'data_update'].includes(template)) {
        return res.status(400).json({ message: "Template inválido" });
      }

      const jobId = await bulkEmailService.createBulkEmailJob(template, customSubject);
      
      res.json({ 
        jobId,
        message: "Trabajo de envío masivo creado exitosamente",
        note: "Se han enviado emails de prueba a domarquez@yahoo.com y grupoeclipsew@gmail.com. Los emails masivos se enviarán con pausas de 5 minutos entre cada uno para evitar problemas de spam"
      });
    } catch (error) {
      console.error("Error creating bulk email job:", error);
      res.status(500).json({ message: "Error al crear trabajo de envío masivo" });
    }
  });

  // Enviar solo emails de prueba
  app.post("/api/admin/bulk-email/test", requireAdmin, async (req, res) => {
    try {
      const { template, customSubject } = req.body;
      
      if (!['password_update', 'advertisement_reminder', 'data_update'].includes(template)) {
        return res.status(400).json({ message: "Template inválido" });
      }

      let subject = '';
      switch (template) {
        case 'password_update':
          subject = 'MICAA - Actualiza tu contraseña y accede a nuevas funcionalidades';
          break;
        case 'advertisement_reminder':
          subject = 'MICAA - Promociona tu empresa con nuestro sistema de publicidad';
          break;
        case 'data_update':
          subject = 'MICAA - Actualiza los datos de tu empresa';
          break;
      }

      await bulkEmailService.sendTestEmails(template, customSubject || subject);
      
      res.json({ 
        message: "Emails de prueba enviados exitosamente",
        recipients: ["domarquez@yahoo.com", "grupoeclipsew@gmail.com"]
      });
    } catch (error) {
      console.error("Error sending test emails:", error);
      res.status(500).json({ message: "Error al enviar emails de prueba" });
    }
  });

  // Obtener estado de trabajo
  app.get("/api/admin/bulk-email/:jobId", requireAdmin, async (req, res) => {
    try {
      const jobId = req.params.jobId;
      const job = bulkEmailService.getJobStatus(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Trabajo no encontrado" });
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error getting job status:", error);
      res.status(500).json({ message: "Error al obtener estado del trabajo" });
    }
  });

  // Obtener todos los trabajos
  app.get("/api/admin/bulk-email", requireAdmin, async (req, res) => {
    try {
      const jobs = bulkEmailService.getAllJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error getting all jobs:", error);
      res.status(500).json({ message: "Error al obtener trabajos" });
    }
  });

  // ADMIN ACTIVITY MANAGEMENT ENDPOINTS
  
  // Update activity phase
  app.put("/api/admin/activities/:id/phase", requireAdmin, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const { phaseId } = req.body;
      
      if (!phaseId || isNaN(parseInt(phaseId))) {
        return res.status(400).json({ message: "ID de fase inválido" });
      }

      const updatedActivity = await db.update(activities)
        .set({ phaseId: parseInt(phaseId) })
        .where(eq(activities.id, activityId))
        .returning();

      if (updatedActivity.length === 0) {
        return res.status(404).json({ message: "Actividad no encontrada" });
      }

      res.json(updatedActivity[0]);
    } catch (error) {
      console.error("Error updating activity phase:", error);
      res.status(500).json({ message: "Error al actualizar fase de actividad" });
    }
  });

  // Bulk move activities
  app.post("/api/admin/activities/bulk-move", requireAdmin, async (req, res) => {
    try {
      const { fromPhaseId, toPhaseId, keyword } = req.body;
      
      if (!fromPhaseId || !toPhaseId || !keyword) {
        return res.status(400).json({ message: "Todos los campos son requeridos" });
      }

      const result = await db
        .update(activities)
        .set({ phaseId: parseInt(toPhaseId) })
        .where(and(
          eq(activities.phaseId, parseInt(fromPhaseId)),
          like(activities.name, `%${keyword}%`)
        ))
        .returning({ id: activities.id });

      res.json({ 
        count: result.length,
        message: `Se movieron ${result.length} actividades de la fase ${fromPhaseId} a la fase ${toPhaseId}`
      });
    } catch (error) {
      console.error("Error bulk moving activities:", error);
      res.status(500).json({ message: "Error al mover actividades masivamente" });
    }
  });

  // Obtener lista de empresas para preview
  app.get("/api/admin/bulk-email-preview", requireAdmin, async (req, res) => {
    try {
      const companies = await bulkEmailService.getSupplierCompaniesForBulkEmail();
      res.json({
        totalCompanies: companies.length,
        companies: companies.slice(0, 10), // Solo primeras 10 para preview
        estimatedTime: `${Math.ceil(companies.length * 5)} minutos aproximadamente`
      });
    } catch (error) {
      console.error("Error getting companies preview:", error);
      res.status(500).json({ message: "Error al obtener preview de empresas" });
    }
  });

  // BUDGETS ENDPOINTS
  
  // Create budget
  app.post("/api/budgets", requireAuth, async (req, res) => {
    try {
      const { projectId, phaseId, total, status } = req.body;
      
      if (!projectId || !total) {
        return res.status(400).json({ message: "Datos incompletos para crear presupuesto" });
      }

      const budget = await dbStorage.createBudget({
        projectId: parseInt(projectId),
        phaseId: phaseId ? parseInt(phaseId) : null,
        total: parseFloat(total),
        status: status || "active"
      });

      res.status(201).json(budget);
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Error al crear presupuesto" });
    }
  });

  // Get budgets by user
  app.get("/api/budgets", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const budgets = await dbStorage.getBudgetsByUserId(userId);
      res.json(budgets);
    } catch (error) {
      console.error("Error getting budgets:", error);
      res.status(500).json({ message: "Error al obtener presupuestos" });
    }
  });

  // Update budget
  app.put("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.id);
      const updateData = req.body;

      const updatedBudget = await dbStorage.updateBudget(budgetId, updateData);
      res.json(updatedBudget);
    } catch (error) {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Error al actualizar presupuesto" });
    }
  });

  // Delete budget
  app.delete("/api/budgets/:id", requireAuth, async (req, res) => {
    try {
      const budgetId = parseInt(req.params.id);
      await dbStorage.deleteBudget(budgetId);
      res.json({ message: "Presupuesto eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Error al eliminar presupuesto" });
    }
  });

  // BUDGET ITEMS ENDPOINTS
  
  // Create budget item
  app.post("/api/budget-items", requireAuth, async (req, res) => {
    try {
      const { budgetId, activityId, phaseId, quantity, unitPrice, subtotal } = req.body;
      
      if (!budgetId || !activityId || !quantity || !unitPrice) {
        return res.status(400).json({ message: "Datos incompletos para crear elemento de presupuesto" });
      }

      const budgetItem = await dbStorage.createBudgetItem({
        budgetId: parseInt(budgetId),
        activityId: parseInt(activityId),
        phaseId: phaseId ? parseInt(phaseId) : null,
        quantity: parseFloat(quantity),
        unitPrice: parseFloat(unitPrice),
        subtotal: parseFloat(subtotal)
      });

      res.status(201).json(budgetItem);
    } catch (error) {
      console.error("Error creating budget item:", error);
      res.status(500).json({ message: "Error al crear elemento de presupuesto" });
    }
  });

  // Get budget items by budget ID
  app.get("/api/budget-items", requireAuth, async (req, res) => {
    try {
      const { budgetId } = req.query;
      
      if (!budgetId) {
        return res.status(400).json({ message: "ID de presupuesto requerido" });
      }

      const items = await dbStorage.getBudgetItemsByBudgetId(parseInt(budgetId as string));
      res.json(items);
    } catch (error) {
      console.error("Error getting budget items:", error);
      res.status(500).json({ message: "Error al obtener elementos del presupuesto" });
    }
  });

  // Update budget item
  app.put("/api/budget-items/:id", requireAuth, async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const updateData = req.body;

      const updatedItem = await dbStorage.updateBudgetItem(itemId, updateData);
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating budget item:", error);
      res.status(500).json({ message: "Error al actualizar elemento del presupuesto" });
    }
  });

  // Delete budget item
  app.delete("/api/budget-items/:id", requireAuth, async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      await dbStorage.deleteBudgetItem(itemId);
      res.json({ message: "Elemento eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting budget item:", error);
      res.status(500).json({ message: "Error al eliminar elemento del presupuesto" });
    }
  });

  // Register all routes under /api
  app.use('/api', router);
  
  console.log('API routes registered successfully');
  return app;
}