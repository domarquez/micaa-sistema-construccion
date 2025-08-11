# Plan Optimizado para Copiar MICAA (Sin node_modules)

## El Problema Detectado:
- **node_modules**: +200MB (no necesario copiar)
- **attached_assets**: +37MB (archivos opcionales)
- **.git**: +49MB (historial problemático)

## Solución: Copiar Solo Código Fuente (~10MB)

### Archivos Esenciales a Copiar (Total: ~10MB):

#### 1. Configuración (2MB):
```
package.json
tsconfig.json
vite.config.ts
tailwind.config.ts
drizzle.config.ts
postcss.config.js
backup-complete.js
restore-complete.js
```

#### 2. Backend Server (3MB):
```
server/index.ts
server/routes.ts
server/db.ts
server/auth.ts
server/email-service.ts
server/email-bulk-service.ts
server/apu-calculator.ts
server/city-price-calculator.ts
server/price-calculator.ts
server/storage.ts
[todos los demás .ts del server]
```

#### 3. Esquema de Datos (1MB):
```
shared/schema.ts
```

#### 4. Frontend React (4MB):
```
client/index.html
client/src/main.tsx
client/src/App.tsx
client/src/components/ (toda la carpeta)
client/src/pages/ (toda la carpeta)
client/src/hooks/ (toda la carpeta)
client/src/lib/ (toda la carpeta)
```

## Pasos Específicos de Copia:

### Paso 1: Crear Nuevo Proyecto Replit
1. Replit.com → Create Repl → Node.js
2. Nombre: `micaa-limpio`
3. Configurar PostgreSQL: Tools → Database

### Paso 2: Copiar Archivos de Configuración
Copiar estos archivos UNO POR UNO:
- `package.json` (crítico)
- `tsconfig.json`
- `vite.config.ts`
- `drizzle.config.ts`

### Paso 3: Crear Estructura de Carpetas
```bash
mkdir -p server client/src/{components,pages,hooks,lib} shared
```

### Paso 4: Copiar Backend Completo
Copiar cada archivo .ts de la carpeta `server/`:
- Abrir archivo en proyecto original
- Copiar contenido completo
- Crear archivo en nuevo proyecto
- Pegar contenido

### Paso 5: Copiar Frontend por Partes
- `client/index.html`
- `client/src/main.tsx`
- `client/src/App.tsx`
- Cada subcarpeta de `client/src/`

### Paso 6: Instalar Dependencias
```bash
npm install
```
(Esto recreará node_modules automáticamente)

### Paso 7: Configurar Base de Datos
```bash
npm run db:push
```

### Paso 8: Hacer Backup de Datos
En el proyecto ORIGINAL:
```bash
node backup-complete.js
```

### Paso 9: Copiar Solo Datos
Copiar la carpeta `backup-micaa/` generada (solo archivos .json)

### Paso 10: Restaurar Datos
En el proyecto NUEVO:
```bash
node restore-complete.js
```

### Paso 11: Probar
```bash
npm run dev
```

## Ventajas de Este Método:
- **Solo 10MB** de archivos a copiar
- **Sin conflictos** de node_modules
- **Sin historial Git** problemático
- **Instalación limpia** de dependencias
- **Base de datos nueva** y optimizada

## Archivos que NO Copiar:
- ❌ `node_modules/` (se regenera con npm install)
- ❌ `.git/` (historial problemático)
- ❌ `attached_assets/` (opcional, archivos grandes)
- ❌ `uploads/` (se puede recrear)
- ❌ archivos `.log`
- ❌ archivos temporales

## Orden de Prioridad:
1. **Crítico**: package.json, server/, shared/
2. **Importante**: client/src/, archivos config
3. **Datos**: backup-micaa/
4. **Opcional**: uploads/, assets

## Tiempo Estimado: 20 minutos
- Copia archivos: 10 min
- npm install: 5 min
- Configuración BD: 3 min
- Restaurar datos: 2 min

¿Empezamos con este plan optimizado?