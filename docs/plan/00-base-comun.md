# 00 · Módulo: Base común (productos, plantas y equipos)

Panel interno Plastifar · Plan de construcción · Ampliación v0.1 · 11 de octubre de 2026

**Responsable:** Por asignar  ·  **Prioridad:** primera entrega, bloquea a 03, 04, 05 y 06  ·  **Tablas nuevas:** `Product`, `Plant`, `Team`, `TeamMember`

Marcas usadas: **[Fuente]**, **[Propuesta]**, **[Abierta]**. Ver [README](README.md), sección 2.

## 1. Situación y objetivo

Tres de los cuatro formularios entregados piden identificar productos por código y descripción, y dos piden
indicar la planta. El sistema hoy solo conoce la línea de producto, un concepto que viene del plan original y
que no aparece en ninguna de las hojas de cálculo; si es algo distinto de la planta está por confirmar (sección
16, pregunta 3). Además, el plan
de permisos y la hoja de formularios hablan de «equipos» a los que se asignan tareas, y el sistema no tiene ese
concepto.

Este módulo crea los tres catálogos que los demás documentos dan por existentes. Es pequeño en pantallas, pero
si se construye dentro de uno de los formularios los otros quedan dependiendo de un módulo ajeno, y si cada
formulario crea el suyo el catálogo se duplica y se contradice.

## 2. Alcance

**Incluye**

- Catálogo de productos: código, descripción, línea de producto y planta.
- Catálogo de plantas, con país y administrador.
- Equipos de trabajo y sus integrantes.
- Administración de los tres desde Configuración y carga inicial de productos por archivo.

**No incluye**

- Costo unitario, precio de lista e inventario del producto (ver sección 16, pregunta 4).
- Sincronización automática con el sistema de gestión de Plastifar.
- La asignación de tareas a equipos; se especifica en el documento 02.

## 3. Dependencias

Ninguna. Usa `Staff` y `ProductLine`, que ya existen.

## 4. Fuente y trazabilidad

| Requisito | Archivo | Hoja y celdas |
|---|---|---|
| Producto con código y descripción | PF-FOR-034 | ` Español`: `Producto/s:` (A20, líneas B20:E22) y `Código/s:` (F20, líneas G20:I22) |
| | PF-FOR-068 | `FR-Retiro de Mercancia`: columnas `CODIGO` (A12) y `DESCRICION` (D12) |
| | PF-FOR-291 | `PF-FOR-291`: columnas `Codigo` y `Descripcion del Producto` (fila 6) |
| | PF-FOR-109 | `HCA`: `Producto:` (G2) |
| Planta | PF-FOR-034 | ` Español`: grupo `Planta Involucrada : ` (A10, opciones en A11:D15) |
| | PF-FOR-109 | `HCA`: `Planta:` (G3) |
| Lista de plantas | PLAN-SLA-PERMISOS | `PLANTAS`: A1:D17 y nota en D20 |
| Equipos | PLAN-SLA-PERMISOS | `PLANTAS`: nota D20; `PERMISOS`: filas 2 y 15; `FORMULARIOS`: filas 5 y 7 |

## 5. Lo que ya existe

| Pieza | Dónde | Estado |
|---|---|---|
| Línea de producto (`Code`, `Name`, `IsActive`) | Backend `api/Models/Settings.cs:99-110` y `api/Controllers/Settings/ProductLinesController.cs` (ruta `api/settings/product-lines`, :18); frontend `src/api/productLines.ts`, `src/pages/settings/ProductLinesSection.tsx`, `ProductLineModal.tsx`, servida en la ruta `/calidad/lineas` (`src/App.tsx:138`) | Construido. Es el patrón a seguir |
| Piezas comunes de las secciones de catálogo (aviso de error con reintento, aviso ámbar, grupo de pastillas) | `src/pages/settings/catalogSection.tsx` | Construido |
| Responsable de departamento | `api/Models/Department.cs:25` (`ManagerStaffId`) | El campo existe en el modelo, pero ningún endpoint lo lee ni lo escribe: `DepartmentResponse` y `SaveDepartmentRequest` no lo incluyen (`api/Dtos/DepartmentDtos.cs:11`, :21). Sirve como referencia de modelo para el administrador de planta, no como patrón de pantalla |
| Producto | Backend `api/Models/Product.cs`, `api/Controllers/Settings/ProductsController.cs` (ruta `api/settings/products`) y `api/Services/ProductCsv.cs` (lectura del archivo de carga); frontend `src/pages/settings/ProductsSection.tsx`, `ProductModal.tsx`, `ProductImportModal.tsx` y el selector `src/components/app/ProductLookupField.tsx`, servidos en `/configuracion/productos` | Construido con este documento. El selector aún no tiene consumidor: lo usarán los formularios de 03 a 06 |
| Planta | Backend `api/Models/Plant.cs` y `api/Controllers/Settings/PlantsController.cs` (ruta `api/settings/plants`); frontend `src/pages/settings/PlantsSection.tsx` y `PlantModal.tsx`, en `/configuracion/plantas` | Construido con este documento. Las 16 plantas de la sección 7.1 están cargadas, sin administrador |
| Equipo e integrantes | Backend `api/Models/Team.cs`, `api/Controllers/Settings/TeamsController.cs` (ruta `api/settings/teams`) y `api/Services/TeamAssignment.cs` (regla 5); frontend `src/pages/settings/TeamsSection.tsx` y `TeamModal.tsx`, en `/configuracion/equipos` | Construido con este documento. Los 12 equipos de la sección 7.2 están cargados, sin integrantes |
| Carga inicial de plantas y equipos | `api/Data/OrganizationSeeder.cs`, que se ejecuta con `dotnet run -- --seed-organization --actor <correo de un administrador>` | Construido. Puede repetirse: no duplica ni sobrescribe lo existente |

## 6. Modelo de datos

Todo el modelo de esta sección es **[Propuesta]**. Sigue las convenciones de la sección 2.2 del plan original:
identificador entero autoincremental, fechas en UTC y baja lógica mediante `IsActive`.

**Product** — artículo que se vende, se reclama o se retira.

| Campo | Tipo | Regla |
|---|---|---|
| `Id` | int | Identidad |
| `Code` | string(20) | Obligatorio, único. Se guarda como texto aunque sea numérico |
| `Name` | string(200) | Descripción del producto, obligatoria |
| `ProductLineId` | int? | Referencia a `ProductLine`. Se mantiene solo porque el catálogo ya existe en el código; si subsiste depende de la pregunta 3 |
| `PlantId` | int? | Planta que lo fabrica, si se conoce |
| `IsActive` | bool | Baja lógica; por defecto verdadero |
| `CreatedAt`, `UpdatedAt` | timestamptz | UTC |

**[Abierta]** Que el producto lleve a la vez línea de producto y planta no es una decisión tomada. Los datos
reales solo muestran plantas; la línea de producto procede del plan original. Los dos campos se dejan opcionales
como supuesto provisional de trabajo, para que cualquiera de las respuestas a la pregunta 3 sea un cambio de
datos y no de esquema.

**Plant** — planta de producción.

| Campo | Tipo | Regla |
|---|---|---|
| `Id` | int | Identidad |
| `Name` | string(80) | Obligatorio; único dentro del mismo país |
| `Country` | enum | `RD` · `Guatemala`; se guarda como texto |
| `ManagerStaffId` | int? | Administrador de la planta; debe ser personal activo |
| `IsActive` | bool | Baja lógica |
| `CreatedAt`, `UpdatedAt` | timestamptz | UTC |

**Team** — grupo de personas al que puede asignarse trabajo.

| Campo | Tipo | Regla |
|---|---|---|
| `Id` | int | Identidad |
| `Name` | string(80) | Obligatorio, único |
| `PlantId` | int? | Planta a la que pertenece, cuando el equipo es de planta |
| `IsActive` | bool | Baja lógica |
| `CreatedAt`, `UpdatedAt` | timestamptz | UTC |

**TeamMember** — tabla puente: `TeamId`, `StaffId`, `CreatedAt`. Clave única `(TeamId, StaffId)`.

**Índices obligatorios:** `Product.Code` único; `Product.Name` para búsqueda; `Product.ProductLineId`;
`Product.PlantId`; `(Plant.Country, Plant.Name)` único; `Plant.ManagerStaffId`; `Team.Name` único;
`Team.PlantId`; `TeamMember.StaffId`.

## 7. Catálogos y datos semilla

### 7.1 Plantas **[Fuente]**

Hoja `PLANTAS`, A2:B17. La cabecera de la columna A es `PLANTAS ` (con un espacio final). Los nombres se
transcriben tal como están.

| # | Planta | País |
|---|---|---|
| 1 | PLANTA CUBIERTOS | RD |
| 2 | PLANTA ENVASES CLEAR | RD |
| 3 | PLANTA ENVASES PAPEL | RD |
| 4 | PLANTA ENVASES RIGIDOS | RD |
| 5 | PLANTA PET/PP | RD |
| 6 | PLANTA SOPLADO PF | RD |
| 7 | PLANTA TERMOFORMADOS FOAM | RD |
| 8 | PLANTA TERMOFORMADOS PULPA | RD |
| 9 | PLANTA TERMOFORMADOS BIOBASED | RD |
| 10 | PLANTA VASOS FOAM | RD |
| 11 | PLANTA CALIMETE | RD |
| 12 | VASOS FOAM | GUATEMALA |
| 13 | LAMINADO FOAM | GUATEMALA |
| 14 | PET | GUATEMALA |
| 15 | PAJILLA | GUATEMALA |
| 16 | TERMOFORMADO FOAM | GUATEMALA |

Observaciones sobre la fuente:

- Las 11 plantas de RD tienen administrador (columna C) y agentes (columna D). Las 5 de Guatemala tienen ambas
  columnas vacías. Los nombres de persona no se copian a este documento; se resuelven contra `Staff` cuando los
  agentes estén cargados (documento 01).
- Las plantas de Guatemala no llevan el prefijo «PLANTA». `VASOS FOAM` (Guatemala) y `PLANTA VASOS FOAM` (RD)
  solo se distinguen por el prefijo y el país; por eso la unicidad propuesta es por país y nombre.
- Nota en D20, con relleno amarillo: **«NOTA: ESTAN REGISTRADAS COMO EQUIPO SOLO LAS DE RD»**.

### 7.2 Equipos

- **[Fuente]** La nota de D20 indica que las plantas de RD están registradas como equipo.
- **[Fuente]** La hoja `FORMULARIOS` nombra dos grupos que no están definidos en ninguna hoja: `EQUIPOS DE
  PLANTAS` (fila 5) y `EQUIPO DE CONTROL DE INVENTARIO` (fila 7).
- **[Propuesta]** Se crea un equipo por cada planta de RD, con el nombre de la planta y los agentes de la columna
  D como integrantes; y un equipo `EQUIPO DE CONTROL DE INVENTARIO` con los cuatro agentes que la fila 7 de
  `FORMULARIOS` nombra en su columna `AGENTE`. Lo construido crea los doce equipos, cada uno enlazado a su
  planta de RD, pero **vacíos**: los integrantes son personal y el personal aún no está cargado (documento 01).
  Se agregan desde la pantalla de equipos cuando existan.

### 7.3 Opciones de planta del PF-FOR-034 frente a la hoja `PLANTAS`

El formulario de reclamación ofrece nueve casillas bajo `Planta Involucrada : `. No coinciden una a una con la
hoja `PLANTAS`. La correspondencia de la tercera columna es **[Propuesta]**.

| Opción del formulario **[Fuente]** | Planta candidata en `PLANTAS` | Observación |
|---|---|---|
| `Calimete` | PLANTA CALIMETE | Coincide |
| `Clear` | PLANTA ENVASES CLEAR | Coincide |
| `Cubiertos` | PLANTA CUBIERTOS | Coincide |
| `PP` | PLANTA PET/PP | Coincidencia parcial |
| `Termoformado Foam` | PLANTA TERMOFORMADOS FOAM | Singular en el formulario, plural en la lista |
| `Vasos Foam` | PLANTA VASOS FOAM | Coincide |
| `Rígido` | PLANTA ENVASES RIGIDOS | Coincide |
| `PVC` | — | Sin planta equivalente en la lista |
| `Pulpa` | PLANTA TERMOFORMADOS PULPA | Coincide |
| — | PLANTA ENVASES PAPEL | No aparece en el formulario |
| — | PLANTA SOPLADO PF | No aparece en el formulario |
| — | PLANTA TERMOFORMADOS BIOBASED | No aparece en el formulario |

El formulario es de octubre de 2024 (revisión 03) y la hoja `PLANTAS` es de 2026; es probable que el formulario
esté desactualizado. Ver sección 16, pregunta 1.

### 7.4 Productos

El insumo no trae un maestro de productos. Solo muestra su forma: los códigos observados en los formularios son
numéricos de cinco dígitos. Los productos que aparecen en el ejemplo lleno del PF-FOR-068 y en las hojas ocultas
del PF-FOR-291 no se usan como semilla (ver README, sección 7).

## 8. Lógica de negocio

Toda esta sección es **[Propuesta]**.

1. Un producto en uso en cualquier formulario no se elimina, se desactiva. El borrado físico se permite solo si
   no tiene ninguna línea asociada; en caso contrario se responde 409 explicándolo. Es el comportamiento que ya
   tienen las líneas de producto (`ProductLinesController.cs:190-219`).
2. Un producto desactivado no puede elegirse en formularios nuevos, pero los formularios históricos conservan su
   código y descripción.
3. Cada línea de formulario guarda una copia del código y la descripción en el momento de registrarla. Cambiar
   después la descripción del producto no altera lo ya registrado.
4. El administrador de una planta y los integrantes de un equipo deben ser personal activo en el momento de
   asignarlos. Si esa persona se desactiva después, no se la retira: sigue figurando como administrador de la
   planta y como integrante del equipo, señalada como inactiva, hasta que alguien la sustituya; una planta o
   un equipo cuya referencia quedó inactiva puede seguir editándose sin tener que cambiarla. Para localizarlos,
   el listado de plantas tiene el filtro «Sin administrador activo» y el de equipos «Sin integrantes activos»,
   cada uno con su contador.
   Eliminar a la persona es distinto de desactivarla: mientras administre una planta o integre un equipo, la
   eliminación se rechaza con 409, igual que ocurre con el responsable de un departamento, para que un dato
   del organigrama no se vacíe en silencio.
5. Un equipo sin integrantes activos no puede recibir asignaciones.
6. La carga por archivo no borra: crea los códigos que no existen y actualiza la descripción de los que sí;
   de un producto existente no toca la línea, la planta ni el estado. Informa cuántas filas creó, cuántas
   actualizó, cuántas dejó sin cambio y cuáles rechazó, con la línea y el motivo de cada rechazo (la respuesta
   lista como máximo las 100 primeras y da el total real). Un código repetido dentro del mismo archivo se
   rechaza a partir de su segunda aparición: vale la primera fila. Las líneas en blanco se saltan. Un archivo
   con más de 50 000 filas de datos, o con unas comillas que no se cierran en la misma línea en que se abren,
   se rechaza entero sin guardar nada. Todo lo aceptado entra en una sola operación, con una única entrada de
   bitácora que resume la carga.

## 9. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-B1 | Listado paginado de productos con búsqueda por código y descripción, filtros por línea de producto, planta y estado, y contadores por pastilla |
| RF-B2 | Alta, edición, activación y desactivación de producto en diálogo, con validación en ambos lados |
| RF-B3 | Carga de productos por archivo CSV, con informe de filas creadas, actualizadas, sin cambio y rechazadas |
| RF-B4 | Selector de producto reutilizable, con búsqueda en servidor por código o descripción, para los formularios de 03, 04, 05 y 06 |
| RF-B5 | Administración de plantas: listar, crear, editar, asignar administrador, activar y desactivar |
| RF-B6 | Administración de equipos y de sus integrantes |
| RF-B7 | Cada cambio de catálogo queda en la bitácora con actor y valores anterior y nuevo |
| RF-B8 | El sistema impide eliminar un producto, una planta o un equipo en uso y explica por qué |

## 10. Endpoints

Bajo `/api/settings/…`, igual que los catálogos de líneas de producto, políticas de SLA, días no laborables,
plantillas y buzones (sección 8.4 del plan original; los motivos, los veredictos y los territorios viven hoy
fuera de ese prefijo, en `/api/ticket-topics`, `/api/ticket-verdicts` y `/api/territories`). Los listados
responden con el formato paginado de la sección 12.1, como ya hace `ProductLinesController.cs:25-72`. La lectura
sin atributo de permiso queda cubierta por la política de respaldo, que exige sesión iniciada
(`api/Program.cs:252-253`).

| Método y ruta | Descripción | Permiso |
|---|---|---|
| `GET /api/settings/products` | Listado paginado con búsqueda, filtros `productLineId`, `plantId` y `status`, orden y contadores | Autenticado |
| `GET /api/settings/products/lookup` | Búsqueda acotada para el selector (máximo 20 resultados, solo activos) | Autenticado |
| `POST /api/settings/products` · `PUT /api/settings/products/{id}` | Alta y edición. La baja lógica y la reactivación van por el `PUT`, con `isActive`; no hay ruta aparte para desactivar | `settings.write` |
| `POST /api/settings/products/import` | Carga por archivo (regla 6) | `settings.write` |
| `DELETE /api/settings/products/{id}` | Borrado físico, solo si nada lo usa; en caso contrario 409 con el motivo | `settings.write` |
| `GET /api/settings/plants` | Listado paginado; parámetros `country`, `status` y `manager=sin-activo` (plantas sin administrador activo) | Autenticado |
| `POST /api/settings/plants` · `PUT /api/settings/plants/{id}` | Alta y edición; la baja lógica va por el `PUT`, con `isActive` | `settings.write` |
| `DELETE /api/settings/plants/{id}` | Borrado físico, solo si ningún equipo ni producto la referencia; en caso contrario 409 | `settings.write` |
| `GET /api/settings/teams` | Listado paginado con número de integrantes; parámetros `status` y `members=sin-activos` (equipos sin integrantes activos) | Autenticado |
| `POST /api/settings/teams` · `PUT /api/settings/teams/{id}` | Alta y edición; la baja lógica va por el `PUT`, con `isActive` | `settings.write` |
| `DELETE /api/settings/teams/{id}` | Borrado físico, solo si no tiene integrantes; en caso contrario 409 | `settings.write` |
| `GET · POST /api/settings/teams/{id}/members` | Listar integrantes y agregar uno | Autenticado / `settings.write` |
| `DELETE /api/settings/teams/{id}/members/{staffId}` | Quitar a un integrante | `settings.write` |

## 11. Pantallas

- Tres secciones nuevas: **Productos**, **Plantas** y **Equipos**, construidas con las piezas de
  `catalogSection.tsx` y con la estructura estándar de listado (sección 5.2 del plan original). Configuración no
  es una pantalla con pestañas: cada sección tiene su propia ruta en `src/App.tsx` (:126-130) y su entrada en el
  árbol de navegación `SIDEBAR_NAV` (`src/lib/navigation.ts:92`). **[Propuesta]** rutas
  `/configuracion/productos`, `/configuracion/plantas` y `/configuracion/equipos`. Las líneas de producto se
  mudaron de Configuración a `/calidad/lineas` (`src/App.tsx:132-138`); si productos y plantas deben seguirlas
  al grupo de Calidad se decide en la revisión cruzada.
- Productos: columnas código, descripción, línea de producto, planta y estado. Acción secundaria «Cargar
  archivo», que abre un diálogo con el resultado de la carga.
- Plantas: nombre, país, administrador y estado.
- Equipos: nombre, planta, número de integrantes y estado; los integrantes se gestionan en el diálogo de edición.
- Componentes: `ModuleHeader`, `SearchInput`, `FilterChip`, `DataTable`, `Pagination`, `Modal`, `ConfirmDialog`,
  `Field`, `Select`, `LookupSelect` y `RowAction`. No se crea ninguna variante nueva.

## 12. Permisos

- Lectura abierta a todo el personal autenticado, igual que el resto de los catálogos.
- Escritura con `settings.write`, que ya existe (`api/Security/PermissionCatalog.cs:44`). No se añaden claves.

## 13. Validación

Reglas espejo entre el esquema de Zod y el servidor; cada lado indica en un comentario dónde está el otro.

| Campo | Regla |
|---|---|
| `Product.Code` | Obligatorio, de 1 a 20 caracteres, sin espacios al inicio ni al final; único. El duplicado se marca en el campo y responde 409 |
| `Product.Name` | Obligatorio, de 2 a 200 caracteres |
| `Plant.Name` | Obligatorio, de 2 a 80 caracteres; único dentro del país |
| `Plant.Country` | Obligatorio; uno de los valores del catálogo |
| `Team.Name` | Obligatorio, de 2 a 80 caracteres; único |
| Archivo de carga | CSV en UTF-8 (con o sin BOM), máximo 5 MB y 50 000 filas de datos. Primera fila de cabecera con las columnas `Code` y `Name`; también se aceptan `Código` y `Descripción` o `Nombre`, sin distinguir mayúsculas ni tildes. El separador, coma o punto y coma, se deduce de la cabecera. Las demás columnas se ignoran. Un campo entre comillas debe cerrarse en la misma línea |

## 14. Criterios de aceptación

- [ ] El listado de productos responde en menos de 300 ms con 10 000 productos de prueba. **No medido:** lo
      comprobado es que, con 10 000 productos, el listado pagina en la base y no carga la tabla.
- [ ] El selector de producto encuentra un artículo por código parcial y por parte de la descripción.
- [ ] Intentar eliminar un producto usado en un formulario devuelve 409 con el mensaje correcto. **No puede
      probarse todavía:** ningún formulario referencia productos hasta que existan los de 03, 04 y 06; hoy todo
      producto se considera sin uso.
- [ ] Cargar dos veces el mismo archivo no duplica productos: la segunda carga informa cero creados.
- [ ] Las 16 plantas de la sección 7.1 quedan cargadas con su país.
- [ ] Un usuario sin `settings.write` no ve las acciones de alta ni de edición y recibe 403 por API directa.
- [ ] Cumple la lista de verificación de cierre de la sección 4.5 del plan original.

## 15. Riesgos

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| No hay maestro de productos en el insumo | Los formularios 03, 04 y 06 no pueden probarse con datos reales | Pedir el maestro antes de empezar 03; mientras tanto, datos de prueba |
| Las plantas del formulario y las de la lista no coinciden | Reclamaciones marcadas con una planta equivocada | Resolver la pregunta 1 antes de construir 03 |
| Los administradores y agentes de planta se referencian por nombre | No se pueden enlazar hasta que los agentes estén cargados | Cargar plantas sin administrador y completarlo después de 01 |
| Línea de producto y planta pueden ser el mismo concepto | Se mantienen dos catálogos para una sola clasificación, o se retira uno que la operación sí usa | Resolver la pregunta 3 antes de exigir cualquiera de los dos campos en un formulario; mientras tanto, ambos opcionales |

## 16. Preguntas abiertas para Plastifar

| # | Pregunta | Opciones | Se asume mientras tanto |
|---|---|---|---|
| 1 | ¿Las nueve opciones de «Planta Involucrada» del PF-FOR-034 deben sustituirse por las plantas de la hoja `PLANTAS`? ¿A qué planta corresponde «PVC»? | (a) usar la lista de `PLANTAS`; (b) conservar las nueve del formulario; (c) lista nueva que entregue Plastifar | (a), con la correspondencia de la sección 7.3 y «PVC» sin planta |
| 2 | ¿De dónde sale el maestro de productos y quién lo mantiene? | (a) exportación periódica del sistema de gestión; (b) mantenimiento manual en el panel | Carga inicial por archivo y mantenimiento manual |
| 3 | ¿La línea de producto es un concepto distinto de la planta, o la operación solo clasifica por planta? Los datos reales (hoja `PLANTAS`, PF-FOR-034 y PF-FOR-109) solo muestran plantas. La línea de producto viene del plan original, que cita como ejemplos «Bio, Rígido, Flexible»: «Flexible» no aparece en ninguna hoja de cálculo, y los otros dos coinciden con las plantas «BIOBASED» y «ENVASES RIGIDOS» | (a) son conceptos distintos y ambos se usan; (b) la línea se deduce de la planta; (c) solo existe la planta y el catálogo de líneas de producto se retira o se sustituye por ella | **Ninguno como decisión.** Supuesto provisional de trabajo: el modelo conserva `ProductLine`, que ya está construido, y añade la planta, ambos opcionales; ningún formulario nuevo exige la línea de producto hasta tener la respuesta |
| 4 | ¿El sistema debe conocer el costo unitario del producto? Las hojas ocultas del PF-FOR-291 valoran las discrepancias por costo | (a) sí, como dato del producto; (b) no, el monto se escribe a mano | (b) |
| 5 | ¿Las plantas de Guatemala deben tener administrador y equipo? | (a) sí, con datos por entregar; (b) no por ahora | (b): se cargan sin administrador ni equipo |
| 6 | ¿Un equipo puede existir sin pertenecer a una planta? «EQUIPO DE CONTROL DE INVENTARIO» no parece ser de planta | (a) sí; (b) no | (a) |
