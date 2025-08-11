const fs = require('fs');
const path = require('path');

async function restaurarArchivos() {
  console.log('📁 Restaurando archivos e imágenes...\n');
  
  const backupPath = './backup-micaa/uploads';
  const destinationPath = './uploads';
  
  try {
    // Verificar si existe el backup de archivos
    if (!fs.existsSync(backupPath)) {
      console.log('⚠️  No hay backup de archivos para restaurar');
      // Crear carpeta uploads vacía
      if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
        console.log('✅ Carpeta uploads creada');
      }
      return;
    }
    
    // Crear directorio de destino si no existe
    if (!fs.existsSync(destinationPath)) {
      fs.mkdirSync(destinationPath, { recursive: true });
    }
    
    // Copiar todos los archivos
    await copyDirectoryRecursive(backupPath, destinationPath);
    
    // Contar archivos restaurados
    const fileCount = await countFiles(destinationPath);
    
    console.log(`✅ Archivos restaurados correctamente`);
    console.log(`📊 Total de archivos: ${fileCount}`);
    console.log(`📁 Ubicación: ${destinationPath}`);
    
  } catch (error) {
    console.error('❌ Error durante la restauración de archivos:', error);
  }
}

async function copyDirectoryRecursive(source, destination) {
  const items = fs.readdirSync(source);
  
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      // Crear directorio y copiar contenido recursivamente
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      await copyDirectoryRecursive(sourcePath, destPath);
    } else {
      // Copiar archivo
      fs.copyFileSync(sourcePath, destPath);
      console.log(`📄 ${item}`);
    }
  }
}

async function countFiles(dirPath) {
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

// Ejecutar restauración
restaurarArchivos();