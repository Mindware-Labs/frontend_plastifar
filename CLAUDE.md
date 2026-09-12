# Plastifar — Panel de Operaciones

Panel interno. **La mesa es la página**: estructura de filetes (hairlines), un solo rojo,
y nada decorativo que no cumpla una función. Antes de escribir UI, seguí este documento.

## ⚠️ Regla de oro

Este proyecto YA tiene un sistema de diseño completo y con criterio. **No inventes estilos
ni uses defaults genéricos de Tailwind** (nada de `bg-blue-600`, `text-gray-500`,
`rounded-lg`, `shadow-md`, grises/azules de fábrica). Todo sale de los tokens y primitivos
de abajo. Si dudás de un color, espaciado o tipografía → está en `DESIGN.md` o `src/index.css`.

**Fuentes de verdad (leer antes de diseñar):**
- **`DESIGN.md`** — la ley de diseño (norte creativo, roles de color, reglas nombradas, tipografía, densidad).
- **`src/index.css`** — los tokens reales (`@theme`), que definen las clases de Tailwind v4.

## Componé desde los primitivos, no desde cero

- **Usá `src/components/ui/*`** para toda UI de app: `Button`, `DataTable`, `Modal`, `Drawer`,
  `Badge`, `Field`, `Select`, `SearchInput`, `Pagination`, `StatusDot`, `Alert`, `Tooltip`, etc.
  Antes de escribir markup nuevo, revisá si ya existe el primitivo.
- **`src/components/shadcn/*` es plomería interna** (base de los primitivos). NO la consumas
  directo en pantallas: siempre pasá por `src/components/ui/*`. Un `<button>` crudo o un
  `shadcn/button` en una página es un error.
- **Pantalla de referencia:** imitá `src/pages/clients/ClientsPage.tsx` para módulos de
  lista/tabla — densidad, filetes, chips de filtro y convenciones de tabla ya resueltos ahí.

## Tokens reales (clases Tailwind v4)

Usá SIEMPRE estos, nunca los colores por defecto de Tailwind:

**Marca (solo como señal, nunca decoración):**
- `brand-red` (#e4002b) — acción primaria, estado activo, foco, requerido. **Una sola vez por rol y por pantalla.**
- `brand-red-dark` — texto rojo sobre blanco (errores, badge admin). El rojo de marca es color de *relleno*, no de texto.
- `brand-green` — salud/válido/confirmado. `warn` (#9a5c04) — estados intermedios ("sin asignar", pendiente, sin guardar).

**Neutros (jerarquía por peso y valor, no por cajas):**
- Texto: `ink` (títulos/valores) · `brand-gray` (cuerpo/celdas) · `subtle` (soporte) · `faint` (heads/labels/hints — piso legible).
  ⚠️ Es `text-subtle`, **NO** `text-muted` (`muted` es superficie de shadcn, otro concepto).
- Superficies: `canvas` (#f5f5f6, reposo/hover de fila) · `fill` (wash de icon-buttons) · blanco (superficie de trabajo).
- Filetes (3 pasos): `line` (borde estructural) · `line-soft` (entre filas) · `line-strong` (rodea un control).

**Radio, sombra, tipografía:**
- `rounded-edge` (2px) en todo control. `rounded-pill` solo para lo redondo (avatar, punto de estado, chip).
- Sombra SOLO para lo que flota: `shadow-panel`, `shadow-dialog`, `shadow-bloom`. Nada que scrollee lleva sombra.
- `font-heading` (Montserrat) nombra cosas (títulos, labels, botones, column heads). `font-body` (Poppins) dice frases.

## Reglas nombradas (de DESIGN.md — respetalas)

- **The One Red Rule** — el rojo marca la acción primaria y el estado activo, nada más. Dos rojos con dos significados = uno está mal.
- **The Amber Middle Rule** — ámbar es solo "todavía no" (pendiente/sin asignar/sin guardar). Nunca error (eso es rojo) ni éxito (verde).
- **The Contrast Floor Rule** — ningún texto bajo 4.5:1. No aclares `subtle`/`faint`/`warn` por estética, ni metas un cuarto gris.
- **The Two Voices Rule** — Montserrat nombra, Poppins dice. Sin una tercera familia.
- **The Small-Caps Head Rule** — todo column head: `font-heading` 600, 10px, tracking 0.08em, color `faint`. No varía por módulo.

**Sin tarjetas.** No hay cards, paneles anidados ni contenedores tintados para "señalar sección".
La única excepción declarada es `src/pages/dashboard` (usa `rounded-card`/`rounded-inset`);
fuera de ahí, esos radios son una fuga, no una decisión.

## Movimiento y accesibilidad

- Animaciones cortas y funcionales, **todas** apagadas bajo `prefers-reduced-motion` (ya está en `index.css`).
- Foco visible con anillo `brand-red` a baja alfa. Estados completos: hover, focus-visible, disabled, loading, vacío.

## Flujo de trabajo

- Stack: React 19 + Vite 8 + TypeScript + Tailwind v4 + shadcn/Radix. Scripts: `dev`, `build`, `lint`, `preview`.
- Al crear una pantalla nueva: (1) leé `DESIGN.md`, (2) tomá `ClientsPage.tsx` como patrón,
  (3) componé desde `ui/*`, (4) corré la app y verificá densidad/estados antes de darla por hecha.
- No agregues dependencias de UI nuevas (no MUI, no Chakra): el sistema ya está resuelto acá.
