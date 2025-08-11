# MICAA - Sistema Integral de Construcción y Arquitectura

## Overview

MICAA is a comprehensive construction management platform designed for Bolivia, offering budget estimation, material pricing, activity management, and supplier integration. The system provides APU (Análisis de Precios Unitarios) calculations, regional price adjustments, and a marketplace for construction materials and suppliers.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js 20 with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based authentication with bcryptjs
- **File Uploads**: Multer with Sharp for image processing
- **API Design**: RESTful endpoints with structured error handling

### Data Storage Solutions
- **Primary Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle with migrations support
- **File Storage**: Local filesystem with organized upload directories
- **Cache**: TanStack Query provides client-side caching

## Key Components

### Core Modules
1. **User Management**: Authentication, authorization, role-based access (admin, user, supplier)
2. **Materials Management**: Catalog with categories, pricing, and supplier relationships
3. **Activities Management**: Construction activities with APU calculations and compositions
4. **Budget Management**: Multi-phase project budgets with detailed item breakdowns
5. **Supplier Network**: Company profiles, pricing, and marketplace integration
6. **Price Intelligence**: Regional price factors and dynamic pricing adjustments

### Specialized Features
- **APU Calculator**: Detailed unit price analysis following Bolivian construction standards
- **City Price Factors**: Geographic pricing adjustments for different Bolivian cities
- **Supplier Marketplace**: Platform for material suppliers with advertising capabilities
- **Tools & Labor Management**: Equipment and workforce cost tracking
- **Custom Activities**: User-defined activities with custom compositions

## Data Flow

### Authentication Flow
1. User submits credentials → Backend validates → JWT token generated
2. Token stored in localStorage → Included in API requests
3. Middleware validates token → User context provided to endpoints

### Budget Creation Flow
1. User creates project → Selects activities → System calculates compositions
2. Material prices fetched → Regional factors applied → Final costs computed
3. Budget items generated → PDF export capability → Storage in database

### Price Calculation Flow
1. Base material prices → Activity compositions → Labor and equipment costs
2. Regional adjustments → Administrative costs → Utility margins
3. Tax calculations → Final unit prices → Budget totals

## External Dependencies

### Core Libraries
- **Database**: @neondatabase/serverless, drizzle-orm
- **Authentication**: jsonwebtoken, bcryptjs
- **File Processing**: multer, sharp
- **UI Components**: @radix-ui/* packages
- **Validation**: zod, @hookform/resolvers
- **Charts**: recharts for data visualization

### Development Tools
- **Build**: esbuild for server bundling
- **Development**: tsx for TypeScript execution
- **Deployment**: Replit with autoscale deployment target

## Deployment Strategy

### Environment Configuration
- **Development**: Local development with hot reloading via Vite (Replit)
- **Production**: Optimized for Render deployment with automatic scaling
- **Database**: PostgreSQL with Neon serverless (shared between environments)
- **Ports**: Application runs on port 5000

### Build Process
1. Client build: Vite optimizes React application
2. Server build: esbuild bundles Node.js with external dependencies
3. Static assets: Served from dist/public directory
4. Database: Drizzle migrations applied automatically
5. Environment detection: Auto-configures for Replit vs Render

### Render Deployment
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Health Check**: `/health` endpoint for monitoring
- **Auto-scaling**: Configured for starter plan with upgrade path

### Scaling Considerations
- Connection pooling optimized for production
- WebSocket fallback for environments without ws support
- Error handling and graceful shutdown
- Asset optimization and caching
- Environment-specific plugin loading

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 21, 2025: Initial setup
- June 21, 2025: Google AdSense integration completed - Added comprehensive ad system with strategic placement across all pages while maintaining user experience and Google policies compliance
- June 21, 2025: Email system implementation completed - Added SMTP configuration with mail.micaa.store, automatic notifications for registrations/contacts, password recovery functionality, and responsive design fixes across all pages and components
- June 21, 2025: Removed all insucoms references and added activity selector component - Cleaned up external references throughout codebase and created comprehensive activity selection menu with search, filtering, and detailed activity information display
- June 22, 2025: Collaborative activity system implemented - Added user attribution, activity duplication, and contribution tracking with creator badges and system/user distinction
- June 22, 2025: Production optimization for Render - Environment detection for Replit-specific plugins, optimized build process, enhanced error handling, connection pooling, health checks, and deployment configuration while maintaining full Replit compatibility
- June 22, 2025: Sistema "Copia por: usuario" implementado - Distinción clara entre actividades originales y duplicadas con atribución completa al usuario que realizó la copia. Aplicación optimizada y lista para push a Git y despliegue en Render
- June 22, 2025: MICAA v2.0 pushed to Git - Package.json actualizado, servidor simplificado funcionando en puerto 5000, push exitoso a repositorio GitHub domarquez/BuildBudgetPro
- June 22, 2025: Servidor corregido y aplicación React funcional - Eliminada dependencia problemática de vite.ts, configuración limpia de Vite en desarrollo, aplicación MICAA completamente accesible con todas las funcionalidades
- June 22, 2025: Optimización completa para Replit - Código revisado y optimizado específicamente para entorno Replit, configuración Vite simplificada, logging mejorado, pool de conexiones DB ajustado para recursos limitados
- June 22, 2025: Base de datos restaurada con backup - Esquema Drizzle corregido usando backup SQL, relaciones simplificadas, servidor funcionando correctamente, API endpoints estables
- June 22, 2025: Sistema completamente restaurado desde backup - Base de datos con 455 actividades, 1,762 materiales, 167 usuarios restaurada exitosamente, frontend completo integrado, aplicación MICAA totalmente funcional
- June 22, 2025: Rutas públicas corregidas y materiales visibles - API endpoints funcionando correctamente, frontend mostrando materiales, categorías y proveedores, sistema completamente operativo
- June 22, 2025: Filtro por categoría de materiales corregido y datos estadísticos restaurados - Materiales se filtran correctamente por categoría, endpoints de estadísticas y datos de crecimiento funcionando, dashboard mostrando datos reales del sistema
- June 22, 2025: Sistema de login mejorado y recuperación de contraseña implementado - Agregado enlace "Ver versión pública" en login, sistema de recuperación de contraseña por email usando contacto@micaa.store, interfaz de usuario mejorada con formularios responsivos
- June 22, 2025: Usuarios del backup cargados correctamente - 167 usuarios restaurados desde backup con credenciales válidas, sistema SMTP configurado con mail.micaa.store (contacto@micaa.store), nodemailer instalado y funcional
- June 22, 2025: Sistema de contraseñas temporales implementado - Recuperación por email genera contraseñas de 6 caracteres fáciles de recordar (palabra+número), endpoint para cambio de contraseña en panel de usuario, página de configuración de cuenta agregada
- June 22, 2025: Error de módulos ES corregido - Convertido require() a import() dinámico para bcryptjs y jsonwebtoken, sistema de recuperación de contraseñas funcionando correctamente con generación automática
- June 22, 2025: Sistema de login con verificación real implementado - Reemplazado sistema de contraseñas hardcodeadas por verificación bcrypt contra base de datos, tokens JWT reales generados, contraseñas temporales funcionando correctamente
- June 22, 2025: Sistema de contraseñas temporales totalmente funcional - Generación, hash, actualización en BD y verificación de login funcionando correctamente, usuarios pueden recuperar acceso por email con contraseñas de 6 caracteres
- June 22, 2025: Endpoint /api/auth/me corregido - Reemplazado usuario hardcodeado por verificación JWT real, ahora muestra correctamente los datos del usuario autenticado desde la base de datos
- June 22, 2025: Endpoint /api/projects implementado - Agregado POST y GET para crear y obtener proyectos del usuario autenticado, sistema de creación de proyectos funcionando correctamente
- June 22, 2025: Error de anidación de botones corregido - Separado CollapsibleTrigger de elementos Button para prevenir problemas de validación DOM, aplicación funcionando correctamente
- June 22, 2025: Credenciales de administrador configuradas - Usuario admin: dmarquez con contraseña temporal establecida para acceso al panel de administración
- June 22, 2025: Sistema de anuncios rotativos restaurado - Corregido endpoint /api/public/dual-advertisements para mostrar publicidades de empresas proveedoras, fechas de caducidad actualizadas
- June 22, 2025: Estadísticas y registro corregidos - Estadísticas muestran datos reales (14 presupuestos, 32 proyectos, Bs. 351,489.45), sistema de registro mejorado con validación de emails duplicados y hash de contraseñas, imágenes profesionales en anuncios
- June 22, 2025: Panel de publicidad para empresas implementado - Agregado botón de publicidad en dashboard de empresas y opción en sidebar, empresas proveedoras pueden gestionar anuncios promocionales desde su panel
- June 22, 2025: Git sincronizado y push exitoso - Resuelto conflicto de sincronización con repositorio remoto, código actualizado correctamente en GitHub
- June 22, 2025: Nuevo repositorio preparado - Creadas instrucciones para nuevo repositorio GitHub debido a conflictos de historia divergente, sistema MICAA 100% funcional listo para respaldo
- June 22, 2025: Push exitoso a nuevo repositorio - Sistema MICAA completamente respaldado en GitHub (1224 objetos, 48.67 MiB), repositorio micaa-sistema-construccion creado y funcional
- June 22, 2025: Token de GitHub con permisos insuficientes - Creadas instrucciones manuales para respaldo, sistema MICAA completamente funcional e independiente del repositorio Git
- June 25, 2025: Sistema CRUD completo de administrador implementado - Agregadas rutas y páginas para gestión total de materiales (crear/editar/eliminar), usuarios (roles/estado), empresas proveedoras y anuncios, middleware de verificación de rol admin, acceso completo verificado funcionando
- June 25, 2025: Sistema de envío masivo de emails implementado - Creado servicio de emails masivos usando SMTP propio (mail.micaa.store) con pausas anti-spam de 5 minutos entre emails y 30 minutos entre lotes, templates profesionales para actualización de contraseñas, recordatorios de publicidad y actualización de datos, panel de administración completo con seguimiento en tiempo real
- June 25, 2025: Actividades de construcción verificadas y corregidas - 455 actividades totales correctamente distribuidas en 9 fases, límite de API aumentado de 20 a 100 por defecto, actividades de jardines y vías reclasificadas a sus fases correspondientes
- June 29, 2025: Sistema completo de duplicación de proyecto implementado - Creado paquete tar.gz de 377KB con backup completo de 5,361 registros, scripts automatizados de exportación/importación, guías detalladas de instalación, solución para problemas de Git mediante duplicación limpia
- June 29, 2025: Esquema de actividades completado y orden de restauración corregido - Agregadas columnas faltantes (is_system_default, is_public, created_at, updated_at) al esquema de activities, corregido orden de importación para respetar dependencias entre activity_compositions y tools, restauración exitosa de 171 usuarios, 1,762 materiales y 455 actividades
- June 29, 2025: Sistema de labor_categories implementado y duplicación completa finalizada - Creadas 8 categorías de mano de obra con esquema correcto (hourly_rate, unit, skill_level), script de restauración automatizado funcional, sistema de duplicación completo listo para despliegue con 5,361 registros totales
- June 29, 2025: Sistema completo de backup con imágenes implementado - Agregado backup automático de 28 archivos (logos, anuncios, PDFs), restauración completa incluye base de datos y archivos, sistema de duplicación 100% funcional con preservación total de assets visuales
- August 11, 2025: Vulnerabilidades de seguridad resueltas para deployment - Solucionadas 6 vulnerabilidades críticas/altas (form-data, multer, brace-expansion, on-headers, express-session), quedan solo 4 moderadas en subdependencias. Build optimizado y funcional para Render con script personalizado build.sh