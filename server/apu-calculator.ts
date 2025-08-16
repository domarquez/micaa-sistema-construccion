import { db } from './db';
import { activities, activityCompositions, materials, laborCategories, tools } from '../shared/schema';
import { eq } from 'drizzle-orm';

export interface APUCalculationResult {
  activityId: number;
  activityName: string;
  unit: string;
  // Totales básicos
  materialsTotal: number;
  laborTotal: number;
  equipmentTotal: number;
  // Totales con cargas
  laborWithCharges: number;
  equipmentWithTools: number;
  // Costos adicionales
  administrativeCost: number;
  utilityCost: number;
  taxCost: number;
  totalUnitPrice: number;
  // Desglose detallado
  breakdown: {
    laborCharges: number;
    laborIVA: number;
    tools: number;
    administrativePercentage: number;
    utilityPercentage: number;
    taxPercentage: number;
  };
  // Datos detallados
  materials: {
    id: number;
    name: string;
    unit: string;
    quantity: number;
    unitCost: number;
    subtotal: number;
  }[];
  labor: {
    id: number;
    name: string;
    unit: string;
    quantity: number;
    unitCost: number;
    subtotal: number;
  }[];
  equipment: {
    id: number;
    name: string;
    unit: string;
    quantity: number;
    unitCost: number;
    subtotal: number;
  }[];
}

export async function calculateAPU(activityId: number): Promise<APUCalculationResult> {
  // Get activity information
  const [activity] = await db.select().from(activities).where(eq(activities.id, activityId));
  
  if (!activity) {
    throw new Error(`Activity with ID ${activityId} not found`);
  }

  // Get activity compositions
  const compositions = await db.select().from(activityCompositions).where(eq(activityCompositions.activityId, activityId));

  const materialsData = [];
  const laborData = [];
  const equipmentData = [];

  let materialsCost = 0;
  let laborCost = 0;
  let equipmentCost = 0;

  console.log(`🔍 APU Calculation for Activity ${activityId}: Found ${compositions.length} compositions`);
  
  for (const comp of compositions) {
    const quantity = parseFloat(comp.quantity) || 0;
    const unitCost = parseFloat(comp.unitCost) || 0;
    const subtotal = quantity * unitCost;
    
    console.log(`📋 Composition: type=${comp.type}, quantity=${quantity}, unitCost=${unitCost}, subtotal=${subtotal}`);

    if (comp.type === 'material') {
      let materialName = comp.description || 'Material desconocido';
      let materialId = comp.materialId || 0;
      
      // Si hay material_id, buscar el material en la base de datos
      if (comp.materialId) {
        const [material] = await db.select().from(materials).where(eq(materials.id, comp.materialId));
        if (material) {
          materialName = material.name;
          materialId = material.id;
          console.log(`✅ Material found: ${materialName}`);
        } else {
          console.log(`❌ Material not found for ID: ${comp.materialId}, using description: ${materialName}`);
        }
      } else {
        console.log(`📝 Material from description: ${materialName}`);
      }
      
      materialsData.push({
        id: materialId,
        name: materialName,
        unit: comp.unit,
        quantity,
        unitCost,
        subtotal
      });
      materialsCost += subtotal;
      
    } else if (comp.type === 'labor') {
      let laborName = comp.description || 'Mano de obra desconocida';
      let laborId = comp.laborId || 0;
      
      // Si hay labor_id, buscar en la base de datos
      if (comp.laborId) {
        const [labor] = await db.select().from(laborCategories).where(eq(laborCategories.id, comp.laborId));
        if (labor) {
          laborName = labor.name;
          laborId = labor.id;
          console.log(`✅ Labor found: ${laborName}`);
        } else {
          console.log(`❌ Labor not found for ID: ${comp.laborId}, using description: ${laborName}`);
        }
      } else {
        console.log(`📝 Labor from description: ${laborName}`);
      }
      
      laborData.push({
        id: laborId,
        name: laborName,
        unit: comp.unit,
        quantity,
        unitCost,
        subtotal
      });
      laborCost += subtotal;
      
    } else if (comp.type === 'equipment' || comp.type === 'tool') {
      let toolName = comp.description || 'Equipo desconocido';
      let toolId = comp.toolId || 0;
      
      // Si hay tool_id, buscar en la base de datos
      if (comp.toolId) {
        const [tool] = await db.select().from(tools).where(eq(tools.id, comp.toolId));
        if (tool) {
          toolName = tool.name;
          toolId = tool.id;
          console.log(`✅ Equipment found: ${toolName}`);
        } else {
          console.log(`❌ Equipment not found for ID: ${comp.toolId}, using description: ${toolName}`);
        }
      } else {
        console.log(`📝 Equipment from description: ${toolName}`);
      }
      
      equipmentData.push({
        id: toolId,
        name: toolName,
        unit: comp.unit,
        quantity,
        unitCost,
        subtotal
      });
      equipmentCost += subtotal;
      
    } else {
      console.log(`⚠️ Unknown composition type: type=${comp.type}`);
    }
  }
  
  console.log(`💰 Totals - Materials: ${materialsCost}, Labor: ${laborCost}, Equipment: ${equipmentCost}`);

  // Cálculos según normativa boliviana
  const laborCharges = laborCost * 0.55; // 55% cargas sociales
  const laborWithCharges = laborCost + laborCharges;
  const laborIVA = laborWithCharges * 0.1494; // 14.94% IVA de M.O.
  const laborFinal = laborWithCharges + laborIVA;
  
  const toolsPercentage = equipmentCost * 0.05; // 5% herramientas
  const equipmentWithTools = equipmentCost + toolsPercentage;
  
  const subtotalCost = materialsCost + laborFinal + equipmentWithTools;
  
  const administrativeCost = subtotalCost * 0.08; // 8% gastos generales
  const utilityCost = (subtotalCost + administrativeCost) * 0.15; // 15% utilidad
  const taxCost = (subtotalCost + administrativeCost + utilityCost) * 0.0309; // 3.09% IT
  
  const totalUnitPrice = subtotalCost + administrativeCost + utilityCost + taxCost;

  return {
    activityId: activity.id,
    activityName: activity.name,
    unit: activity.unit,
    // Totales básicos
    materialsTotal: materialsCost,
    laborTotal: laborCost,
    equipmentTotal: equipmentCost,
    // Totales con cargas
    laborWithCharges: laborFinal,
    equipmentWithTools,
    // Costos adicionales
    administrativeCost,
    utilityCost,
    taxCost,
    totalUnitPrice,
    // Desglose detallado
    breakdown: {
      laborCharges,
      laborIVA,
      tools: toolsPercentage,
      administrativePercentage: 8.0,
      utilityPercentage: 15.0,
      taxPercentage: 3.09
    },
    // Datos detallados
    materials: materialsData,
    labor: laborData,
    equipment: equipmentData
  };
}