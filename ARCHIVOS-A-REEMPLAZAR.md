# Archivos para Duplicar MICAA

## ✅ Archivos Críticos (OBLIGATORIOS)

### Esquema de Base de Datos
- `shared/schema.ts` → **REEMPLAZAR** con `micaa-duplicacion/shared/schema.ts`

### Scripts de Restauración  
- `limpiar-base-datos.cjs` → **COPIAR** desde `micaa-duplicacion/`
- `restore-data.cjs` → **COPIAR** desde `micaa-duplicacion/`

### Datos de Backup
- `backup-micaa/` → **COPIAR CARPETA COMPLETA** desde `micaa-duplicacion/`

## ⚠️ Archivos Opcionales (Solo si tienes problemas)

### Configuración
- `package.json` → Solo si faltan dependencias
- `drizzle.config.ts` → Solo si hay problemas de conexión DB

## 🚀 Proceso de Instalación

```bash
# 1. Copiar archivos críticos
cp micaa-duplicacion/shared/schema.ts shared/schema.ts
cp micaa-duplicacion/limpiar-base-datos.cjs .
cp micaa-duplicacion/restore-data.cjs .
cp -r micaa-duplicacion/backup-micaa .

# 2. Aplicar esquema actualizado
npm run db:push

# 3. Limpiar datos existentes
node limpiar-base-datos.cjs

# 4. Restaurar datos completos (5,361 registros)
node restore-data.cjs

# 5. Verificar funcionamiento
npm run dev
```

## ✅ Resultado Esperado
- 167 usuarios restaurados
- 1,762 materiales importados  
- 455 actividades de construcción
- 32 proyectos y 14 presupuestos
- Sistema colaborativo funcionando
- Todas las funcionalidades operativas

## 📁 Estructura Final
```
tu-proyecto/
├── shared/schema.ts        ← Esquema actualizado
├── backup-micaa/          ← Datos para restaurar
├── limpiar-base-datos.cjs ← Script de limpieza
├── restore-data.cjs       ← Script de restauración
└── [resto de archivos sin cambios]
```