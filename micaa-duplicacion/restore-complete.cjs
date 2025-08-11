const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuración de base de datos usando la URL de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Replit no requiere SSL
});

const backupDir = './backup-micaa';

async function importTable(tableName, data) {
  try {
    console.log(`Importando tabla: ${tableName}...`);
    
    if (!data || data.length === 0) {
      console.log(`⚠️  ${tableName}: Sin datos para importar`);
      return 0;
    }
    
    let inserted = 0;
    
    for (const row of data) {
      try {
        // Construir query de inserción dinámicamente
        const columns = Object.keys(row);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        const values = Object.values(row);
        
        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        await pool.query(query, values);
        inserted++;
      } catch (error) {
        // Continuar con el siguiente registro si hay error
        console.warn(`⚠️  Error en registro de ${tableName}:`, error.message);
      }
    }
    
    console.log(`✅ ${tableName}: ${inserted}/${data.length} registros importados`);
    return inserted;
  } catch (error) {
    console.error(`❌ Error importando ${tableName}:`, error.message);
    return 0;
  }
}

async function restoreAllTables() {
  console.log('🚀 Iniciando restauración completa de MICAA...\n');
  
  if (!fs.existsSync(backupDir)) {
    console.error(`❌ Directorio de backup no encontrado: ${backupDir}`);
    console.log('Por favor, asegúrate de que la carpeta backup-micaa esté presente');
    process.exit(1);
  }
  
  // Buscar archivo de resumen más reciente
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup_summary_'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    console.error('❌ No se encontró archivo de resumen de backup');
    process.exit(1);
  }
  
  const summaryFile = path.join(backupDir, files[0]);
  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  
  console.log(`📁 Usando backup: ${summary.timestamp}`);
  console.log(`📊 Tablas a importar: ${summary.totalTables}`);
  console.log(`📊 Registros esperados: ${summary.totalRecords}\n`);
  
  let totalImported = 0;
  const timestamp = summary.timestamp.replace(/[:.]/g, '-');
  
  // Orden específico para respetar relaciones
  const importOrder = [
    'users',
    'material_categories',
    'materials', 
    'construction_phases',
    'activities',
    'activity_compositions',
    'tools',
    'projects',
    'budgets',
    'budget_items',
    'city_price_factors'
  ];
  
  for (const table of importOrder) {
    const filename = path.join(backupDir, `${table}_${timestamp}.json`);
    
    if (fs.existsSync(filename)) {
      const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
      const imported = await importTable(table, data);
      totalImported += imported;
    } else {
      console.log(`⚠️  Archivo no encontrado: ${table}_${timestamp}.json`);
    }
  }
  
  console.log(`\n✅ Restauración completada!`);
  console.log(`📊 Total registros importados: ${totalImported}/${summary.totalRecords}`);
  
  await pool.end();
  return { totalImported, expected: summary.totalRecords };
}

// Función para verificar que las tablas existen
async function verifyTables() {
  console.log('🔍 Verificando estructura de base de datos...');
  
  try {
    // Verificar algunas tablas críticas
    const criticalTables = ['users', 'materials', 'activities'];
    
    for (const table of criticalTables) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`✅ ${table}: ${result.rows[0].count} registros`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error verificando tablas:', error.message);
    console.log('💡 Asegúrate de ejecutar: npm run db:push');
    return false;
  }
}

// Ejecutar restauración
verifyTables()
  .then((tablesOk) => {
    if (!tablesOk) {
      process.exit(1);
    }
    return restoreAllTables();
  })
  .then((result) => {
    console.log('\n🎉 Restauración completa terminada exitosamente!');
    console.log(`📊 Eficiencia: ${((result.totalImported / result.expected) * 100).toFixed(1)}%`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error durante la restauración:', error);
    process.exit(1);
  });