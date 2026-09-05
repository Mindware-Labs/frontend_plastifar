# Panel interno Plastifar — frontend

Interfaz del panel interno de operaciones de Plastifar, S. A. React 19 + Vite +
TypeScript + Tailwind CSS 4. El backend vive en `backend_plastifar`.

El contrato del sistema es `Plan-de-construccion-Plastifar.pdf` (v1.0). El
lenguaje visual está documentado en `DESIGN.md` y el contexto de producto en
`PRODUCT.md`; los dos son vinculantes, no orientativos.

## Arranque

```bash
npm install
cp .env.example .env   # y ajusta los valores
npm run dev
```

## Variables de entorno

| Variable | Obligatoria | Qué hace |
| --- | --- | --- |
| `VITE_API_URL` | Sí | URL base del API. Sin ella no hay backend con quien hablar. |
| `VITE_AUTH_BYPASS` | No | `true` entra al panel sin credenciales. |

Sobre `VITE_AUTH_BYPASS`: solo tiene efecto con el servidor de desarrollo
(`import.meta.env.DEV`), así que una compilación de producción la ignora aunque
esté declarada. Existe porque antes el guard de sesión estaba **comentado** en
`src/components/RouteGuards.tsx` con una nota de "descomentar antes de
desplegar" al lado — que es justo la nota que nadie lee el día que se despliega.
Déjala apagada salvo que no tengas usuario de prueba contra el backend.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Compilación de producción (`tsc` + `vite build`) |
| `npm run lint` | Oxlint sobre `src/` |
| `npx tsc --noEmit` | Solo verificación de tipos |

## Estructura

```
src/
  api/          Un módulo por familia de endpoints. Los tipos espejan los DTO de C#.
  components/
    ui/         El kit compartido. Se reutiliza tal cual; una variante nueva es
                decisión de equipo, no individual.
    app/        Chrome de la aplicación: Sidebar, TopBar, Breadcrumb, ModuleHeader.
    auth/       Controles propios del área de acceso.
  pages/        Una carpeta por módulo del plan.
  hooks/        usePagedList, useLocalPage, usePermissions, useDebouncedValue.
  lib/          Reglas puras: permisos, SLA, calidad, CSV, plantillas.
```

## Reglas que no se negocian

Están completas en la sección 4 del plan. Las que más se rompen:

- **La paginación es del servidor, siempre.** Nunca se trae la tabla entera para
  paginar en el navegador. El contrato es `{ items, page, pageSize, total,
  totalPages, counts }`.
- **Toda validación del formulario existe también en el endpoint**, con el mismo
  criterio, y cada lado apunta en un comentario dónde está el otro.
- **El error aparece en su campo**, redactado para la operación y no para quien
  programa. Si ocurre dentro de un diálogo, se muestra dentro y no se cierra.
- **Nada de `alert()`, `confirm()` ni `prompt()`.** El panel tiene `ConfirmDialog`.
- **Se reutilizan los componentes de `components/ui`** sin inventar variantes.
- **Sin secretos en el repositorio.** Van en `.env`, que no se sube.

## Estado

Entregados: Autenticación y Personal, Permisos efectivos, Clientes, Catálogos y
configuración, Calidad (HCA y créditos).

Reportes va por 8 de 31: los 23 restantes agregan sobre la tabla `Ticket`, que
todavía no existe. La Bandeja de tickets es el módulo pendiente y bloquea también
la validación de tickets asociados al eliminar un cliente (RF-C4), el historial
de tickets de la ficha de cliente (RF-C5) y los vínculos de HCA y crédito con su
ticket de origen.
