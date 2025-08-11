import { Router } from 'express';
import { db } from './db';
import { users, materials, activities, projects, supplierCompanies, cityPriceFactors, constructionPhases, materialCategories, tools, laborCategories, companyAdvertisements, budgets } from '../shared/schema';
import { eq, like, desc, asc, and, sql } from 'drizzle-orm';

// Middleware de autenticación
const requireAuth = async (req: any, res: any, next: any) => {
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

  // Materials routes with category information
  router.get('/materials', async (req, res) => {
    try {
      const { search, category, limit = '50' } = req.query;
      
      // First get materials
      let materialsQuery = db.select().from(materials);
      
      if (search && typeof search === 'string') {
        materialsQuery = materialsQuery.where(like(materials.name, `%${search}%`));
      }
      
      if (category && typeof category === 'string') {
        materialsQuery = materialsQuery.where(eq(materials.categoryId, parseInt(category)));
      }
      
      const materialsData = await materialsQuery.limit(parseInt(limit as string));
      
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
  router.get('/activities', async (req, res) => {
    try {
      const { search, phase, limit = '100', offset = '0' } = req.query;
      
      // First get activities
      let activitiesQuery = db.select().from(activities);
      
      if (search && typeof search === 'string') {
        activitiesQuery = activitiesQuery.where(like(activities.name, `%${search}%`));
      }
      
      if (phase && typeof phase === 'string') {
        activitiesQuery = activitiesQuery.where(eq(activities.phaseId, parseInt(phase)));
      }
      
      const activitiesData = await activitiesQuery
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));
      
      // Get total count for pagination
      let countQuery = db.select({ count: sql`count(*)` }).from(activities);
      
      if (search && typeof search === 'string') {
        countQuery = countQuery.where(like(activities.name, `%${search}%`));
      }
      
      if (phase && typeof phase === 'string') {
        countQuery = countQuery.where(eq(activities.phaseId, parseInt(phase)));
      }
      
      const totalCountResult = await countQuery;
      const totalCount = Number(totalCountResult[0]?.count) || 0;
      
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
  router.get('/suppliers', async (req, res) => {
    try {
      const { search, specialty, limit = '20' } = req.query;
      let query = db.select().from(supplierCompanies).where(eq(supplierCompanies.isActive, true));
      
      if (search && typeof search === 'string') {
        query = query.where(like(supplierCompanies.companyName, `%${search}%`));
      }
      
      const suppliers = await query.limit(parseInt(limit as string));
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

  // City price factors
  router.get('/city-factors', async (req, res) => {
    try {
      const factors = await db.select().from(cityPriceFactors).where(eq(cityPriceFactors.isActive, true));
      res.json(factors);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch city factors' });
    }
  });

  // Statistics route
  router.get('/stats', async (req, res) => {
    try {
      const [userCount] = await db.select().from(users);
      const [materialCount] = await db.select().from(materials);
      const [activityCount] = await db.select().from(activities);
      const [supplierCount] = await db.select().from(supplierCompanies);
      
      res.json({
        users: userCount?.length || 0,
        materials: materialCount?.length || 0,
        activities: activityCount?.length || 0,
        suppliers: supplierCount?.length || 0
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // Public routes (no authentication required)
  app.get("/api/public/materials", async (req, res) => {
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

  app.get("/api/public/material-categories", async (req, res) => {
    try {
      const categories = await db.select().from(materialCategories);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching public categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/public/suppliers", async (req, res) => {
    try {
      const suppliers = await db.select().from(supplierCompanies).where(eq(supplierCompanies.isActive, true)).limit(50);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching public suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.get("/api/public/dual-advertisements", async (req, res) => {
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

  app.get("/api/statistics", async (req, res) => {
    try {
      const [materialsCount] = await db.select({ count: sql`count(*)` }).from(materials);
      const [activitiesCount] = await db.select({ count: sql`count(*)` }).from(activities);
      const [suppliersCount] = await db.select({ count: sql`count(*)` }).from(supplierCompanies);
      const [usersCount] = await db.select({ count: sql`count(*)` }).from(users);
      // Query budgets and projects with error handling
      let budgetsCount = { count: 0 };
      let projectsCount = { count: 0 };
      let totalValue = { total: 0 };
      
      try {
        [budgetsCount] = await db.select({ count: sql`count(*)` }).from(budgets);
      } catch (e) {
        console.log('Budgets table query failed, using direct SQL');
        const result = await db.execute(sql`SELECT count(*) as count FROM budgets`);
        budgetsCount = { count: result.rows[0].count };
      }
      
      try {
        [projectsCount] = await db.select({ count: sql`count(*)` }).from(projects);
      } catch (e) {
        console.log('Projects table query failed, using direct SQL');
        const result = await db.execute(sql`SELECT count(*) as count FROM projects`);
        projectsCount = { count: result.rows[0].count };
      }
      
      try {
        [totalValue] = await db.select({ total: sql`coalesce(sum(total), 0)` }).from(budgets);
      } catch (e) {
        console.log('Budget total query failed, using direct SQL');
        const result = await db.execute(sql`SELECT coalesce(sum(total), 0) as total FROM budgets`);
        totalValue = { total: result.rows[0].total };
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
  app.put("/api/admin/materials/:id/price", requireAdmin, async (req, res) => {
    try {
      const materialId = parseInt(req.params.id);
      const { price } = req.body;
      
      if (!price || price <= 0) {
        return res.status(400).json({ message: "Precio inválido" });
      }

      const updatedMaterial = await db.update(materials)
        .set({ price: parseFloat(price) })
        .where(eq(materials.id, materialId))
        .returning();

      if (updatedMaterial.length === 0) {
        return res.status(404).json({ message: "Material no encontrado" });
      }

      res.json(updatedMaterial[0]);
    } catch (error) {
      console.error("Error updating material price:", error);
      res.status(500).json({ message: "Failed to update material price" });
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

  // Register all routes under /api
  app.use('/api', router);
  
  console.log('API routes registered successfully');
  return app;
}