# Solución al Problema de Restauración de Activities

## Problema Identificado
Los datos exportados de la tabla `activities` incluyen columnas que no existen en el esquema actual:
- `created_by` - Para sistema colaborativo de actividades
- `original_activity_id` - Para actividades duplicadas

## Solución Implementada

### 1. Esquema Corregido en `shared/schema.ts`
```typescript
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  phaseId: integer("phase_id").notNull().references(() => constructionPhases.id),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  description: text("description"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).default("0"),
  createdBy: integer("created_by"),
  originalActivityId: integer("original_activity_id"),
});
```

### 2. Pasos para Corregir en tu Nuevo Proyecto

#### Opción A: Actualizar Schema y Recrear DB
```bash
# 1. Copiar el esquema corregido
# 2. Recrear la estructura de base de datos
npm run db:push

# 3. Restaurar datos
node restore-data.cjs
```

#### Opción B: Usar SQL para Agregar Columnas
```sql
-- Agregar columnas faltantes manualmente
ALTER TABLE activities ADD COLUMN created_by INTEGER;
ALTER TABLE activities ADD COLUMN original_activity_id INTEGER;

-- Luego ejecutar restore
```

### 3. Verificación
Después de la restauración deberías ver:
```
✅ activities: 455/455 registros importados
✅ activity_compositions: 2798/2798 registros importados
```

## Archivos Actualizados
- `shared/schema.ts` - Esquema corregido con columnas faltantes
- El esquema en `micaa-duplicacion/` también está actualizado

## Resultado Esperado
Una vez aplicada la corrección, la restauración debe completarse exitosamente con todos los 5,361 registros importados sin errores de columnas faltantes o restricciones de clave foránea.