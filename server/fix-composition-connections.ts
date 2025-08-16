// Script para conectar todas las composiciones con sus catálogos correspondientes
import { db } from "./db.js";
import { 
  activityCompositions, 
  userActivityCompositions,
  materials, 
  laborCategories, 
  tools 
} from "../shared/schema.js";
import { eq, like, ilike, isNull, and } from "drizzle-orm";

export async function fixCompositionConnections() {
  console.log("🔧 Iniciando conexión de composiciones con catálogos...");

  // 1. Conectar materiales en activity_compositions
  console.log("📦 Conectando materiales en actividades originales...");
  const disconnectedMaterials = await db.select()
    .from(activityCompositions)
    .where(and(
      eq(activityCompositions.type, 'material'),
      isNull(activityCompositions.materialId)
    ));

  console.log(`📦 Encontradas ${disconnectedMaterials.length} composiciones de materiales sin conectar`);

  for (const comp of disconnectedMaterials) {
    // Buscar material por descripción similar
    const materialMatch = await db.select()
      .from(materials)
      .where(ilike(materials.name, `%${comp.description}%`))
      .limit(1);

    if (materialMatch.length > 0) {
      await db.update(activityCompositions)
        .set({ 
          materialId: materialMatch[0].id,
          unitCost: materialMatch[0].price 
        })
        .where(eq(activityCompositions.id, comp.id));
      
      console.log(`✅ Conectado: "${comp.description}" -> Material ID ${materialMatch[0].id} (${materialMatch[0].name})`);
    } else {
      // Si no existe en catálogo, crear nuevo material
      const newMaterial = await db.insert(materials).values({
        categoryId: 1, // Categoría general
        name: comp.description,
        unit: comp.unit,
        price: comp.unitCost,
        isActive: true
      }).returning();

      await db.update(activityCompositions)
        .set({ materialId: newMaterial[0].id })
        .where(eq(activityCompositions.id, comp.id));

      console.log(`🆕 Creado nuevo material: "${comp.description}" -> ID ${newMaterial[0].id}`);
    }
  }

  // 2. Conectar mano de obra en activity_compositions
  console.log("👷 Conectando mano de obra en actividades originales...");
  const disconnectedLabor = await db.select()
    .from(activityCompositions)
    .where(and(
      eq(activityCompositions.type, 'labor'),
      isNull(activityCompositions.laborId)
    ));

  console.log(`👷 Encontradas ${disconnectedLabor.length} composiciones de mano de obra sin conectar`);

  for (const comp of disconnectedLabor) {
    const laborMatch = await db.select()
      .from(laborCategories)
      .where(ilike(laborCategories.name, `%${comp.description}%`))
      .limit(1);

    if (laborMatch.length > 0) {
      await db.update(activityCompositions)
        .set({ 
          laborId: laborMatch[0].id,
          unitCost: laborMatch[0].hourlyRate 
        })
        .where(eq(activityCompositions.id, comp.id));
      
      console.log(`✅ Conectado: "${comp.description}" -> Labor ID ${laborMatch[0].id} (${laborMatch[0].name})`);
    } else {
      // Crear nueva categoría laboral
      const newLabor = await db.insert(laborCategories).values({
        name: comp.description,
        unit: comp.unit,
        hourlyRate: comp.unitCost,
        isActive: true
      }).returning();

      await db.update(activityCompositions)
        .set({ laborId: newLabor[0].id })
        .where(eq(activityCompositions.id, comp.id));

      console.log(`🆕 Creada nueva categoría laboral: "${comp.description}" -> ID ${newLabor[0].id}`);
    }
  }

  // 3. Conectar equipos/herramientas en activity_compositions
  console.log("🔧 Conectando equipos en actividades originales...");
  const disconnectedTools = await db.select()
    .from(activityCompositions)
    .where(and(
      eq(activityCompositions.type, 'equipment'),
      isNull(activityCompositions.toolId)
    ));

  console.log(`🔧 Encontradas ${disconnectedTools.length} composiciones de equipos sin conectar`);

  for (const comp of disconnectedTools) {
    const toolMatch = await db.select()
      .from(tools)
      .where(ilike(tools.name, `%${comp.description}%`))
      .limit(1);

    if (toolMatch.length > 0) {
      await db.update(activityCompositions)
        .set({ 
          toolId: toolMatch[0].id,
          unitCost: toolMatch[0].unitPrice 
        })
        .where(eq(activityCompositions.id, comp.id));
      
      console.log(`✅ Conectado: "${comp.description}" -> Tool ID ${toolMatch[0].id} (${toolMatch[0].name})`);
    } else {
      // Crear nueva herramienta
      const newTool = await db.insert(tools).values({
        name: comp.description,
        unit: comp.unit,
        unitPrice: comp.unitCost,
        isActive: true
      }).returning();

      await db.update(activityCompositions)
        .set({ toolId: newTool[0].id })
        .where(eq(activityCompositions.id, comp.id));

      console.log(`🆕 Creada nueva herramienta: "${comp.description}" -> ID ${newTool[0].id}`);
    }
  }

  // 4. Hacer lo mismo para user_activity_compositions
  console.log("🎨 Procesando actividades personalizadas...");
  
  // Materiales personalizados
  const disconnectedUserMaterials = await db.select()
    .from(userActivityCompositions)
    .where(and(
      eq(userActivityCompositions.type, 'material'),
      isNull(userActivityCompositions.materialId)
    ));

  for (const comp of disconnectedUserMaterials) {
    const materialMatch = await db.select()
      .from(materials)
      .where(ilike(materials.name, `%${comp.description}%`))
      .limit(1);

    if (materialMatch.length > 0) {
      await db.update(userActivityCompositions)
        .set({ materialId: materialMatch[0].id })
        .where(eq(userActivityCompositions.id, comp.id));
      
      console.log(`✅ Conectado material personalizado: "${comp.description}" -> ID ${materialMatch[0].id}`);
    }
  }

  // Mano de obra personalizada
  const disconnectedUserLabor = await db.select()
    .from(userActivityCompositions)
    .where(and(
      eq(userActivityCompositions.type, 'labor'),
      isNull(userActivityCompositions.laborId)
    ));

  for (const comp of disconnectedUserLabor) {
    const laborMatch = await db.select()
      .from(laborCategories)
      .where(ilike(laborCategories.name, `%${comp.description}%`))
      .limit(1);

    if (laborMatch.length > 0) {
      await db.update(userActivityCompositions)
        .set({ laborId: laborMatch[0].id })
        .where(eq(userActivityCompositions.id, comp.id));
      
      console.log(`✅ Conectado labor personalizado: "${comp.description}" -> ID ${laborMatch[0].id}`);
    }
  }

  console.log("✅ Proceso de conexión completado!");
  
  // Estadísticas finales
  const finalStats = await db.select()
    .from(activityCompositions)
    .where(and(
      eq(activityCompositions.type, 'material'),
      isNull(activityCompositions.materialId)
    ));

  console.log(`📊 Materiales restantes sin conectar: ${finalStats.length}`);

  return {
    materialsProcessed: disconnectedMaterials.length,
    laborProcessed: disconnectedLabor.length,
    toolsProcessed: disconnectedTools.length,
    userMaterialsProcessed: disconnectedUserMaterials.length,
    userLaborProcessed: disconnectedUserLabor.length
  };
}