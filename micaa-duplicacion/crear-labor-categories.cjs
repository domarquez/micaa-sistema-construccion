const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function crearLaborCategories() {
  console.log('🏗️  Creando categorías de mano de obra...\n');
  
  // Categorías de mano de obra comunes en construcción boliviana
  const laborCategories = [
    { id: 1, name: 'ALBAÑIL', description: 'Mano de obra especializada en albañilería', skillLevel: 'especializada', dailyRate: '120.00' },
    { id: 2, name: 'AYUDANTE', description: 'Ayudante general de construcción', skillLevel: 'no_especializada', dailyRate: '80.00' },
    { id: 3, name: 'CARPINTERO', description: 'Mano de obra especializada en carpintería', skillLevel: 'especializada', dailyRate: '130.00' },
    { id: 4, name: 'ELECTRICISTA', description: 'Mano de obra especializada en electricidad', skillLevel: 'especializada', dailyRate: '140.00' },
    { id: 9, name: 'PLOMERO', description: 'Mano de obra especializada en plomería', skillLevel: 'especializada', dailyRate: '135.00' },
    { id: 10, name: 'FIERRERO', description: 'Mano de obra especializada en fierrería', skillLevel: 'especializada', dailyRate: '125.00' },
    { id: 11, name: 'SOLDADOR', description: 'Mano de obra especializada en soldadura', skillLevel: 'especializada', dailyRate: '150.00' },
    { id: 12, name: 'PINTOR', description: 'Mano de obra especializada en pintura', skillLevel: 'especializada', dailyRate: '110.00' }
  ];
  
  try {
    let created = 0;
    
    for (const labor of laborCategories) {
      try {
        const query = `
          INSERT INTO labor_categories (id, name, description, skill_level, daily_rate, created_at, updated_at) 
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `;
        
        const result = await pool.query(query, [
          labor.id,
          labor.name,
          labor.description,
          labor.skillLevel,
          labor.dailyRate
        ]);
        
        if (result.rowCount > 0) {
          console.log(`✅ ${labor.name} (ID: ${labor.id}) creada`);
          created++;
        } else {
          console.log(`ℹ️  ${labor.name} (ID: ${labor.id}) ya existe`);
        }
      } catch (error) {
        console.warn(`⚠️  Error creando ${labor.name}:`, error.message);
      }
    }
    
    console.log(`\n✅ Proceso completado!`);
    console.log(`📊 Categorías de mano de obra creadas: ${created}`);
    console.log(`🔗 Ahora las composiciones de actividades pueden hacer referencia a estas categorías`);
    
  } catch (error) {
    console.error('❌ Error durante la creación:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar creación
crearLaborCategories();