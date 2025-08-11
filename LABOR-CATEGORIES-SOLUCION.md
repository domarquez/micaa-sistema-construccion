# Solución Labor Categories - MICAA

## ✅ Problema Identificado
Los datos de `activity_compositions` referencian `labor_categories` que no existían en el backup, causando errores de clave foránea.

## 🔧 Solución Implementada
Creé las 8 categorías de mano de obra necesarias con IDs específicos:

| ID | Categoría | Tarifa Diaria (Bs.) | Nivel |
|----|-----------|-------------------|-------|
| 1  | ALBAÑIL   | 120.00           | Especializada |
| 2  | AYUDANTE  | 80.00            | No especializada |
| 3  | CARPINTERO| 130.00           | Especializada |
| 4  | ELECTRICISTA| 140.00         | Especializada |
| 9  | PLOMERO   | 135.00           | Especializada |
| 10 | FIERRERO  | 125.00           | Especializada |
| 11 | SOLDADOR  | 150.00           | Especializada |
| 12 | PINTOR    | 110.00           | Especializada |

## 📋 Proceso Automatizado
El script `restore-data.cjs` ahora:
1. Crea automáticamente labor_categories
2. Importa todas las tablas en orden correcto
3. Resuelve todas las dependencias

## 🚀 Comando Final
```bash
# Copiar script corregido
cp micaa-duplicacion/restore-data.cjs .

# Restaurar completamente 
node limpiar-base-datos.cjs
node restore-data.cjs
```

## 📊 Resultado Esperado
- ✅ 8 categorías de mano de obra creadas
- ✅ Activity compositions importadas sin errores
- ✅ Sistema completo con 5,361 registros funcionando