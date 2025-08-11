# Labor Categories Schema - Corrección Final

## ❌ Error Anterior
El script intentaba usar `daily_rate` pero el esquema real usa `hourly_rate`.

## ✅ Esquema Correcto
```sql
labor_categories:
- id (serial)
- name (text) 
- description (text)
- unit (text) - REQUERIDO
- hourly_rate (decimal) - REQUERIDO
- skill_level (text) - basic/skilled/specialist
- is_active (boolean) - default true
```

## 🔧 Categorías Creadas
| ID | Nombre | Tarifa/Hora (Bs.) | Nivel |
|----|--------|------------------|-------|
| 1  | ALBAÑIL | 15.00 | skilled |
| 2  | AYUDANTE | 10.00 | basic |
| 3  | CARPINTERO | 16.25 | skilled |
| 4  | ELECTRICISTA | 17.50 | specialist |
| 9  | PLOMERO | 16.85 | skilled |
| 10 | FIERRERO | 15.60 | skilled |
| 11 | SOLDADOR | 18.75 | specialist |
| 12 | PINTOR | 13.75 | skilled |

## 🚀 Comando Final
```bash
cp micaa-duplicacion/restore-data.cjs .
node limpiar-base-datos.cjs
node restore-data.cjs
```

Ahora la restauración debería completarse sin errores de esquema.