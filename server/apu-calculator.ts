import { db } from './db';
import { activities, activityCompositions, materials, laborCategories, tools } from '../shared/schema';
import { eq } from 'drizzle-orm';

export interface APUCalculationResult {
  activityId: number;
  activityName: string;
  unit: string;
  totalCost: number;
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
  tools: {
    id: number;
    name: string;
    unit: string;
    quantity: number;
    unitCost: number;
    subtotal: number;
  }[];
  breakdown: {
    materialsCost: number;
    laborCost: number;
    toolsCost: number;
  };
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
  const toolsData = [];

  let materialsCost = 0;
  let laborCost = 0;
  let toolsCost = 0;

  for (const comp of compositions) {
    const quantity = parseFloat(comp.quantity);
    const unitCost = parseFloat(comp.unitCost);
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
    } else if (comp.type === 'tool' && comp.toolId) {
      const [tool] = await db.select().from(tools).where(eq(tools.id, comp.toolId));
      if (tool) {
        toolsData.push({
          id: tool.id,
          name: tool.name,
          unit: comp.unit,
          quantity,
          unitCost,
          subtotal
        });
        toolsCost += subtotal;
      }
    }
  }

  const totalCost = materialsCost + laborCost + toolsCost;

  return {
    activityId: activity.id,
    activityName: activity.name,
    unit: activity.unit,
    totalCost,
    materials: materialsData,
    labor: laborData,
    tools: toolsData,
    breakdown: {
      materialsCost,
      laborCost,
      toolsCost
    }
  };
}