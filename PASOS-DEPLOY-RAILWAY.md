# Pasos para Solucionar Pantalla en Blanco en Railway

## Cambios Realizados

✅ **Service Worker deshabilitado temporalmente** - Era la causa del problema
✅ **CSS corregido** - Sin reglas duplicadas
✅ **Build exitoso** - Todos los archivos se generan correctamente
✅ **Archivos PWA copiados** - manifest.json e iconos en dist/public

## Hacer Deploy Ahora

### 1. Commit y Push a GitHub

```bash
git add .
git commit -m "Fix: Deshabilitar service worker temporalmente"
git push origin main
```

### 2. Esperar Deploy Automático en Railway (2-3 minutos)

Railway detectará el push y reconstruirá la app.

### 3. Limpiar Caché del Navegador

Después del deploy:
- **En Desktop:** Ctrl + Shift + R (o Cmd + Shift + R en Mac)
- **En Móvil:** 
  - Abre Chrome → Menú (3 puntos) → Historial
  - "Borrar datos de navegación"
  - Marca "Imágenes y archivos en caché"
  - Click "Borrar datos"

### 4. Verificar que Funciona

1. Abre tu sitio en Railway: `https://tu-app.railway.app`
2. Deberías ver la página principal de MICAA
3. Verifica que el visor de noticias funcione

## Si Aún Está en Blanco

### Opción A: Revisar Logs de Railway

1. Ve a Railway Dashboard → Tu proyecto
2. Click en "Deployments"
3. Click en el último deploy
4. Revisa "Deploy Logs" - busca errores

### Opción B: Verificar Variables de Entorno

Asegúrate que en Railway estén configuradas:
- `DATABASE_URL` (tu Neon database)
- `NODE_ENV=production`
- `EXTERNAL_NEWS_DB_URL` (base de datos de noticias)

### Opción C: Force Restart

En Railway Dashboard:
- Settings → Restart

## Próximos Pasos

Una vez que funcione:
1. ✅ Re-habilitar service worker (opcional, para PWA completa)
2. ✅ Optimizar imágenes
3. ✅ Configurar dominio personalizado

## Comando de Verificación Local

Para probar el build localmente antes de deploy:

```bash
npm run build
npm run start
# Abre http://localhost:5000
```

Si funciona local pero no en Railway, es problema de variables de entorno o configuración del servidor.
