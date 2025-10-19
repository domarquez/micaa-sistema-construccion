# Cómo Hacer el Deploy Corregido en Railway

## Problema Resuelto
✅ El CSS tenía reglas duplicadas que causaban pantalla en blanco en producción
✅ El build ahora funciona correctamente
✅ Listo para deployar a Railway

## Pasos para Deploy en Railway

### Opción 1: Deploy Automático desde GitHub (Recomendado)

1. **Hacer commit de los cambios:**
   ```bash
   git add .
   git commit -m "Fix: Corregido CSS duplicado y optimización móvil"
   git push origin main
   ```

2. **Railway automáticamente:**
   - Detectará el push
   - Ejecutará el build
   - Desplegará la nueva versión

3. **Esperar 2-3 minutos** hasta que termine el deploy

### Opción 2: Deploy Manual desde Railway Dashboard

1. Ve a tu proyecto en Railway.app
2. Click en "Deploy" → "Deploy Now"
3. Espera a que termine el build

### Opción 3: Trigger Deploy desde la Terminal

Si Railway CLI está instalado:
```bash
railway up
```

## Verificar que Funciona

Después del deploy:

1. **Limpia caché del navegador:**
   - Ctrl + Shift + R (Windows/Linux)
   - Cmd + Shift + R (Mac)
   - O desde DevTools

2. **Abre tu sitio en Railway:**
   - https://tu-app.railway.app
   - Deberías ver todo funcionando

3. **Verifica en móvil:**
   - Desinstala la PWA antigua
   - Abre el sitio en Chrome
   - Reinstala la PWA

## Cambios Incluidos en este Deploy

✅ CSS corregido (sin duplicados)
✅ Optimización para Samsung A05
✅ Visor de noticias con puntos pequeños
✅ Sin desbordamiento horizontal
✅ PWA actualizada (v2)
✅ Service Worker mejorado

## Si Aún Aparece en Blanco

1. **Revisa los logs de Railway:**
   - Ve a tu proyecto → Deployments
   - Click en el último deploy
   - Revisa "Build Logs" y "Deploy Logs"

2. **Verifica variables de entorno:**
   - `DATABASE_URL` debe estar configurada
   - `NODE_ENV=production`
   - `EXTERNAL_NEWS_DB_URL` (si aplica)

3. **Force restart:**
   - En Railway Dashboard → Settings → Restart

## Comandos Útiles

```bash
# Ver estado del build localmente
npm run build

# Iniciar en modo producción local
npm run start

# Limpiar y rebuildar
rm -rf dist node_modules
npm install
npm run build
```
