# MICAA - Deployment en Render

## 🚀 Comandos de Build para Render

### Opción 1: Script personalizado (RECOMENDADO)
```bash
Build Command: ./build.sh
Start Command: npm start
```

### Opción 2: Comando directo con devDependencies
```bash
Build Command: npm install --include=dev && npm run build
Start Command: npm start
```

## 📋 Configuración de Variables de Entorno

### Variables Requeridas:
```
DATABASE_URL=postgresql://...
NODE_ENV=production
```

### Variables Opcionales (SMTP):
```
SMTP_HOST=mail.micaa.store
SMTP_PORT=465
SMTP_USER=contacto@micaa.store  
SMTP_PASS=[tu-contraseña-smtp]
NOTIFICATION_EMAIL=contacto@micaa.store
```

### Variables de Seguridad:
```
JWT_SECRET=[tu-jwt-secret]
```

## ⚡ Troubleshooting

### Error: "vite: not found"
**Causa:** Render no instala devDependencies por defecto
**Solución:** Usar `npm install --include=dev` en build command

### Error: "esbuild: not found"  
**Causa:** esbuild está en devDependencies
**Solución:** Incluir `--include=dev` en npm install

### Error: Build timeout
**Causa:** Build tarda más de 15 minutos
**Solución:** Optimizar chunks o usar Render Pro

## 🛠️ Versiones de Node.js

Render usa Node.js 22.16.0 por defecto (compatible)
Para especificar versión: crear `.nvmrc` con version número

## 📊 Status del Build

✅ **Vulnerabilidades:** Resueltas (solo 4 moderadas restantes)  
✅ **Dependencias:** Todas compatibles  
✅ **Build local:** Funciona perfectamente  
✅ **Assets:** Optimizados (344KB gzipped)  

## 🚦 Health Check

Endpoint: `/health`
Respuesta: `{"status": "ok", "timestamp": "..."}`