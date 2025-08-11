# MICAA - Instrucciones de Instalación

## Contenido del ZIP
Este archivo contiene todo lo necesario para duplicar MICAA:

- **server/** - Backend completo con API
- **client/** - Frontend React con todas las páginas
- **shared/** - Esquema de base de datos
- **backup-micaa/** - Datos exportados (5,361 registros)
- **Archivos de configuración** - package.json, vite.config.ts, etc.
- **Scripts de restauración** - restore-complete.cjs

## Pasos de Instalación

### 1. Crear Nuevo Proyecto Replit
1. Ir a https://replit.com
2. "Create Repl" → "Node.js"
3. Nombre: `micaa-nuevo` (o el que prefieras)
4. Hacer clic en "Create Repl"

### 2. Configurar Base de Datos
1. En el nuevo proyecto: "Tools" → "Database"
2. Hacer clic en "PostgreSQL"
3. Esperar configuración automática

### 3. Subir Archivos
1. Extraer el contenido del ZIP
2. Subir todas las carpetas y archivos al proyecto
3. Mantener la estructura de directorios

### 4. Instalar Dependencias
```bash
npm install
```

### 5. Crear Estructura de Base de Datos
```bash
npm run db:push
```

### 6. Restaurar Datos y Archivos
```bash
# Limpiar base de datos (si ya tenía datos)
node limpiar-base-datos.cjs

# Restaurar datos y archivos (incluye todo automáticamente)
node restore-data.cjs
```

**El script restaura automáticamente:**
- ✅ 5,361 registros de base de datos
- ✅ 8 categorías de mano de obra (ALBAÑIL, CARPINTERO, PLOMERO, etc.)
- ✅ 28 archivos e imágenes (logos, anuncios, PDFs)
- ✅ Estructura completa de carpetas

### 7. Iniciar Aplicación
```bash
npm run dev
```

## Verificación de Funcionamiento

### Login de Administrador
- Usuario: `dmarquez`
- Contraseña temporal establecida

### Datos Incluidos
- 171 usuarios
- 1,762 materiales con precios
- 455 actividades de construcción
- 2,798 composiciones APU
- 32 proyectos y 14 presupuestos

### URLs de Verificación
- **Principal**: http://localhost:5000
- **Login**: http://localhost:5000/login
- **Admin**: http://localhost:5000/admin

## Variables de Entorno Necesarias

Crear archivo `.env` con:
```env
DATABASE_URL=postgresql://... (automática de Replit)
SMTP_HOST=mail.micaa.store
SMTP_PORT=587
SMTP_USER=contacto@micaa.store
SMTP_PASS=[solicitar contraseña]
JWT_SECRET=micaa-secret-key
NODE_ENV=development
```

## Funcionalidades Incluidas

### Para Usuarios
- Catálogo de materiales con precios
- Calculadora APU (Análisis de Precios Unitarios)
- Creador de presupuestos
- Gestión de proyectos
- Directorio de proveedores

### Para Administradores
- Gestión completa de materiales
- Organización de actividades por fases
- Sistema de envío masivo de emails
- Panel de estadísticas
- Gestión de usuarios y empresas

### Para Empresas Proveedoras
- Perfil de empresa
- Sistema de publicidad
- Gestión de materiales ofrecidos

## Solución de Problemas

### Error de Base de Datos
```bash
npm run db:push
```

### Error de Dependencias
```bash
rm -rf node_modules
npm install
```

### Error de Restauración
Verificar que exista la carpeta `backup-micaa` con archivos JSON

### Error de Permisos
Usar credenciales de admin: `dmarquez`

## Soporte Técnico

El sistema está completamente funcional y probado. 
Incluye todas las características del MICAA original:
- Sistema de autenticación JWT
- Base de datos PostgreSQL con Drizzle ORM
- Frontend React con Tailwind CSS
- API REST completa
- Sistema de emails SMTP

## Tiempo Total de Instalación: 15-20 minutos

Una vez completada la instalación, tendrás una copia exacta y funcional de MICAA lista para usar en producción.