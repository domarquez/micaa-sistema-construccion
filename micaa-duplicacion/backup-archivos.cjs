const fs = require('fs');
const path = require('path');

async function backupArchivos() {
  console.log('📁 Creando backup de archivos e imágenes...\n');
  
  const sourcePath = './uploads';
  const backupPath = './backup-micaa/uploads';
  
  // Crear directorio de backup si no existe
  if (!fs.existsSync('./backup-micaa')) {
    fs.mkdirSync('./backup-micaa', { recursive: true });
  }
  
  try {
    // Verificar si existe la carpeta uploads
    if (!fs.existsSync(sourcePath)) {
      console.log('⚠️  Carpeta uploads no encontrada, creando backup vacío');
      fs.mkdirSync(backupPath, { recursive: true });
      return;
    }
    
    // Copiar toda la carpeta uploads
    await copyDirectoryRecursive(sourcePath, backupPath);
    
    // Contar archivos
    const fileCount = await countFiles(backupPath);
    
    console.log(`✅ Backup de archivos completado`);
    console.log(`📊 Total de archivos respaldados: ${fileCount}`);
    console.log(`📁 Ubicación: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Error durante el backup de archivos:', error);
  }
}

async function copyDirectoryRecursive(source, destination) {
  // Crear directorio de destino
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  const items = fs.readdirSync(source);
  
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      // Copiar subdirectorio recursivamente
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
  
  if (fs.existsSync(dirPath)) {
    countRecursive(dirPath);
  }
  
  return count;
}

// Ejecutar backup
backupArchivos();