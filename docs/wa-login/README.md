# Login por WhatsApp (código de 6 dígitos) + dispositivos recordados

## Flujo
1. **Abrir WhatsApp (preferido, lo inicia el usuario):** la app abre `https://wa.me/59178732644?text=Quiero%20mi%20c%C3%B3digo%20MICAA`.
   Evolution (instancia `precios-ferreterias`) entrega el mensaje → `wa-boliviafuel-bridge` lo reenvía a
   `POST /api/webhooks/evolution?token=…` → MICAA responde al mismo número con el código.
2. **Enviarme el código (fallback):** `POST /api/auth/wa/request {phone}` → 3/número/hora, 10/IP/hora, cooldown 60 s.
   Si Evolution falla → `502 {code:"WA_SEND_FAILED"}`.
3. **Verificar:** `POST /api/auth/wa/verify {phone, code}` → código HMAC-SHA256, vence en 5 min, 5 intentos.
   Si el número no tiene cuenta se crea (nombre opcional después en Perfil).
   Emite JWT (mismo mecanismo, con `sid`) + cookie httpOnly `micaa_session` de **1 año, deslizante**.

Mensaje (único texto que se envía): `Tu código MICAA es 123456. Vence en 5 minutos. Si no lo pediste, ignóralo.`

## Dispositivos recordados
- Tabla `user_sessions`; la cookie guarda un token aleatorio, la DB solo su sha256.
- `sessionBridge` (en `/api`) convierte cookie válida → `Authorization: Bearer <jwt con sid>` para que **todos los
  handlers existentes** funcionen sin cambios, y quita el Bearer si la sesión (`sid`) fue revocada.
- Se renueva `expires_at` (+365 días) y la cookie como máximo una vez por hora de uso.
- Perfil → Seguridad → **Mis dispositivos**: cerrar sesión en un dispositivo, en este o en todos.
- El login con usuario/contraseña también crea un dispositivo recordado (si la tabla no existe aún, cae al JWT viejo de 24 h).

## Webhook: por qué pasa por el bridge
La instancia `precios-ferreterias` tiene **un solo webhook** y hoy apunta a
`https://wa-boliviafuel-bridge-production.up.railway.app/webhook` (gasolina). Cambiarlo rompería BoliviaFuel.
Opción recomendada: aplicar `wa-bridge-forward.patch` al bridge (proyecto Railway `evolution-whatsapp`), que reenvía
SOLO chats 1:1 con "Quiero mi código MICAA" a `MICAA_LOGIN_WEBHOOK_URL`. No cambia nada de la lógica de gasolina.

Alternativa (sin tocar el bridge): webhook global de Evolution (`WEBHOOK_GLOBAL_ENABLED=true`,
`WEBHOOK_GLOBAL_URL=…/api/webhooks/evolution?token=…`, evento `MESSAGES_UPSERT`). Afecta a todas las instancias y
reenvía todo el tráfico de grupos a MICAA; verificar antes que convive con el webhook por instancia.

## Pruebas
`npm run test:wa-auth` (Evolution mockeado, stores en memoria; no envía WhatsApps ni toca la DB).
