import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users, materials, activities, constructionPhases, materialCategories, customActivities, customActivityCompositions, laborCategories, tools, userActivities, userActivityCompositions, activityCompositions, projects, budgets, budgetItems } from '../shared/schema';
import { eq, like, desc, asc, and } from 'drizzle-orm';
import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Custom JWT payload interface
interface CustomJwtPayload extends JwtPayload {
  userId: number;
  username: string;
  email: string;
  role: string;
}

// Extended request interface for authentication
interface AuthRequest extends Request {
  user?: any;
}

// Middleware de autenticación
const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

  // Test route to verify DB connection
  router.get('/test-db', async (req: Request, res: Response) => {
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
  router.get('/users', async (req: Request, res: Response) => {
    try {
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Materials routes
  router.get('/materials', async (req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const { search, category, limit = '50' } = req.query;
      
      let materialsData;
      if (search && typeof search === 'string') {
        materialsData = await db.select().from(materials)
          .where(like(materials.name, `%${search}%`))
          .limit(parseInt(limit as string));
      } else if (category && typeof category === 'string') {
        materialsData = await db.select().from(materials)
          .where(eq(materials.categoryId, parseInt(category)))
          .limit(parseInt(limit as string));
      } else {
        materialsData = await db.select().from(materials)
          .limit(parseInt(limit as string));
      }
      
      // Get all categories
      const categories = await db.select().from(materialCategories).orderBy(asc(materialCategories.name));
      
      // Combine materials with category information
      const materialsWithCategories = materialsData.map(material => {
        const category = categories.find(c => c.id === material.categoryId);
        return {
          ...material,
          category: category || { id: 0, name: 'Sin Categoría' }
        };
      });
      
      res.json(materialsWithCategories);
    } catch (error) {
      console.error('Materials fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch materials' });
    }
  });

  // Material categories
  router.get('/material-categories', async (req: Request, res: Response) => {
    try {
      const categories = await db.select().from(materialCategories).orderBy(asc(materialCategories.name));
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch material categories' });
    }
  });

  // Activities routes
  router.get('/activities', async (req: Request, res: Response) => {
    try {
      const { search, phase, limit = '100', offset = '0' } = req.query;
      
      // Get user ID from auth token if present
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'micaa-secret-key') as any;
          userId = decoded.userId;
        } catch (error) {
          // Token invalid, continue without user context
        }
      }
      
      let activitiesData;
      if (search && typeof search === 'string') {
        activitiesData = await db.select().from(activities)
          .where(like(activities.name, `%${search}%`))
          .limit(parseInt(limit as string))
          .offset(parseInt(offset as string));
      } else if (phase && typeof phase === 'string') {
        activitiesData = await db.select().from(activities)
          .where(eq(activities.phaseId, parseInt(phase)))
          .limit(parseInt(limit as string))
          .offset(parseInt(offset as string));
      } else {
        activitiesData = await db.select().from(activities)
          .limit(parseInt(limit as string))
          .offset(parseInt(offset as string));
      }
      
      // Get all phases
      const phases = await db.select().from(constructionPhases);
      
      // Get user duplicated activities if user is authenticated
      let userDuplicatedActivities: any[] = [];
      if (userId) {
        userDuplicatedActivities = await db.select().from(userActivities)
          .where(eq(userActivities.userId, userId));
        console.log(`🔍 Found ${userDuplicatedActivities.length} user duplicated activities for user ${userId}`);
      }
      
      // Combine activities with phase information and user data
      const activitiesWithPhases = [];
      
      // First, add all original activities
      for (const activity of activitiesData) {
        const phase = phases.find(p => p.id === activity.phaseId);
        const hasCustomActivity = userDuplicatedActivities.some(ua => ua.originalActivityId === activity.id);
        
        activitiesWithPhases.push({
          ...activity,
          phase: phase || { id: 0, name: 'Sin Fase', description: '' },
          hasCustomActivity,
          isOriginal: true
        });
        
        // If user has duplicated this activity, add the custom version right after
        const userActivity = userDuplicatedActivities.find(ua => ua.originalActivityId === activity.id);
        if (userActivity) {
          activitiesWithPhases.push({
            id: userActivity.id + 10000, // Custom activity ID
            phaseId: userActivity.phaseId,
            name: userActivity.customActivityName,
            unit: userActivity.unit,
            description: userActivity.description,
            unitPrice: activity.unitPrice, // Keep original unit price
            createdBy: null,
            originalActivityId: userActivity.originalActivityId,
            isSystemDefault: false,
            isPublic: false,
            createdAt: userActivity.createdAt,
            updatedAt: userActivity.updatedAt,
            phase: phase || { id: 0, name: 'Sin Fase', description: '' },
            hasCustomActivity: false,
            isOriginal: false // This is a custom activity
          });
        }
      }
      
      res.json({
        activities: activitiesWithPhases,
        totalCount: activitiesWithPhases.length,
        currentPage: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
        totalPages: Math.ceil(activitiesWithPhases.length / parseInt(limit as string)),
        limit: parseInt(limit as string)
      });
    } catch (error) {
      console.error('Activities fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch activities' });
    }
  });

  // Get activity compositions 
  router.get('/activities/:id/compositions', async (req: Request, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      if (isNaN(activityId)) {
        return res.status(400).json({ error: 'Invalid activity ID' });
      }

      console.log(`🔍 Getting compositions for activity ${activityId}`);
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
  router.get('/activities/:id/apu-calculation', async (req: Request, res: Response) => {
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
  router.post('/activities/:id/duplicate', async (req: Request, res: Response) => {
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

      // Copy compositions to user activity
      if (originalCompositions.length > 0) {
        await db.insert(userActivityCompositions).values(
          originalCompositions.map(comp => ({
            userActivityId: userActivity.id,
            materialId: comp.materialId,
            laborId: comp.laborId,
            toolId: comp.toolId,
            description: comp.description,
            unit: comp.unit,
            quantity: comp.quantity,
            unitCost: comp.unitCost,
            type: comp.type
          }))
        );
      }

      res.json({
        message: 'Activity duplicated successfully',
        userActivityId: userActivity.id,
        customActivityId: userActivity.id + 10000
      });
    } catch (error) {
      console.error('Activity duplication error:', error);
      res.status(500).json({ error: 'Failed to duplicate activity' });
    }
  });

  // Construction phases
  router.get('/construction-phases', async (req: Request, res: Response) => {
    try {
      const phases = await db.select().from(constructionPhases);
      res.json(phases);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch construction phases' });
    }
  });

  // Authentication routes
  router.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
      }

      // Find user by username
      const userResults = await db.select().from(users).where(eq(users.username, username)).limit(1);
      
      if (userResults.length === 0) {
        return res.status(401).json({ message: "Credenciales incorrectas" });
      }

      const user = userResults[0];

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ message: "Cuenta desactivada. Contacte al administrador" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Credenciales incorrectas" });
      }

      // Generate token
      const token = jwt.sign(
        { 
          userId: user.id,
          username: user.username,
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET || 'micaa-secret-key',
        { expiresIn: '7d' }
      );

      // Update last login (optional - can be skipped for simplicity)
      try {
        await db.update(users)
          .set({ lastLogin: new Date() })
          .where(eq(users.id, user.id));
      } catch (updateError) {
        // Don't fail login if update fails
        console.warn('Failed to update last login:', updateError);
      }

      res.json({
        message: "Login exitoso",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          userType: user.userType
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  router.get('/auth/me', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Token no proporcionado" });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'micaa-secret-key') as CustomJwtPayload;
      
      const userResults = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
      
      if (userResults.length === 0) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      const user = userResults[0];
      
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        userType: user.userType
      });
    } catch (error) {
      res.status(401).json({ message: "Token inválido" });
    }
  });

  // Public endpoints for frontend
  router.get('/public/materials', async (req: Request, res: Response) => {
    try {
      const materialsData = await db.select().from(materials).limit(20);
      const categories = await db.select().from(materialCategories);
      
      const materialsWithCategories = materialsData.map(material => {
        const category = categories.find(c => c.id === material.categoryId);
        return {
          ...material,
          category: category || { id: 0, name: 'Sin Categoría' }
        };
      });
      
      res.json(materialsWithCategories);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch public materials' });
    }
  });

  router.get('/public/material-categories', async (req: Request, res: Response) => {
    try {
      const categories = await db.select().from(materialCategories).limit(10);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch public categories' });
    }
  });

  router.get('/public/suppliers', async (req: Request, res: Response) => {
    try {
      // Return empty array for now since suppliers table might not be populated
      res.json([]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  });

  router.get('/public/dual-advertisements', async (req: Request, res: Response) => {
    try {
      // Return empty array for now
      res.json([]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch advertisements' });
    }
  });

  router.get('/statistics', async (req: Request, res: Response) => {
    try {
      // Basic statistics
      const materialsCount = await db.select().from(materials);
      const activitiesCount = await db.select().from(activities);
      const usersCount = await db.select().from(users);
      
      res.json({
        totalMaterials: materialsCount.length,
        totalActivities: activitiesCount.length,
        totalUsers: usersCount.length,
        totalSuppliers: 0
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  router.get('/growth-data', async (req: Request, res: Response) => {
    try {
      // Return mock growth data for charts
      res.json([
        { month: 'Ene', users: 120, projects: 45 },
        { month: 'Feb', users: 150, projects: 52 },
        { month: 'Mar', users: 180, projects: 61 },
        { month: 'Abr', users: 210, projects: 73 },
        { month: 'May', users: 240, projects: 84 },
        { month: 'Jun', users: 280, projects: 92 }
      ]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch growth data' });
    }
  });

  // Custom Activities endpoints
  router.get('/custom-activities', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userCustomActivities = await db.select().from(customActivities)
        .where(eq(customActivities.userId, req.user.id))
        .orderBy(desc(customActivities.createdAt));
      
      // Get phase information for each activity
      const phases = await db.select().from(constructionPhases);
      
      const activitiesWithPhases = userCustomActivities.map(activity => {
        const phase = phases.find(p => p.id === activity.phaseId);
        return {
          ...activity,
          phase: phase || { id: 0, name: 'Sin Fase' }
        };
      });
      
      res.json(activitiesWithPhases);
    } catch (error) {
      console.error('Fetch custom activities error:', error);
      res.status(500).json({ error: 'Failed to fetch custom activities' });
    }
  });

  router.post('/custom-activities', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { name, unit, description, phaseId } = req.body;
      
      if (!name || !unit || !phaseId) {
        return res.status(400).json({ message: "Nombre, unidad y fase son requeridos" });
      }

      // Insert the new custom activity into the database
      const [newActivity] = await db.insert(customActivities).values({
        userId: req.user.id,
        name,
        unit,
        description: description || '',
        phaseId: parseInt(phaseId)
      }).returning();

      res.json({
        message: "Actividad personalizada creada exitosamente",
        activity: newActivity
      });
    } catch (error) {
      console.error('Create custom activity error:', error);
      res.status(500).json({ message: "Error al crear la actividad personalizada" });
    }
  });

  // Custom Activity Compositions endpoints
  router.get('/custom-activities/:id/compositions', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      
      // Verify the activity belongs to the user
      const [activity] = await db.select().from(customActivities)
        .where(and(
          eq(customActivities.id, activityId),
          eq(customActivities.userId, req.user.id)
        ))
        .limit(1);
      
      if (!activity) {
        return res.status(404).json({ message: "Actividad no encontrada" });
      }
      
      // Get compositions for this activity
      const compositions = await db.select().from(customActivityCompositions)
        .where(eq(customActivityCompositions.customActivityId, activityId))
        .orderBy(customActivityCompositions.type, customActivityCompositions.description);
      
      res.json(compositions);
    } catch (error) {
      console.error('Fetch compositions error:', error);
      res.status(500).json({ error: 'Failed to fetch compositions' });
    }
  });

  router.post('/custom-activities/:id/compositions', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      const { description, unit, quantity, unitCost, type, materialId, laborId, toolId } = req.body;
      
      if (!description || !unit || !quantity || !unitCost || !type) {
        return res.status(400).json({ message: "Todos los campos son requeridos" });
      }
      
      // Verify the activity belongs to the user
      const [activity] = await db.select().from(customActivities)
        .where(and(
          eq(customActivities.id, activityId),
          eq(customActivities.userId, req.user.id)
        ))
        .limit(1);
      
      if (!activity) {
        return res.status(404).json({ message: "Actividad no encontrada" });
      }
      
      // Insert new composition
      const [newComposition] = await db.insert(customActivityCompositions).values({
        customActivityId: activityId,
        description,
        unit,
        quantity: quantity.toString(),
        unitCost: unitCost.toString(),
        type,
        materialId: materialId || null,
        laborId: laborId || null,
        toolId: toolId || null
      }).returning();
      
      res.json({
        message: "Composición agregada exitosamente",
        composition: newComposition
      });
    } catch (error) {
      console.error('Create composition error:', error);
      res.status(500).json({ message: "Error al crear la composición" });
    }
  });

  router.put('/custom-activities/:id/compositions/:compositionId', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      const compositionId = parseInt(req.params.compositionId);
      const { description, unit, quantity, unitCost } = req.body;
      
      // Verify the activity belongs to the user
      const [activity] = await db.select().from(customActivities)
        .where(and(
          eq(customActivities.id, activityId),
          eq(customActivities.userId, req.user.id)
        ))
        .limit(1);
      
      if (!activity) {
        return res.status(404).json({ message: "Actividad no encontrada" });
      }
      
      // Update composition
      const [updatedComposition] = await db.update(customActivityCompositions)
        .set({
          description,
          unit,
          quantity: quantity.toString(),
          unitCost: unitCost.toString()
        })
        .where(and(
          eq(customActivityCompositions.id, compositionId),
          eq(customActivityCompositions.customActivityId, activityId)
        ))
        .returning();
      
      if (!updatedComposition) {
        return res.status(404).json({ message: "Composición no encontrada" });
      }
      
      res.json({
        message: "Composición actualizada exitosamente",
        composition: updatedComposition
      });
    } catch (error) {
      console.error('Update composition error:', error);
      res.status(500).json({ message: "Error al actualizar la composición" });
    }
  });

  router.delete('/custom-activities/:id/compositions/:compositionId', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      const compositionId = parseInt(req.params.compositionId);
      
      // Verify the activity belongs to the user
      const [activity] = await db.select().from(customActivities)
        .where(and(
          eq(customActivities.id, activityId),
          eq(customActivities.userId, req.user.id)
        ))
        .limit(1);
      
      if (!activity) {
        return res.status(404).json({ message: "Actividad no encontrada" });
      }
      
      // Delete composition
      await db.delete(customActivityCompositions)
        .where(and(
          eq(customActivityCompositions.id, compositionId),
          eq(customActivityCompositions.customActivityId, activityId)
        ));
      
      res.json({ message: "Composición eliminada exitosamente" });
    } catch (error) {
      console.error('Delete composition error:', error);
      res.status(500).json({ message: "Error al eliminar la composición" });
    }
  });

  router.get('/user-activities', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      console.log(`🔍 Fetching user activities for user ID: ${req.user.id}`);
      
      const userDuplicatedActivities = await db.select().from(userActivities)
        .where(eq(userActivities.userId, req.user.id))
        .orderBy(desc(userActivities.createdAt));
      
      console.log(`📋 Found ${userDuplicatedActivities.length} user activities`);
      
      // Get phase information for each activity
      const phases = await db.select().from(constructionPhases);
      
      const activitiesWithPhases = userDuplicatedActivities.map(activity => {
        const phase = phases.find(p => p.id === activity.phaseId);
        return {
          ...activity,
          phase: phase || { id: 0, name: 'Sin Fase' },
          // Add the custom activity ID format (original ID + 10000)
          customActivityId: activity.id + 10000
        };
      });
      
      res.json(activitiesWithPhases);
    } catch (error) {
      console.error('Fetch user activities error:', error);
      res.status(500).json({ error: 'Failed to fetch user activities' });
    }
  });

  router.get('/budgets', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      console.log(`Fetching budgets for user ${req.user.id}`);
      
      // Obtener presupuestos del usuario con información del proyecto
      const userBudgets = await db.select()
        .from(budgets)
        .innerJoin(projects, eq(budgets.projectId, projects.id))
        .where(eq(projects.userId, req.user.id))
        .orderBy(desc(budgets.createdAt));

      // Formatear los datos para el tipo BudgetWithProject
      const formattedBudgets = userBudgets.map(row => ({
        id: row.budgets.id,
        projectId: row.budgets.projectId,
        phaseId: row.budgets.phaseId,
        total: row.budgets.total,
        status: row.budgets.status,
        createdAt: row.budgets.createdAt,
        updatedAt: row.budgets.updatedAt,
        project: {
          id: row.projects.id,
          name: row.projects.name,
          client: row.projects.client,
          location: row.projects.location,
          city: row.projects.city,
          country: row.projects.country,
          startDate: row.projects.startDate,
          userId: row.projects.userId,
          status: row.projects.status,
          equipmentPercentage: row.projects.equipmentPercentage,
          administrativePercentage: row.projects.administrativePercentage,
          utilityPercentage: row.projects.utilityPercentage,
          taxPercentage: row.projects.taxPercentage,
          socialChargesPercentage: row.projects.socialChargesPercentage,
          createdAt: row.projects.createdAt,
          updatedAt: row.projects.updatedAt
        },
        phase: null // Para presupuestos multifase
      }));
      
      console.log(`Found ${formattedBudgets.length} budgets for user ${req.user.id}`);
      
      res.json(formattedBudgets);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      res.status(500).json({ error: 'Failed to fetch budgets' });
    }
  });

  // Get specific budget with items endpoint  
  router.get('/budgets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const budgetId = parseInt(req.params.id);
      console.log(`Fetching budget ${budgetId} for user ${req.user.id}`);
      
      // Obtener el presupuesto con proyecto
      const budgetQuery = await db.select()
        .from(budgets)
        .innerJoin(projects, eq(budgets.projectId, projects.id))
        .where(and(eq(budgets.id, budgetId), eq(projects.userId, req.user.id)))
        .limit(1);
      
      if (budgetQuery.length === 0) {
        return res.status(404).json({ error: 'Budget not found' });
      }
      
      const budgetRow = budgetQuery[0];
      
      // Obtener los elementos del presupuesto con actividades
      const budgetItemsQuery = await db.select({
        id: budgetItems.id,
        budgetId: budgetItems.budgetId,
        activityId: budgetItems.activityId,
        phaseId: budgetItems.phaseId,
        quantity: budgetItems.quantity,
        unitPrice: budgetItems.unitPrice,
        subtotal: budgetItems.subtotal,
        activityName: activities.name,
        activityUnit: activities.unit,
        phaseName: constructionPhases.name
      })
        .from(budgetItems)
        .innerJoin(activities, eq(budgetItems.activityId, activities.id))
        .leftJoin(constructionPhases, eq(budgetItems.phaseId, constructionPhases.id))
        .where(eq(budgetItems.budgetId, budgetId))
        .orderBy(budgetItems.id);
      
      // Formatear respuesta
      const budgetWithItems = {
        id: budgetRow.budgets.id,
        projectId: budgetRow.budgets.projectId,
        phaseId: budgetRow.budgets.phaseId,
        total: budgetRow.budgets.total,
        status: budgetRow.budgets.status,
        createdAt: budgetRow.budgets.createdAt,
        updatedAt: budgetRow.budgets.updatedAt,
        project: {
          id: budgetRow.projects.id,
          name: budgetRow.projects.name,
          client: budgetRow.projects.client,
          location: budgetRow.projects.location,
          city: budgetRow.projects.city,
          country: budgetRow.projects.country,
          startDate: budgetRow.projects.startDate,
          userId: budgetRow.projects.userId,
          status: budgetRow.projects.status,
          equipmentPercentage: budgetRow.projects.equipmentPercentage,
          administrativePercentage: budgetRow.projects.administrativePercentage,
          utilityPercentage: budgetRow.projects.utilityPercentage,
          taxPercentage: budgetRow.projects.taxPercentage,
          socialChargesPercentage: budgetRow.projects.socialChargesPercentage,
          createdAt: budgetRow.projects.createdAt,
          updatedAt: budgetRow.projects.updatedAt
        },
        phase: null,
        items: budgetItemsQuery.map(item => ({
          id: item.id,
          budgetId: item.budgetId,
          activityId: item.activityId,
          phaseId: item.phaseId,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          subtotal: parseFloat(item.subtotal),
          activity: {
            id: item.activityId,
            name: item.activityName,
            unit: item.activityUnit,
            phase: item.phaseName ? { name: item.phaseName } : null
          }
        }))
      };
      
      console.log(`Found budget ${budgetId} with ${budgetWithItems.items.length} items`);
      res.json(budgetWithItems);
      
    } catch (error) {
      console.error('Error fetching budget:', error);
      res.status(500).json({ error: 'Failed to fetch budget' });
    }
  });

  // Budget creation endpoint
  router.post('/budgets', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      console.log("Datos recibidos para crear presupuesto:", req.body);
      
      const { projectId, phaseId, total, status } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ message: "ID del proyecto es requerido" });
      }
      
      if (!total || total <= 0) {
        return res.status(400).json({ message: "El total del presupuesto debe ser mayor a 0" });
      }
      
      // Verificar que el proyecto pertenece al usuario
      const project = await db.select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, req.user.id)))
        .limit(1);
      
      if (project.length === 0) {
        return res.status(404).json({ message: "Proyecto no encontrado" });
      }
      
      // Crear el presupuesto
      const budgetData = {
        projectId: projectId,
        phaseId: phaseId || null,
        total: total.toString(),
        status: status || 'draft'
      };
      
      console.log("Creando presupuesto:", budgetData);
      
      const [budget] = await db.insert(budgets).values(budgetData).returning();
      
      console.log("Presupuesto creado exitosamente:", budget);
      
      res.status(201).json({
        id: budget.id,
        projectId: budget.projectId,
        phaseId: budget.phaseId,
        total: budget.total,
        status: budget.status,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
        message: "Presupuesto creado exitosamente"
      });
      
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Error al crear el presupuesto" });
    }
  });

  // Budget items creation endpoint
  router.post('/budget-items', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      console.log("Datos recibidos para crear item del presupuesto:", req.body);
      
      const { budgetId, activityId, phaseId, quantity, unitPrice, subtotal } = req.body;
      
      if (!budgetId || !activityId || !quantity || !unitPrice) {
        return res.status(400).json({ message: "Todos los campos son requeridos" });
      }
      
      // Verificar que el presupuesto existe y pertenece a un proyecto del usuario
      const budgetCheck = await db.select({
        budgetId: budgets.id,
        projectUserId: projects.userId
      })
        .from(budgets)
        .innerJoin(projects, eq(budgets.projectId, projects.id))
        .where(and(eq(budgets.id, budgetId), eq(projects.userId, req.user.id)))
        .limit(1);
      
      if (budgetCheck.length === 0) {
        return res.status(404).json({ message: "Presupuesto no encontrado" });
      }
      
      const itemData = {
        budgetId: budgetId,
        activityId: activityId,
        phaseId: phaseId || null,
        quantity: quantity.toString(),
        unitPrice: unitPrice.toString(),
        subtotal: subtotal.toString()
      };
      
      console.log("Creando item del presupuesto:", itemData);
      
      const [item] = await db.insert(budgetItems).values(itemData).returning();
      
      console.log("Item del presupuesto creado:", item);
      
      res.status(201).json(item);
      
    } catch (error) {
      console.error("Error creating budget item:", error);
      res.status(500).json({ message: "Error al crear el item del presupuesto" });
    }
  });

  // Project management routes
  router.post('/projects', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      console.log("Datos recibidos para crear proyecto:", req.body);
      
      const { 
        name,
        client,
        location,
        city,
        country,
        startDate,
        equipmentPercentage,
        administrativePercentage,
        utilityPercentage,
        taxPercentage,
        socialChargesPercentage
      } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "El nombre del proyecto es requerido" });
      }
      
      const projectData = {
        name,
        client: client || null,
        location: location || null,
        city: city || null,
        country: country || "Bolivia",
        startDate: startDate ? new Date(startDate) : null,
        userId: req.user.id,
        equipmentPercentage: equipmentPercentage || "5.00",
        administrativePercentage: administrativePercentage || "8.00",
        utilityPercentage: utilityPercentage || "15.00",
        taxPercentage: taxPercentage || "3.09",
        socialChargesPercentage: socialChargesPercentage || "71.18"
      };
      
      console.log("Datos del proyecto antes de insertar:", projectData);
      
      const [project] = await db.insert(projects).values(projectData).returning();
      
      console.log("Proyecto creado exitosamente:", project);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  router.get('/projects', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userProjects = await db.select()
        .from(projects)
        .where(eq(projects.userId, req.user.id))
        .orderBy(desc(projects.createdAt));
      
      res.json(userProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Catalogs for compositions
  router.get('/catalog/materials', async (req: Request, res: Response) => {
    try {
      const { search, limit = '20' } = req.query;
      
      let materialsData;
      if (search && typeof search === 'string') {
        materialsData = await db.select({
          id: materials.id,
          name: materials.name,
          unit: materials.unit,
          price: materials.price,
          categoryId: materials.categoryId
        }).from(materials)
        .where(like(materials.name, `%${search}%`))
        .limit(parseInt(limit as string));
      } else {
        materialsData = await db.select({
          id: materials.id,
          name: materials.name,
          unit: materials.unit,
          price: materials.price,
          categoryId: materials.categoryId
        }).from(materials)
        .limit(parseInt(limit as string));
      }
      
      res.json(materialsData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch materials catalog' });
    }
  });

  // Get labor categories for catalog
  router.get('/catalog/labor', async (req: Request, res: Response) => {
    try {
      const laborData = await db.select({
        id: laborCategories.id,
        name: laborCategories.name,
        unit: laborCategories.unit,
        cost: laborCategories.hourlyRate
      }).from(laborCategories);
      
      res.json(laborData);
    } catch (error) {
      console.error('Labor catalog fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch labor catalog' });
    }
  });

  // Get tools/equipment for catalog
  router.get('/catalog/tools', async (req: Request, res: Response) => {
    try {
      const toolsData = await db.select({
        id: tools.id,
        name: tools.name,
        unit: tools.unit,
        cost: tools.unitPrice
      }).from(tools);
      
      res.json(toolsData);
    } catch (error) {
      console.error('Tools catalog fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch tools catalog' });
    }
  });

  // Direct endpoints for tools and labor categories
  router.get('/tools', async (req: Request, res: Response) => {
    try {
      const toolsData = await db.select().from(tools).orderBy(tools.name);
      res.json(toolsData);
    } catch (error) {
      console.error('Tools fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch tools' });
    }
  });

  router.get('/labor-categories', async (req: Request, res: Response) => {
    try {
      const laborData = await db.select().from(laborCategories).orderBy(laborCategories.name);
      res.json(laborData);
    } catch (error) {
      console.error('Labor categories fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch labor categories' });
    }
  });

  // Health check route
  router.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      version: '1.0.0' 
    });
  });

  app.use('/api', router);
}