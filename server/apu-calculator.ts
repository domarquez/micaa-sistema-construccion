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

  for (const comp of compositions) {
    const quantity = parseFloat(comp.quantity) || 0;
    const unitCost = parseFloat(comp.unitCost) || 0;
    const subtotal = quantity * unitCost;

    if (comp.type === 'material' && comp.materialId) {
      const [material] = await db.select().from(materials).where(eq(materials.id, comp.materialId));
      if (material) {
        materialsData.push({
          id: material.id,
          name: material.name,
          unit: comp.unit,
          quantity,
          unitCost,
          subtotal
        });
        materialsCost += subtotal;
      }
    } else if (comp.type === 'labor' && comp.laborId) {
      const [labor] = await db.select().from(laborCategories).where(eq(laborCategories.id, comp.laborId));
      if (labor) {
        laborData.push({
          id: labor.id,
          name: labor.name,
          unit: comp.unit,
          quantity,
          unitCost,
          subtotal
        });
        laborCost += subtotal;
      }
    } else if (comp.type === 'equipment' && comp.toolId) {
      const [tool] = await db.select().from(tools).where(eq(tools.id, comp.toolId));
      if (tool) {
        equipmentData.push({
          id: tool.id,
          name: tool.name,
          unit: comp.unit,
          quantity,
          unitCost,
          subtotal
        });
        equipmentCost += subtotal;
      }
    }
  }

  // Cálculos según normativa boliviana
  const laborCharges = laborCost * 0.55; // 55% cargas sociales
  const laborWithCharges = laborCost + laborCharges;
  const laborIVA = laborWithCharges * 0.1494; // 14.94% IVA de M.O.
  const laborFinal = laborWithCharges + laborIVA;
  
  const tools = equipmentCost * 0.05; // 5% herramientas
  const equipmentWithTools = equipmentCost + tools;
  
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
      tools,
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