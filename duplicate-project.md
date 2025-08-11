# Guía Rápida para Duplicar MICAA

## Paso a Paso Simplificado

### 1. En el Proyecto Actual (MICAA Original)

```bash
# Hacer backup completo
node backup-complete.js
```

Esto creará una carpeta `backup-micaa` con todos los datos.

### 2. Crear Nuevo Proyecto en Replit

1. Ir a https://replit.com
2. "Create Repl" → "Node.js"
3. Nombre: `micaa-duplicado`
4. "Create Repl"

### 3. Configurar Base de Datos

1. En el nuevo proyecto: Tools → Database → PostgreSQL
2. Esperar que se configure automáticamente

### 4. Copiar Archivos

**Método 1: Manual**
- Copiar todos los archivos y carpetas del proyecto original al nuevo
- Estructura completa: `server/`, `client/`, `shared/`, archivos config

**Método 2: Zip/Download**
- Descargar proyecto original como ZIP
- Extraer en el nuevo proyecto
- Mantener solo la DATABASE_URL del nuevo proyecto

### 5. En el Nuevo Proyecto

```bash
# Instalar dependencias
npm install

# Crear estructura de base de datos
npm run db:push

# Copiar carpeta backup-micaa del proyecto original

# Restaurar datos
node restore-complete.js

# Iniciar aplicación
npm run dev
```

### 6. Verificar Funcionamiento

- ✅ Servidor en puerto 5000
- ✅ Login funcional
- ✅ Materiales visibles
- ✅ Actividades con paginación
- ✅ Panel admin accesible

## Variables de Entorno Necesarias

En el archivo `.env` del nuevo proyecto:

```env
DATABASE_URL=postgresql://... (automática de Replit)
SMTP_HOST=mail.micaa.store
SMTP_PORT=587
SMTP_USER=contacto@micaa.store
SMTP_PASS=tu_password_email
JWT_SECRET=micaa-secret-key
NODE_ENV=development
```

## Lista de Verificación

- [ ] Nuevo proyecto creado
- [ ] PostgreSQL configurado
- [ ] Archivos copiados completamente
- [ ] Dependencias instaladas
- [ ] Base de datos creada (`npm run db:push`)
- [ ] Backup copiado
- [ ] Datos restaurados
- [ ] Aplicación funcionando
- [ ] Login verificado
- [ ] Funcionalidades principales probadas

## Tiempo Total Estimado: 30-45 minutos

## En Caso de Problemas

### Error de Base de Datos
```bash
npm run db:push
```

### Error de Dependencias
```bash
rm -rf node_modules
npm install
```

### Error de Permisos
- Verificar que el usuario admin existe
- Usar credenciales: dmarquez / (contraseña temporal)

### Error de Email
- Revisar variables SMTP en .env
- Contactar para obtener credenciales

## Ventajas de Esta Duplicación

1. **Repositorio limpio** sin historial Git problemático
2. **Base de datos nueva** con mejor rendimiento
3. **Configuración fresca** sin archivos residuales
4. **Mismo contenido** con todos los datos preservados
5. **Fácil mantenimiento** para futuras actualizaciones

¡El nuevo proyecto será una copia exacta y funcional del original!