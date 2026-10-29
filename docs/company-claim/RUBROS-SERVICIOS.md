# Rubros: materiales + servicios

Catálogo en dos niveles (`shared/company-trades.ts`):

1. **Proveedor de materiales** — ferretería, cemento, acero, etc. (existentes).
2. **Servicios** — arquitectura, constructoras, diseño, ingeniería, topografía, carpintería, cerrajería, CNC/router/láser, imprenta, ploteo, render/3D, instalaciones, alquiler maquinaria, transporte, mano de obra, otro (texto libre).

- Multi-select → `supplier_companies.categories` (+ `speciality` = primero).
- `custom_trades` para “Otro servicio”.
- Servicios con precio → tabla `company_service_prices` (migración 0012).
- Destacada cuenta material **o** servicio con precio.
- Filtros en `/empresas` con chips por grupo y rubro.

**Sin envíos WhatsApp.** No merge a main sin OK de Diego.
