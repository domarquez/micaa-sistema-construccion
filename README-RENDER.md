# MICAA - Guía de Despliegue en Render

## Resumen del Proyecto
MICAA es un sistema integral de construcción y arquitectura desarrollado con:
- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Node.js 20 + Express + TypeScript  
- **Base de Datos:** PostgreSQL con Drizzle ORM
- **Email:** SMTP con mail.micaa.store

## Configuración Render

### 1. Crear Base de Datos PostgreSQL
1. En Render Dashboard → New → PostgreSQL
2. Nombre: `micaa-db`
3. Plan: Starter (gratuito)
4. Copiar `DATABASE_URL` para usar en el Web Service

### 2. Crear Web Service
1. En Render Dashboard → New → Web Service
2. Conectar repositorio de GitHub
3. Configuración:
   - **Name:** `micaa-app`
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Node Version:** 18+

### 3. Variables de Entorno
Agregar en Render Dashboard → Environment:
```
NODE_ENV=production
DATABASE_URL=[URL de la base de datos PostgreSQL]
SMTP_HOST=mail.micaa.store
SMTP_PORT=465
SMTP_USER=contacto@micaa.store
SMTP_PASS=[contraseña SMTP configurada]
NOTIFICATION_EMAIL=contacto@micaa.store
```

### 4. Scripts de Build Optimizados
El proyecto incluye scripts optimizados para producción:
- `npm run build` - Construye cliente y servidor
- `npm start` - Inicia aplicación en producción
- `npm run db:push` - Ejecuta migraciones (una vez desplegado)

### 5. Características de Producción
- Health check endpoint: `/health`
- Manejo de errores mejorado
- Pool de conexiones optimizado
- Compatibilidad con WebSocket de Neon
- Assets estáticos optimizados

## Después del Despliegue

### 1. Ejecutar Migraciones
Una vez desplegado, acceder a Shell en Render y ejecutar:
```bash
npm run db:push
```

### 2. Verificar Funcionalidad
- Endpoint health: `https://tu-app.onrender.com/health`
- Landing page: `https://tu-app.onrender.com`
- API: `https://tu-app.onrender.com/api/statistics`

## Datos Preexistentes
La aplicación incluye datos completos del sector construcción boliviano:
- **1,762** materiales con precios
- **455** actividades de construcción
- **2,798** composiciones APU
- Sistema colaborativo de actividades
- Marketplace de proveedores

## Funcionalidades Clave
- Cálculo de presupuestos con APU
- Sistema colaborativo de actividades
- Marketplace para proveedores
- Factores de precios por ciudad
- Sistema de email automático
- Panel administrativo completo

## Monitoreo
La aplicación incluye:
- Health checks automáticos
- Logging estructurado
- Manejo graceful de errores
- Métricas de rendimiento

## Escalabilidad
Configurado para:
- Auto-scaling en Render
- Pool de conexiones eficiente
- Optimización de assets
- Cache del lado cliente

El sistema está completamente optimizado y listo para producción en Render.