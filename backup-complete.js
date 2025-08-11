#!/usr/bin/env node

/**
 * Script para hacer backup completo de MICAA
 * Ejecutar en el proyecto actual antes de duplicar
 */

import { db } from './server/db.ts';
import fs from 'fs';
import path from 'path';

// Crear directorio de backup
const backupDir = './backup-micaa';
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

async function exportTable(tableName, query = null) {
  try {
    console.log(`Exportando tabla: ${tableName}...`);
    
    const sql = query || `SELECT * FROM ${tableName}`;
    const result = await db.execute(sql);
    
    const filename = path.join(backupDir, `${tableName}_${timestamp}.json`);
    fs.writeFileSync(filename, JSON.stringify(result.rows, null, 2));
    
    console.log(`✅ ${tableName}: ${result.rows.length} registros exportados`);
    return result.rows.length;
  } catch (error) {
    console.error(`❌ Error exportando ${tableName}:`, error.message);
    return 0;
  }
}

async function exportAllTables() {
  console.log('🚀 Iniciando backup completo de MICAA...\n');
  
  const tables = [
    'users',
    'material_categories', 
    'materials',
    'construction_phases',
    'activities',
    'activity_compositions',
    'tools',
    'labor',
    'projects',
    'budgets',
    'budget_items',
    'suppliers',
    'companies',
    'advertisements',
    'city_price_factors',
    'supplier_materials'
  ];
  
  let totalRecords = 0;
  
  for (const table of tables) {
    const count = await exportTable(table);
    totalRecords += count;
  }
  
  // Crear archivo de resumen
  const summary = {
    timestamp: new Date().toISOString(),
    totalTables: tables.length,
    totalRecords: totalRecords,
    tables: tables,
    backupDir: backupDir
  };
  
  fs.writeFileSync(
    path.join(backupDir, `backup_summary_${timestamp}.json`), 
    JSON.stringify(summary, null, 2)
  );
  
  console.log(`\n✅ Backup completado!`);
  console.log(`📁 Ubicación: ${backupDir}`);
  console.log(`📊 Total tablas: ${tables.length}`);
  console.log(`📊 Total registros: ${totalRecords}`);
  console.log(`🕐 Timestamp: ${timestamp}`);
  
  return summary;
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  exportAllTables()
    .then(() => {
      console.log('\n🎉 Backup completo terminado exitosamente!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error durante el backup:', error);
      process.exit(1);
    });
}

export { exportAllTables };