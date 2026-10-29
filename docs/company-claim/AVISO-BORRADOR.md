# Aviso WhatsApp a empresas (NO ENVIAR hasta que Diego diga «manda»)

**Desde:** número MICAA (Evolution instancia `micaa`, 59176105183)
**A:** teléfono del vendedor que ya cotizó (lista abajo)
**Cuándo:** solo después de que Diego escriba «manda» (aprobación explícita por empresa o lote).

## Texto propuesto

```
Hola, te escribimos de MICAA (micaa.site), el portal de materiales de construcción de Bolivia.

Registramos a *{EMPRESA}* en MICAA con los precios que ya nos compartiste, para que aparezcan en el portal.

Si querés administrar el perfil de tu empresa o cambiar los datos de contacto, respondé este mensaje con el número de WhatsApp de la persona responsable (dueño / marketing / quien gestione la cuenta).

Ese número lo vinculamos al perfil para que pueda editar los datos y los precios desde micaa.site.

Gracias.
— Equipo MICAA
```

Variables: `{EMPRESA}` = company_name.

## Flujo después del aviso
1. La empresa responde con un número (ej. 70012345 o +591 70012345).
2. El sistema lo detecta, lo deja en *pendiente de aprobación admin* (`pending_owner_phone`).
3. Diego (o admin) aprueba desde el panel → el número queda como contacto `owner` y puede reclamar/editar con OTP.
4. También se puede cargar/aprobar el número responsable directo desde el panel admin, sin pasar por WhatsApp.

## NO hacer
- No enviar este aviso automáticamente.
- No escribir a empresas desde scripts sin «manda».
- No sobrescribir teléfonos ni precios existentes.
