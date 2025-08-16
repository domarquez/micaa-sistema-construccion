import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users, materials, activities, constructionPhases, materialCategories } from '../shared/schema';
import { eq, like, desc, asc } from 'drizzle-orm';
import jwt, { JwtPayload } from 'jsonwebtoken';

// Custom JWT payload interface
interface CustomJwtPayload extends JwtPayload {
  userId: number;
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
      
      // Combine activities with phase information
      const activitiesWithPhases = activitiesData.map(activity => {
        const phase = phases.find(p => p.id === activity.phaseId);
        return {
          ...activity,
          phase: phase || { id: 0, name: 'Sin Fase', description: '' }
        };
      });
      
      res.json({
        activities: activitiesWithPhases,
        totalCount: activitiesData.length,
        currentPage: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
        totalPages: Math.ceil(activitiesData.length / parseInt(limit as string)),
        limit: parseInt(limit as string)
      });
    } catch (error) {
      console.error('Activities fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch activities' });
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