# Cómo Copiar MICAA por Partes (Archivos Grandes)

## Estrategia: Dividir en 4 Partes Pequeñas

### Parte 1: Configuración Base (5MB aprox)
```
📄 package.json
📄 tsconfig.json  
📄 vite.config.ts
📄 tailwind.config.ts
📄 drizzle.config.ts
📄 postcss.config.js
📄 .gitignore
📄 backup-complete.js
📄 restore-complete.js
📄 duplicate-project.md
📄 DUPLICACION-COMPLETA-MICAA.md
📁 shared/ (completa)
```

### Parte 2: Backend (20MB aprox)
```
📁 server/ (completa con todos los .ts)
  ├── index.ts
  ├── routes.ts
  ├── db.ts
  ├── auth.ts
  ├── email-service.ts
  ├── email-bulk-service.ts
  └── todos los demás archivos .ts
```

### Parte 3: Frontend Base (30MB aprox)
```
📁 client/
  ├── index.html
  └── src/
      ├── components/ (sin uploads pesados)
      ├── hooks/
      ├── lib/
      └── pages/
```

### Parte 4: Solo Datos Esenciales (Variable)
```
📁 backup-micaa/ (después de ejecutar backup)
📁 uploads/ (solo archivos críticos)
```

## Método Recomendado: Código Primero, Datos Después

### Paso 1: Crear Estructura Mínima
En el nuevo proyecto, crea manualmente:

```bash
mkdir -p server client/src/{components,hooks,lib,pages} shared uploads
```

### Paso 2: Copiar Archivos de Configuración
Copia uno por uno estos archivos críticos:
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `drizzle.config.ts`
- `shared/schema.ts`

### Paso 3: Copiar Backend por Archivos
Copia cada archivo .ts del server/ individualmente:
- `server/index.ts`
- `server/routes.ts`
- `server/db.ts`
- etc.

### Paso 4: Copiar Frontend por Carpetas
Copia cada subcarpeta de client/src/ por separado:
- `client/src/components/`
- `client/src/pages/`
- `client/src/hooks/`
- `client/src/lib/`

## Alternativa: Usar GitHub como Puente

### Si tienes GitHub disponible:
1. **En proyecto actual**: Crear repositorio privado
2. **Push código** (sin uploads pesados)
3. **En nuevo proyecto**: Clone del repositorio
4. **Copiar datos** por separado

### Comandos Git:
```bash
# En proyecto actual
git init
git add . --ignore-errors
git commit -m "backup completo"
git remote add origin https://github.com/tu-usuario/micaa-backup.git
git push -u origin main

# En proyecto nuevo  
git clone https://github.com/tu-usuario/micaa-backup.git
```

## Método de Archivos Críticos Únicamente

Si quieres lo mínimo funcional:

### Solo estos archivos (15MB total):
```
package.json
tsconfig.json
vite.config.ts
drizzle.config.ts
shared/schema.ts
server/index.ts
server/routes.ts
server/db.ts
server/auth.ts
client/index.html
client/src/App.tsx
client/src/main.tsx
```

### Para datos:
```bash
# En proyecto actual
node backup-complete.js

# Copiar solo: backup-micaa/*.json (archivos de datos)
```

## Herramientas de Replit para Archivos Grandes

### 1. Usar Terminal para Comprimir
```bash
# Dividir en archivos de 50MB
tar -czf - client/ | split -b 50M - client-part-
```

### 2. Subir por Partes
```bash
# Subir cada parte individualmente
# client-part-aa, client-part-ab, etc.
```

### 3. Reconstruir en Destino
```bash
# En nuevo proyecto
cat client-part-* | tar -xzf -
```

## Recomendación Final

**Método más fácil para 100MB+:**

1. **Copia manual** de archivos de configuración
2. **Copia manual** de server/ archivo por archivo  
3. **Copia manual** de client/src/ carpeta por carpeta
4. **Ejecuta backup** en original
5. **Copia backup-micaa/** al nuevo proyecto
6. **Ignora uploads/** inicialmente (se puede recrear)

¿Quieres que te ayude a identificar exactamente cuáles son los archivos más pesados para priorizarlos?