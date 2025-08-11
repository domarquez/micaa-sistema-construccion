# Guía Completa para Duplicar MICAA

## Paso 1: Crear Nuevo Proyecto en Replit
1. Ir a https://replit.com
2. Hacer clic en "Create Repl"
3. Seleccionar "Node.js" como template
4. Nombrar el proyecto: `micaa-nuevo` o `micaa-v2`
5. Hacer clic en "Create Repl"

## Paso 2: Configurar Base de Datos PostgreSQL
1. En el nuevo proyecto, ir a "Tools" → "Database"
2. Hacer clic en "PostgreSQL"
3. Esperar a que se configure automáticamente
4. Anotar la URL de conexión que aparecerá en las variables de entorno

## Paso 3: Copiar Archivos del Proyecto Actual

### 3.1 Estructura de Directorios a Crear
```
micaa-nuevo/
├── client/
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── pages/
├── server/
├── shared/
├── uploads/
└── archivos de configuración
```

### 3.2 Archivos de Configuración Principal
Copiar estos archivos tal como están:
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `tailwind.config.ts`
- `drizzle.config.ts`
- `postcss.config.js`

### 3.3 Carpeta Server Completa
Copiar toda la carpeta `server/` con todos sus archivos:
- `index.ts`
- `routes.ts`
- `db.ts`
- `auth.ts`
- `email-service.ts`
- `email-bulk-service.ts`
- `apu-calculator.ts`
- `city-price-calculator.ts`
- Y todos los demás archivos .ts

### 3.4 Carpeta Shared
Copiar completamente:
- `shared/schema.ts`

### 3.5 Carpeta Client Completa
Copiar toda la estructura:
- `client/src/` con todas las subcarpetas
- `client/index.html`

## Paso 4: Instalar Dependencias
En el terminal del nuevo proyecto ejecutar:
```bash
npm install
```

## Paso 5: Configurar Variables de Entorno
En el archivo `.env` del nuevo proyecto agregar:
```env
# Base de datos (automática de Replit)
DATABASE_URL=postgresql://...

# Email SMTP
SMTP_HOST=mail.micaa.store
SMTP_PORT=587
SMTP_USER=contacto@micaa.store
SMTP_PASS=tu_password_email

# JWT Secret
JWT_SECRET=micaa-secret-key-nuevo

# Otros
NODE_ENV=development
```

## Paso 6: Importar Base de Datos

### 6.1 Exportar Datos del Proyecto Actual
En el proyecto actual, crear script de exportación:
```sql
-- Ejecutar en SQL Tool del proyecto actual
COPY (SELECT * FROM users) TO '/tmp/users.csv' WITH CSV HEADER;
COPY (SELECT * FROM materials) TO '/tmp/materials.csv' WITH CSV HEADER;
COPY (SELECT * FROM activities) TO '/tmp/activities.csv' WITH CSV HEADER;
-- etc para todas las tablas
```

### 6.2 Crear Esquema en Nueva DB
En el nuevo proyecto:
```bash
npm run db:push
```

### 6.3 Importar Datos
Usar el SQL Tool del nuevo proyecto para importar los datos exportados.

## Paso 7: Configurar Archivo de Inicio
Crear workflow en Replit:
- Nombre: "Start application"
- Comando: `npm run dev`

## Paso 8: Probar la Aplicación
1. Ejecutar `npm run dev`
2. Verificar que el servidor inicie en puerto 5000
3. Probar login con usuarios existentes
4. Verificar funcionalidades principales

## Archivos de Script para Automatizar

### backup-data.js (para proyecto actual)
```javascript
import { db } from './server/db.js';
import fs from 'fs';

async function backupAllTables() {
  // Script para exportar todas las tablas
  // Se ejecuta en el proyecto actual
}
```

### restore-data.js (para proyecto nuevo)
```javascript
import { db } from './server/db.js';
import fs from 'fs';

async function restoreAllTables() {
  // Script para importar todas las tablas
  // Se ejecuta en el proyecto nuevo
}
```

## Verificaciones Finales
- [ ] Base de datos conectada
- [ ] Usuarios pueden hacer login
- [ ] Materiales se muestran correctamente
- [ ] Actividades con paginación funcionan
- [ ] Panel de administración accesible
- [ ] Email SMTP configurado
- [ ] Archivos estáticos servidos correctamente

## Ventajas de Esta Duplicación
1. **Repositorio limpio**: Sin historial de Git conflictivo
2. **Base de datos nueva**: Conexiones frescas y optimizadas
3. **Dependencias actuales**: Versiones más recientes si es necesario
4. **Configuración simplificada**: Sin archivos residuales
5. **Mejor rendimiento**: Optimización desde cero

## Notas Importantes
- Mantener credenciales de email seguras
- Usar el mismo SECRET_KEY para compatibilidad de tokens
- Verificar que todas las rutas funcionen correctamente
- Probar funcionalidades críticas antes de migrar usuarios
- Hacer backup completo antes de cualquier cambio

## Tiempo Estimado
- Creación proyecto: 5 minutos
- Copia de archivos: 15 minutos
- Configuración DB: 10 minutos
- Importación datos: 20 minutos
- Pruebas: 15 minutos
- **Total: ~65 minutos**