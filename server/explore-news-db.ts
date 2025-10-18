// Temporary script to explore external news database structure
import { neon } from '@neondatabase/serverless';

const EXTERNAL_NEWS_DB_URL = 'postgresql://neondb_owner:npg_Vj2ROt6JrXHv@ep-tight-glitter-a8wysmyx-pooler.eastus2.azure.neon.tech/noticiascons?sslmode=require&channel_binding=require';

async function exploreNewsDatabase() {
  try {
    const sql = neon(EXTERNAL_NEWS_DB_URL);
    
    console.log('🔍 Explorando base de datos externa de noticias...\n');
    
    // Get all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('📋 Tablas disponibles:');
    console.log(tables);
    console.log('\n');
    
    // For each table, get its structure
    for (const table of tables) {
      const tableName = table.table_name;
      console.log(`\n📊 Estructura de la tabla: ${tableName}`);
      console.log('='.repeat(50));
      
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
        ORDER BY ordinal_position;
      `;
      
      console.log(columns);
      
      // Get sample data from noticias_construccion_bolivia
      if (tableName === 'noticias_construccion_bolivia') {
        console.log(`\n📝 Datos de ejemplo (primeras 3 filas):`);
        const sampleData = await sql`
          SELECT * FROM noticias_construccion_bolivia 
          ORDER BY fecha_publicacion DESC 
          LIMIT 3;
        `;
        console.log(JSON.stringify(sampleData, null, 2));
        
        console.log(`\n📊 Total de noticias en la BD:`);
        const count = await sql`SELECT COUNT(*) as total FROM noticias_construccion_bolivia;`;
        console.log(count);
      }
    }
    
  } catch (error) {
    console.error('❌ Error explorando la base de datos:', error);
  }
}

exploreNewsDatabase();
