# 02 — Modelo de negocio

## Posicionamiento

Child Care Passport no compite con los sistemas de gestión de guarderías; se coloca **antes y por encima** de ellos: es la capa de identidad y consentimiento del niño que cualquier institución puede consumir. El activo es la relación con la familia y la portabilidad del perfil.

## Segmentos

| Segmento                                           | Dolor                                                                                                                 | Valor                                                                                                        | Disposición a pagar                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Familias (B2C)                                     | Repetir información; ansiedad al dejar al hijo con terceros; cero visibilidad.                                        | Perfil único, Care Pass para niñeras, registro de accesos.                                                   | Baja/media (freemium).                        |
| Guarderías, kínderes, academias, campamentos (B2B) | Formularios en papel, información desactualizada, riesgo por alergias, sin evidencia de consentimiento ni de lectura. | Perfiles mantenidos por la familia, alertas críticas, confirmaciones de lectura, consentimiento verificable. | Media/alta (SaaS por niño activo o por sede). |
| Plataformas existentes (B2B2B, V2)                 | Onboarding de familias costoso.                                                                                       | API/adaptadores para importar perfiles con consentimiento.                                                   | Licencia / revenue share.                     |

## Monetización propuesta (no implementada en el MVP)

- **Familias — Free**: 1–2 hijos, Care Shares ilimitados con expiración, historial de 90 días.
- **Familias — Plus**: documentos ilimitados, historial completo, exportación, Emergency Share, multi-guardian avanzado.
- **Instituciones — Starter/Pro**: por niño activo/mes. Incluye portal, alertas, confirmaciones de lectura, auditoría exportable. Pro añade grupos, varios sedes, API.
- **Enterprise / integraciones**: adaptadores (Famly, Brightwheel…), SSO, SLA, residencia de datos.

## Go-to-market

1. **Institución primero, familia después**: una institución activa arrastra a 20–100 familias con un código de invitación (ya implementado: `Institution.inviteCode`).
2. **Viral loop familiar**: cada Care Pass que recibe una niñera/abuelo expone el producto sin fricción de registro.
3. México como mercado inicial (LFPDPPP como marco), arquitectura global desde el día uno.

## Métricas norte

Ver eventos de producto en [01-product-vision](01-product-vision.md#métricas-de-producto-eventos-preparados). North star: **niños con perfil activo compartido con al menos una institución**.

## Riesgos de negocio

- Instituciones que prefieran "su" expediente: mitigado con propuestas de cambio (ellas contribuyen sin perder a la familia como dueña).
- Confianza en privacidad: mitigado con Permission Preview, auditoría visible y minimización por defecto.
- Regulación por país: mitigado con `regulatoryRegion` y políticas de retención por región (V1).
