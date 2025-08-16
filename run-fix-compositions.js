// Script directo para ejecutar el arreglo de conexiones
import { fixCompositionConnections } from './server/fix-composition-connections.js';

async function main() {
  try {
    console.log('🚀 Iniciando arreglo de composiciones...');
    const results = await fixCompositionConnections();
    console.log('✅ Proceso completado!');
    console.log('📊 Resultados:', results);
  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

main();