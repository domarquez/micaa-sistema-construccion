# PASOS COMPLETOS PARA DESPLEGAR MICAA EN RENDER

## 🚀 Configuración Inicial

### 1. Preparar Repositorio en GitHub
```bash
# Si no tienes git configurado
git init
git add .
git commit -m "Initial commit - MICAA construction management system"
git branch -M main
git remote add origin https://github.com/tu-usuario/micaa.git
git push -u origin main
```

### 2. Crear Cuenta en Render
- Ir a [render.com](https://render.com)
- Registrarse con GitHub
- Conectar tu repositorio

## 📊 Configuración de Base de Datos

### 3. Crear PostgreSQL Database
1. **Dashboard Render** → **New** → **PostgreSQL**
2. Configurar:
   ```
   Name: micaa-postgres
   Database: micaa
   User: micaa_user
   Region: Oregon (US West)
   PostgreSQL Version: 16
   Plan: Starter ($7/month)
   ```
3. **Create Database**
4. **Copiar Internal Database URL** (necesaria para el paso 5)

## 🌐 Configuración del Web Service

### 4. Crear Web Service
1. **Dashboard** → **New** → **Web Service**
2. **Connect a repository** → Seleccionar tu repo de MICAA
3. Configuración:
   ```
   Name: micaa-app
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   Plan: Starter ($7/month)
   ```

### 5. Variables de Entorno
En **Environment Variables**, agregar:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://micaa_user:password@host/micaa?sslmode=require
JWT_SECRET=tu_clave_secreta_muy_segura_aqui_min_32_chars
PORT=5000
```

**⚠️ IMPORTANTE**: 
- Usar la **Internal Database URL** de tu PostgreSQL de Render
- Generar JWT_SECRET seguro: `openssl rand -base64 32`

## 🔧 Configuraciones Adicionales

### 6. Configurar Auto-Deploy
- En **Settings** del Web Service
- **Auto-Deploy**: **Yes** (se actualiza automáticamente con commits)

### 7. Configurar Health Checks
- **Health Check Path**: `/api/health` (ya configurado en la app)
- **Port**: 5000

## 🗄️ Migración de Datos

### 8. Importar Base de Datos (Opcional)
Si tienes datos existentes:

```bash
# Exportar desde tu base local
pg_dump $DATABASE_URL > micaa_backup.sql

# Importar a Render (usar External Database URL)
psql $RENDER_DATABASE_URL < micaa_backup.sql
```

## 🚀 Despliegue y Verificación

### 9. Deploy Automático
- Render comenzará el build automáticamente
- Monitorear en **Logs** tab
- Proceso completo: 3-5 minutos

### 10. Verificar Funcionamiento
Tu app estará disponible en: `https://micaa-app.onrender.com`

Verificar:
- ✅ **Landing page** carga correctamente
- ✅ **Login** funciona
- ✅ **Materiales** se muestran
- ✅ **Actividades** aparecen
- ✅ **Base de datos** conectada

## 🔧 Configuraciones Post-Despliegue

### 11. Configurar Dominio Personalizado (Opcional)
1. **Settings** → **Custom Domains**
2. Agregar: `tu-dominio.com`
3. Configurar DNS:
   ```
   CNAME: tu-dominio.com → micaa-app.onrender.com
   ```

### 12. Configurar SSL/HTTPS
- ✅ **Automático** en Render
- Certificados Let's Encrypt incluidos

## 📊 Monitoreo y Mantenimiento

### 13. Configurar Alertas
- **Settings** → **Notifications**
- Configurar alertas por email/Slack

### 14. Backup Strategy
```bash
# Backup automático diario (configurar en cron)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## 💰 Costos Mensuales
- **Web Service Starter**: $7/mes
- **PostgreSQL Starter**: $7/mes
- **Total**: **$14/mes**

## 🛠️ Comandos Útiles

```bash
# Ver logs en tiempo real
render logs --service micaa-app

# Reiniciar servicio
render restart --service micaa-app

# Verificar status
render status --service micaa-app
```

## 🔍 Troubleshooting

### Build Failures:
```bash
# Verificar dependencias
npm install
npm run build
```

### Database Connection Issues:
- Verificar DATABASE_URL
- Confirmar que PostgreSQL esté running
- Revisar firewall/SSL settings

### 404 Errors:
- Verificar build artifacts en `/dist`
- Revisar configuración de rutas estáticas

## ✅ Checklist Final

- [ ] Repositorio en GitHub actualizado
- [ ] PostgreSQL database creado
- [ ] Web service configurado
- [ ] Variables de entorno establecidas
- [ ] Build exitoso
- [ ] App funcionando en producción
- [ ] Dominio configurado (opcional)
- [ ] Monitoreo activado

¡Tu aplicación MICAA está lista en producción! 🎉