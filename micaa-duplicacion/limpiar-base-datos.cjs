const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function limpiarBaseDatos() {
  console.log('🧹 Limpiando base de datos antes de restaurar...\n');
  
  try {
    // Orden de eliminación respetando relaciones (del más dependiente al menos)
    const tablasALimpiar = [
      'activity_compositions',
      'budget_items', 
      'budgets',
      'projects',
      'user_material_prices',
      'company_advertisements',
      'activities',
      'materials',
      'material_categories',
      'construction_phases',
      'tools',
      'city_price_factors',
      'system_settings',
      'users'
    ];
    
    let totalEliminados = 0;
    
    for (const tabla of tablasALimpiar) {
      try {
        // Primero contar registros
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tabla}`);
        const count = parseInt(countResult.rows[0].count);
        
        if (count > 0) {
          // Eliminar todos los registros
          await pool.query(`TRUNCATE TABLE ${tabla} RESTART IDENTITY CASCADE`);
          console.log(`✅ ${tabla}: ${count} registros eliminados`);
          totalEliminados += count;
        } else {
          console.log(`⚪ ${tabla}: ya estaba vacía`);
        }
      } catch (error) {
        // Si la tabla no existe, continuar
        if (error.message.includes('does not exist')) {
          console.log(`⚠️  ${tabla}: tabla no existe (normal en instalación nueva)`);
        } else {
          console.warn(`⚠️  Error limpiando ${tabla}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n✅ Limpieza completada!`);
    console.log(`📊 Total registros eliminados: ${totalEliminados}`);
    console.log(`🔄 Las secuencias de IDs han sido reiniciadas`);
    console.log(`\n🚀 Ahora puedes ejecutar: node restore-data.cjs`);
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar limpieza
limpiarBaseDatos();