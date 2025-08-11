const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuración de base de datos usando la URL de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Replit no requiere SSL
});

// Crear directorio de backup
const backupDir = './backup-micaa';
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

async function exportTable(tableName) {
  try {
    console.log(`Exportando tabla: ${tableName}...`);
    
    const result = await pool.query(`SELECT * FROM ${tableName}`);
    
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
  
  await pool.end();
  return summary;
}

// Ejecutar backup
exportAllTables()
  .then(() => {
    console.log('\n🎉 Backup completo terminado exitosamente!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error durante el backup:', error);
    process.exit(1);
  });