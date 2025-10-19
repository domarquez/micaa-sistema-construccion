# Cómo Actualizar la PWA de MICAA en tu Samsung A05

## Problema
La PWA instalada está mostrando la versión antigua en caché. Necesitas actualizar la app.

## Solución: Reinstalar la PWA

### Opción 1: Desinstalar y Reinstalar (Recomendado)

1. **Desinstalar la app antigua:**
   - En tu Samsung A05, mantén presionado el ícono de MICAA
   - Selecciona "Desinstalar" o arrastra al botón de desinstalar
   - Confirma la desinstalación

2. **Limpiar caché del navegador:**
   - Abre Chrome en tu celular
   - Ve a Configuración (3 puntos) → Privacidad y seguridad
   - Selecciona "Borrar datos de navegación"
   - Marca "Imágenes y archivos en caché"
   - Click en "Borrar datos"

3. **Reinstalar la PWA:**
   - Abre Chrome y ve a tu sitio web (micaa.store)
   - Espera a que cargue completamente
   - Toca el menú (3 puntos) → "Instalar aplicación" o "Añadir a pantalla de inicio"
   - Confirma la instalación

### Opción 2: Forzar Actualización (Más Rápido)

1. **Abrir la app instalada**
2. **Cerrar completamente la app:**
   - Presiona el botón de apps recientes (cuadrado)
   - Desliza MICAA hacia arriba para cerrarla
   
3. **Volver a abrir la app:**
   - La app debería actualizarse automáticamente

### Opción 3: Desde el Navegador

1. Abre Chrome en tu celular
2. Ve a `chrome://serviceworker-internals`
3. Busca "micaa" en la lista
4. Click en "Unregister" para limpiar el service worker
5. Recarga la página de tu app

## Verificar que funciona

Después de actualizar, deberías ver:
- ✅ La app se ajusta correctamente a la pantalla (sin cortes)
- ✅ El visor de noticias con puntos pequeños
- ✅ Todo el contenido visible sin scroll horizontal

## Notas

- La versión de caché cambió de `v1` a `v2`
- Los cambios de diseño están optimizados para Samsung A05
- Si aún tienes problemas, contacta al soporte
