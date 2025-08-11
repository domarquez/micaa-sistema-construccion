# MICAA - Duplicación Completa con Imágenes

## ✅ Sistema Completo Incluye

### Base de Datos (5,361 registros)
- 171 usuarios con contraseñas válidas
- 1,762 materiales con precios actualizados
- 455 actividades de construcción
- 8 categorías de mano de obra automáticas
- 13 herramientas y equipos
- Proyectos, presupuestos y composiciones

### Archivos e Imágenes (28 archivos)
- Logos de empresas (JPG, JPEG, WebP)
- Anuncios publicitarios (JPG, SVG)
- Documentos PDF (presupuestos)
- Estructura completa de carpetas

## 📁 Archivos de Duplicación

### Esenciales para Copiar:
1. `shared/schema.ts` - Esquema de base de datos actualizado
2. `backup-micaa/` - Carpeta completa con datos y archivos
3. `limpiar-base-datos.cjs` - Script de limpieza
4. `restore-data.cjs` - Script de restauración completa

### Scripts Adicionales (opcionales):
- `backup-archivos.cjs` - Para crear nuevos backups
- `restaurar-archivos.cjs` - Para restaurar solo archivos

## 🚀 Proceso Completo

```bash
# 1. Copiar archivos esenciales
cp micaa-duplicacion/shared/schema.ts shared/schema.ts
cp micaa-duplicacion/limpiar-base-datos.cjs .
cp micaa-duplicacion/restore-data.cjs .
cp -r micaa-duplicacion/backup-micaa .

# 2. Configurar estructura de BD
npm run db:push

# 3. Restauración completa
node limpiar-base-datos.cjs
node restore-data.cjs

# 4. Iniciar aplicación
npm run dev
```

## 📊 Resultado Final
- Sistema MICAA 100% funcional
- Todas las imágenes y archivos preservados
- Usuarios con acceso completo
- Datos auténticos de Bolivia
- Ready para producción

## 🔄 Para Futuros Backups
```bash
# Crear nuevo backup completo
node backup-complete.js      # Base de datos
node backup-archivos.cjs     # Archivos e imágenes
```

El sistema de duplicación está completo y probado.