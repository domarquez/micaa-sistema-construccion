const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuración de base de datos usando la URL de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Replit no requiere SSL
});

const backupDir = './backup-micaa';
const correctTimestamp = '2025-06-29T19-03-52-637Z';

async function crearLaborCategories() {
  const laborCategories = [
    { id: 1, name: 'ALBAÑIL', description: 'Mano de obra especializada en albañilería', unit: 'JORNAL', hourlyRate: '15.00', skillLevel: 'skilled' },
    { id: 2, name: 'AYUDANTE', description: 'Ayudante general de construcción', unit: 'JORNAL', hourlyRate: '10.00', skillLevel: 'basic' },
    { id: 3, name: 'CARPINTERO', description: 'Mano de obra especializada en carpintería', unit: 'JORNAL', hourlyRate: '16.25', skillLevel: 'skilled' },
    { id: 4, name: 'ELECTRICISTA', description: 'Mano de obra especializada en electricidad', unit: 'JORNAL', hourlyRate: '17.50', skillLevel: 'specialist' },
    { id: 9, name: 'PLOMERO', description: 'Mano de obra especializada en plomería', unit: 'JORNAL', hourlyRate: '16.85', skillLevel: 'skilled' },
    { id: 10, name: 'FIERRERO', description: 'Mano de obra especializada en fierrería', unit: 'JORNAL', hourlyRate: '15.60', skillLevel: 'skilled' },
    { id: 11, name: 'SOLDADOR', description: 'Mano de obra especializada en soldadura', unit: 'JORNAL', hourlyRate: '18.75', skillLevel: 'specialist' },
    { id: 12, name: 'PINTOR', description: 'Mano de obra especializada en pintura', unit: 'JORNAL', hourlyRate: '13.75', skillLevel: 'skilled' }
  ];
  
  let created = 0;
  for (const labor of laborCategories) {
    try {
      const query = `
        INSERT INTO labor_categories (id, name, description, unit, hourly_rate, skill_level, is_active, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `;
      
      const result = await pool.query(query, [
        labor.id, labor.name, labor.description, labor.unit, labor.hourlyRate, labor.skillLevel
      ]);
      
      if (result.rowCount > 0) {
        created++;
      }
    } catch (error) {
      console.warn(`⚠️  Error creando ${labor.name}:`, error.message);
    }
  }
  console.log(`✅ labor_categories: ${created}/8 registros creados`);
}

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
  
  console.log(`📁 Usando timestamp: ${correctTimestamp}`);
  
  let totalImported = 0;
  
  // Crear categorías de mano de obra necesarias
  console.log('🏗️  Creando categorías de mano de obra...');
  await crearLaborCategories();
  
  // Orden específico para respetar relaciones
  const importOrder = [
    'users',
    'material_categories',
    'materials', 
    'construction_phases',
    'tools',  // Debe ir antes de activity_compositions
    'activities',
    'activity_compositions',  // Depende de activities, tools y labor_categories
    'projects',
    'budgets',
    'budget_items',
    'city_price_factors'
  ];
  
  for (const table of importOrder) {
    const filename = path.join(backupDir, `${table}_${correctTimestamp}.json`);
    
    if (fs.existsSync(filename)) {
      const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
      const imported = await importTable(table, data);
      totalImported += imported;
    } else {
      console.log(`⚠️  Archivo no encontrado: ${table}_${correctTimestamp}.json`);
    }
  }
  
  console.log(`\n✅ Restauración completada!`);
  console.log(`📊 Total registros importados: ${totalImported}`);
  
  await pool.end();
  return totalImported;
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
  .then(async (totalImported) => {
    // Restaurar archivos e imágenes
    console.log('\n📁 Restaurando archivos e imágenes...');
    await restaurarArchivos();
    
    console.log('\n🎉 Restauración completa terminada exitosamente!');
    console.log(`📊 Total registros importados: ${totalImported}`);
    console.log(`📁 Archivos e imágenes restaurados`);
    console.log(`\n🔧 Para iniciar la aplicación ejecuta: npm run dev`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error durante la restauración:', error);
    process.exit(1);
  });

async function restaurarArchivos() {
  const fs = require('fs');
  const path = require('path');
  
  const backupPath = './backup-micaa/uploads';
  const destinationPath = './uploads';
  
  try {
    if (!fs.existsSync(backupPath)) {
      console.log('⚠️  No hay backup de archivos para restaurar');
      if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
        console.log('✅ Carpeta uploads creada');
      }
      return;
    }
    
    if (!fs.existsSync(destinationPath)) {
      fs.mkdirSync(destinationPath, { recursive: true });
    }
    
    await copyDirectoryRecursive(backupPath, destinationPath);
    
    const fileCount = await countFiles(destinationPath);
    console.log(`✅ ${fileCount} archivos restaurados`);
    
  } catch (error) {
    console.warn('⚠️  Error restaurando archivos:', error.message);
  }
}

async function copyDirectoryRecursive(source, destination) {
  const fs = require('fs');
  const path = require('path');
  
  const items = fs.readdirSync(source);
  
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      await copyDirectoryRecursive(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

async function countFiles(dirPath) {
  const fs = require('fs');
  const path = require('path');
  let count = 0;
  
  function countRecursive(currentPath) {
    if (!fs.existsSync(currentPath)) return;
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        countRecursive(itemPath);
      } else {
        count++;
      }
    }
  }
  
  countRecursive(dirPath);
  return count;
}