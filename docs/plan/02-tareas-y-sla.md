# 02 · Módulo: Tareas y SLA por tarea

Panel interno Plastifar · Plan de construcción · Ampliación v0.1 · 11 de octubre de 2026

**Responsable:** Por asignar  ·  **Prioridad:** segunda entrega, bloquea la conexión de 04, 05 y 06  ·  **Tablas nuevas:** `TaskType`, `TaskTypeDepartment`, `TaskTypeAssignee`, `FormRoutingRule`; amplía `TicketTask`

Marcas usadas: **[Fuente]**, **[Propuesta]**, **[Abierta]**. Ver [README](README.md), sección 2.

> **Módulo de otro responsable.** Las tareas del ticket pertenecen a la Bandeja de tickets, que el plan original
> asigna a Richard De León (sección 9). Este documento amplía su modelo (`TicketTask`), su controlador
> (`TicketTasksController`) y el proceso de vencimientos (`SlaBreachWorker`). Según la sección 3.3 del plan
> original, esos cambios los hace el responsable de la Bandeja o se acuerdan con él antes de escribirlos.

## 1. Situación y objetivo

El sistema mide el tiempo de los tickets: cada ticket recibe una política de SLA según su motivo o su prioridad,
con minutos de primera respuesta y de resolución. Las tareas del ticket, en cambio, solo tienen una fecha límite
libre y opcional.

La hoja `SLA` del insumo describe otra cosa. De sus 14 filas, 13 son plazos de **tarea** y solo una es de
ticket. Cada plazo está atado a una acción concreta —investigar, aprobar, retirar, ajustar—, a un departamento y
a una persona. Y la hoja `FORMULARIOS` añade una regla que hoy no existe: hay tareas que no pueden cerrarse sin
haber llenado un formulario.

El objetivo es que una tarea nazca de un tipo conocido, herede de él su plazo, su departamento y sus
responsables, se mida contra ese plazo igual que un ticket, y no pueda completarse mientras falte el formulario
que su tipo exige.

## 2. Alcance

**Incluye**

- Catálogo de tipos de tarea con su plazo en días, sus departamentos y sus responsables habituales.
- Cálculo y vigilancia del vencimiento de las tareas.
- Reglas de enrutamiento de formularios: quién llena o consulta cada formulario y en qué momento.
- Bloqueo del cierre de una tarea cuando falta su formulario obligatorio.
- El plazo de ticket de la fila «RESPUESTA A RECLAMACIONES», cuya forma de medirse está abierta (sección 7.3).

**No incluye**

- Los formularios en sí; cada uno se especifica en su documento (03, 04, 05 y 06).
- Las claves de permiso de tareas, definidas en el documento 01.
- Reglas de escalamiento y de notificación configurables: la fuente no pide ninguna.

## 3. Dependencias

- **01 Organización y permisos:** claves `tasks.*` y los departamentos reales.
- **00 Base común:** equipos, para las reglas que nombran un equipo.

## 4. Fuente y trazabilidad

| Requisito | Hoja | Celdas |
|---|---|---|
| Plazo por acción, responsable, departamento y tipo | `SLA` | A1:E15 (14 filas de datos). La columna F y las filas 16 a 61 tienen formato pero están vacías |
| Quién llena o consulta cada formulario y cuándo | `FORMULARIOS` | A1:D7 (6 filas de datos) |
| Regla de identificación de los formularios | `FORMULARIOS` | Nota en D12 |
| Cierre de tarea condicionado | `FORMULARIOS` | C5 y C6: «NO SE PUEDE CERRAR TAREA SIN ESTO.» |

## 5. Lo que ya existe

| Pieza | Dónde | Estado |
|---|---|---|
| Tarea del ticket | Backend `api/Models/TicketTask.cs:13-55`: título, descripción, estado (`Pendiente`, `EnProgreso`, `Completada`, `Cancelada`, :4-10), creador, un único asignado (`AssignedStaffId`, :31), fecha límite libre y opcional (`DueDate`, :35), sello y comentario de cierre, adjuntos y comentarios | Construido |
| Operaciones sobre tareas | `api/Controllers/TicketTasksController.cs`, bajo `api/tickets/{ticketId}/tasks` (:16): listar (:86), crear (:109), editar (:178), completar (:263), reabrir (:377), comentar (:433), enlace de adjunto (:490) y eliminar (:535) | Construido; sin claves de permiso (ver documento 01) |
| Transiciones de estado de la tarea | Editar solo alterna entre `Pendiente` y `EnProgreso` (:228-243); completar pasa a `Completada` (:331); reabrir vuelve a `Pendiente` (:402) | **Ningún endpoint lleva una tarea a `Cancelada`.** El estado existe en el enumerado (`TicketTask.cs:9`) y el frontend lo filtra (`TicketTasksTab.tsx:157`), pero hoy es inalcanzable. Tampoco hay campo para el motivo |
| Eliminación de tareas | `TicketTasksController.cs:535-586`: borrado físico (`Remove`, :569), permitido al creador o a un administrador (:549); deja un evento en el ticket (:558-565) | Construido. El documento 01 propone convertirlo en baja lógica auditada gobernada por `tasks.delete` (sección 8, regla 9, y sección 6.4) |
| Evidencias de la tarea | Se suben únicamente al completar: el endpoint recibe `multipart/form-data` con `EvidenceFiles` (:264, :292), las valida con `AttachmentPolicy` (:293) y las guarda con `IAttachmentStorage` (:311). La descarga devuelve un enlace firmado de 10 minutos (:490-532) | Construido; no hay endpoint de subida independiente |
| Pantallas de tareas | `src/pages/tickets/TicketTasksTab.tsx`, `CreateTaskModal.tsx`, `CompleteTaskModal.tsx`, `TaskCommentsAside.tsx` | Construido |
| Política de SLA de ticket | `api/Models/Settings.cs:59-85`: nombre, prioridad obligatoria, minutos de primera respuesta y de resolución, horario laboral, jornada y días laborables | Construido |
| Días no laborables | `api/Models/Settings.cs:88-97` | Construido |
| Resolución de la política | `api/Services/SlaCalculationService.cs:23-69`: primero la del motivo; luego la predeterminada de la prioridad; después cualquier política activa de esa prioridad, la predeterminada global y, por último, cualquier política activa | Construido; solo tickets |
| Suma de minutos de jornada | Servidor: `SlaCalculationService.cs:126-177` (`AddBusinessMinutes`), con zona horaria de la operación (:357-372). Navegador: `src/lib/sla.ts:47-120`, solo para previsualizar la regla en el diálogo | Construido; solo tickets. Reutilizable para el vencimiento de tareas |
| Vigilancia de vencimientos | `api/Services/SlaBreachWorker.cs`: revisa cada minuto (:12); aviso una hora antes del vencimiento de resolución (:51, :142) y notificación con el asignado y el departamento del ticket (:115, :137, :173) | Construido; **solo revisa tickets** |
| Indicador de tiempo restante | `formatSlaRemaining` en `src/lib/format.ts:133`, usado en `TicketsPage.tsx:770` y `TicketDetailPage.tsx:774` | Construido; solo tickets |
| Administración de SLA | `src/pages/settings/SlaSection.tsx` (escritura con `settings.write`, :76) y `SlaModal.tsx` (:32-50), en la ruta `/configuracion/sla` (`src/App.tsx:127`) | Construido |
| Tipo de tarea, plazo de tarea, regla de formulario | — | **No existen** |

Lo que el modelo actual de SLA no puede representar de la hoja `SLA`:

1. Un plazo sobre una tarea: `TicketTask` no tiene política, ni tipo, ni sellos de aviso o de incumplimiento.
2. Un plazo determinado por la acción: las políticas se eligen por prioridad y, opcionalmente, por motivo.
3. Un plazo determinado por el departamento: `SlaPolicy` no tiene departamento.
4. Un responsable nombrado por plazo, y menos dos: no hay campo de dueño y la tarea admite un solo asignado.
5. Un plazo único: el modelo exige primera respuesta y resolución, con la segunda mayor o igual que la primera
   (`SlaModal.tsx:52`).
6. Un plazo sin prioridad: la prioridad es obligatoria en la política y la hoja no tiene ninguna.

## 6. Modelo de datos

Todo el modelo de esta sección es **[Propuesta]**.

**TaskType** — tipo de tarea; corresponde a la columna `ACCION` de la hoja `SLA`.

| Campo | Tipo | Regla |
|---|---|---|
| `Id` | int | Identidad |
| `Name` | string(120) | Obligatorio, único |
| `SlaDays` | int | Plazo en días; entre 1 y 365 |
| `BusinessDaysOnly` | bool | Si es verdadero, el plazo cuenta solo días laborables; si es falso, días calendario. **Sin valor por defecto decidido:** la fuente dice solo «DIAS» (pregunta 1). El campo existe para que cualquiera de las dos respuestas sea un cambio de datos y no de esquema |
| `RequiredForm` | enum? | Formulario que debe estar lleno para completar la tarea: `Reclamacion` · `RetiroMercancia` · `Hca` · `DiscrepanciaCarga` |
| `IsActive` | bool | Baja lógica |
| `CreatedAt`, `UpdatedAt` | timestamptz | UTC |

**[Abierta]** Lo que cada respuesta a la pregunta 1 implica para el modelo:

| Opción | Qué necesita el modelo |
|---|---|
| (a) Días laborables | Un calendario: qué días de la semana cuentan, qué feriados se saltan (`Holiday`, que ya existe) y a qué hora termina la jornada. Hay que decidir además si el calendario es uno solo o por país, porque hay departamentos y plantas en Guatemala. El recorrido de días laborables ya existe para los tickets y se reutilizaría |
| (b) Días calendario | Nada más que el plazo: el vencimiento es la fecha de creación más N días. No depende de `Holiday` ni de la jornada, y `BusinessDaysOnly` sobra o queda siempre en falso |
| Mixta | Si unos tipos de tarea cuentan en laborables y otros en calendario, `BusinessDaysOnly` por tipo lo resuelve sin más cambios |

**TaskTypeDepartment** — departamentos a los que corresponde el tipo: `TaskTypeId`, `DepartmentId`. Clave única
sobre el par. Existe porque dos filas de la fuente nombran dos departamentos.

**TaskTypeAssignee** — responsables habituales del tipo: `TaskTypeId`, `StaffId`. Clave única sobre el par.
Existe porque dos filas de la fuente nombran dos personas.

**FormRoutingRule** — quién llena o consulta un formulario y en qué momento; corresponde a la hoja
`FORMULARIOS`.

| Campo | Tipo | Regla |
|---|---|---|
| `Id` | int | Identidad |
| `Form` | enum | `Reclamacion` · `RetiroMercancia` · `Hca` · `DiscrepanciaCarga` |
| `Moment` | enum | `AlCrearTicket` · `AlCompletarTarea` · `ConsultaDesdeTarea` |
| `DepartmentId` | int? | Departamento al que aplica; incluye a sus hijos |
| `TeamId` | int? | Equipo al que aplica |
| `IsBlocking` | bool | Si es verdadero, la tarea no puede completarse sin el formulario |
| `IsActive` | bool | Baja lógica |

Debe venir un departamento o un equipo, no ninguno.

**Cambios en `TicketTask`**

| Campo | Tipo | Regla |
|---|---|---|
| `TaskTypeId` | int? | Tipo de la tarea. Nulo en las tareas libres y en las anteriores a este módulo |
| `DepartmentId` | int? | Departamento que debe atenderla; determina quién la ve |
| `DueAt` | timestamptz? | Vencimiento calculado al crear, a partir del plazo del tipo |
| `SlaDays`, `BusinessDaysOnly` | int? · bool? | Copia del plazo del tipo en el momento de crear |
| `RequiredForm` | enum? | Copia del formulario exigido en el momento de crear |
| `WarnedAt` | timestamptz? | Sello del aviso de vencimiento próximo |
| `BreachedAt` | timestamptz? | Sello del incumplimiento |
| `CancelledAt`, `CancelledByStaffId`, `CancelReason` | timestamptz? · int? · text? | Sello, autor y motivo de la cancelación. Hoy no existen: el estado `Cancelada` está en el enumerado pero ningún endpoint lo asigna |

El campo existente `DueDate` (`TicketTask.cs:35`) se conserva para las tareas libres. Cuando la tarea tiene tipo,
manda `DueAt`. El documento 01 (sección 6.4) añade al mismo modelo los campos de baja lógica `DeletedAt`,
`DeletedByStaffId` y `DeleteReason`; las dos ampliaciones deben ir en migraciones coordinadas.

**Índices obligatorios:** `TaskType.Name` único; `TicketTask.TaskTypeId`; `(TicketTask.DepartmentId, Status)`;
`(TicketTask.AssignedStaffId, Status)`; `TicketTask.DueAt` para los vencimientos; `FormRoutingRule.DepartmentId`;
`FormRoutingRule.TeamId`; `(FormRoutingRule.Form, Moment)`.

## 7. Catálogos y datos semilla

### 7.1 Hoja `SLA` **[Fuente]**

Las 14 filas, tal como están.

| Fila | TIEMPO | ACCION | AGENTE | DEPARTAMENTO | TIPO |
|---|---|---|---|---|---|
| 2 | 30 DIAS | RESPUESTA A RECLAMACIONES | RUTH AGUERO | SOPORTE | TICKET |
| 3 | 30 DIAS | REVISION DE ACCIONES IMPLEMENTADAS | MICHELL FLORIAN | CALIDAD / PRODUCCION | TAREA |
| 4 | 15 DIAS | RETIRO DE MERCANCIA | MARTA SEBASTIAN | ALMACEN | TAREA |
| 5 | 15 DIAS | INVESTIGACION DE CALIDAD | MICHELL FLORIAN | CALIDAD / PRODUCCION | TAREA |
| 6 | 5 DIAS | INVESTIGACION DE MONITOREO | VALMYR / OTTONIEL | MONITOREO | TAREA |
| 7 | 5 DIAS | INVESTIGACION DE INVENTARIO | MIGUEL QUEZADA | ALMACEN | TAREA |
| 8 | 3 DIAS | APROBACIONES ADMINISTRACION | REYNA TAVARES | CREDITOS Y COBROS | TAREA |
| 9 | 2 DIAS | CREACION DE NOTA DE CREDITO | ISABEL PLACIDO | ALMACEN | TAREA |
| 10 | 2 DIAS | APROBACION DE AJUSTE DE INVENTARIO | ALEJANDRO FARACH | ADMINISTRACION | TAREA |
| 11 | 2 DIAS | REVISION DE NOTA DE CREDITO | REINA TAVARES | CREDITOS Y COBROS | TAREA |
| 12 | 2 DIAS | AJUSTE DE INVENTARIO | EDWIN CONTRERAS | COSTOS | TAREA |
| 13 | 1 DIA | APROBACION DE CASOS DE CALIDAD | FRANCIS FERNANDEZ | PRODUCCION | TAREA |
| 14 | 1 DIA | APROBACION DE RETIROS X ERRORES VEND | LEONIDAS LEONARDO | VENTAS LOCAL | TAREA |
| 15 | 1 DIA | APROBACION DE RETIROS X ERRORES DE ALMACEN | MARTA SEBASTIAN / YUDITH PARTIDA | ALMACEN | TAREA |

**Lo que la hoja define:** una duración por acción, escrita como texto y siempre en días; una persona responsable
(dos en las filas 6 y 15); un departamento (dos en las filas 3 y 5); y un tipo, que es TICKET en una fila y TAREA
en trece.

**Lo que la hoja no define en ninguna parte:** prioridad, tipo de cliente o motivo del ticket; tiempos separados
de primera respuesta y de resolución; si los días son laborables o calendario, horario y feriados; reglas de
escalamiento, a quién se notifica, umbrales de aviso o reglas de pausa. Tampoco hay un catálogo de motivos de
ticket: lo más cercano es la propia columna `ACCION`, que es una lista de tipos de tarea.

Problemas de la fuente y valor propuesto:

| Fila | En la fuente | Observación | Valor propuesto |
|---|---|---|---|
| 8, 11 | `REYNA TAVARES`, `REINA TAVARES` | La hoja `AGENTES` escribe `REYNA TAVAREZ`: tres grafías de una misma persona | `REYNA TAVAREZ`, por confirmar |
| 6 | `VALMYR / OTTONIEL` | Solo nombres de pila; en `AGENTES` hay un agente con cada nombre | Emparejar con esos dos agentes |
| 14 | `VENTAS LOCAL` | En `DEPARTAMENTOS` es `VENTAS LOCALES` | `VENTAS LOCALES` |
| 14 | `ERRORES VEND` | Abreviatura, presumiblemente «errores de vendedor» | `APROBACION DE RETIROS X ERRORES DE VENDEDOR`, por confirmar |
| 3, 5 | `CALIDAD / PRODUCCION` | Significa dos departamentos, pero usa el mismo « / » que en `DEPARTAMENTOS` indica padre e hijo | Dos departamentos: CALIDAD y PRODUCCION |
| 2 | Responsable de SOPORTE | En `AGENTES` su departamento principal es BACKOFFICE, y ningún agente tiene SOPORTE como principal | Por confirmar |
| 8 | `APROBACIONES ADMINISTRACION` en CREDITOS Y COBROS | La acción nombra a Administración y el departamento es otro | Se respeta la hoja |
| 9 | `CREACION DE NOTA DE CREDITO` en ALMACEN | La nota de crédito la crea una persona de Almacén | Se respeta la hoja |

### 7.2 Tipos de tarea **[Propuesta]**

Se crea un tipo por cada una de las 13 filas `TAREA`, con el nombre de la columna `ACCION`, el plazo de la
columna `TIEMPO`, los departamentos de la columna `DEPARTAMENTO` y los responsables de la columna `AGENTE`
emparejados contra `Staff`. Hasta que los agentes estén cargados (documento 01), los tipos se crean sin
responsables.

### 7.3 Plazo de ticket: «RESPUESTA A RECLAMACIONES» **[Abierta]**

**[Fuente]** La fila 2 es la única de tipo TICKET: un solo plazo, 30 DIAS, para una acción, con una persona y
un departamento. No tiene prioridad, no separa primera respuesta de resolución y no dice si los días son
laborables.

El modelo de SLA de tickets que hoy existe viene del plan original (sección 8) y pide más de lo que la fuente
da: una política tiene prioridad obligatoria y dos tiempos, primera respuesta y resolución, con el segundo mayor
o igual que el primero (sección 5). Encajar la fila 2 en ese modelo obliga a inventar una prioridad y un tiempo
de primera respuesta. Este plan no los inventa. Opciones (pregunta 5):

| Opción | Qué implica |
|---|---|
| (a) Encajarla en `SlaPolicy` con los datos que Plastifar aporte | Plastifar define la prioridad y el tiempo de primera respuesta de una reclamación. No cambia el modelo; la política se asigna al motivo de reclamación |
| (b) Admitir en `SlaPolicy` un plazo único, sin primera respuesta | La primera respuesta pasa a opcional en el modelo, en la validación (`SlaModal.tsx:52`) y en el cálculo; la política se asigna al motivo y su prioridad deja de tener efecto. Es un cambio en el módulo de Catálogos y en la Bandeja |
| (c) Medirlo fuera del SLA de tickets | Los 30 días se miden sobre la reclamación (documento 03), de su fecha a su cierre, igual que los plazos de tarea de este documento, y el SLA de tickets por prioridad queda como está |

En las tres, si los días cuentan en horario laboral o en tiempo corrido depende de la pregunta 1. Mientras no
haya respuesta no se crea ninguna política para esta fila.

### 7.4 Hoja `FORMULARIOS` **[Fuente]**

| Fila | DEPARTAMENTO | AGENTE | ACCION | FORMULARIO |
|---|---|---|---|---|
| 2 | PLASTIFAR CENTROAMERICA, VENTAS LOCALES, VENTAS INTERNACIONAL Y SUS SUBDEPARTAMENTOS | TODOS | LLENAR AL INICIO DEL TICKET | DETALLES DEL TICKET (FORMULARIO DE RECLAMACION) |
| 3 | VENTAS LOCALES, VENTAS LOCALES / HAITI, VENTAS LOCALES / INSTITUCIONALES, VENTAS LOCALES / KEY ACCONTS, VENTAS LOCALES / REGION NORTE O CIBAO, VENTAS LOCALES / ZONA ESTE , VENTAS LOCALES / ZONA METROPOLITANA, VENTAS LOCALES / ZONA SANTODOMINGO ESTE, VENTAS LOCALES / ZONA SANTO DOMINGO NORTE, VENTAS LOCALES / ZONA SUR | TODOS | LLENAR AL INICIO DEL TICKET | RETIRO DE MERCANCIA |
| 4 | ALMACEN | TODOS | VER E IMPRIMIR DESDE UNA TAREA | RETIRO DE MERCANCIA |
| 5 | CALIDAD, PRODUCCION, EQUIPOS DE PLANTAS | TODOS | LLENAR DESDE UNA TAREA AL TERMINAR, NO SE PUEDE CERRAR TAREA SIN ESTO. | HCA |
| 6 | MONITOREO | TODOS | LLENAR DESDE UNA TAREA AL TERMINAR, NO SE PUEDE CERRAR TAREA SIN ESTO. | PF-FOR-291- Formulario Investigación de Discrepancia de Carga V1 |
| 7 | ALMACEN, EQUIPO DE CONTROL DE INVENTARIO | Cuatro agentes nombrados (columna B) | VER E IMPRIMIR DESDE UNA TAREA | PF-FOR-291- Formulario Investigación de Discrepancia de Carga V1 |

Nota en D12, con relleno naranja: **«NOTA: CADA FORMULARIO DEBE TENER EL DEL TICKET Y TAREA SI CORRESPONDE»**.
A la frase le falta un sustantivo después de «EL».

Problemas de la fuente:

- Nombra tres grupos que no están definidos en ninguna hoja: `EQUIPOS DE PLANTAS`, `EQUIPO DE CONTROL DE
  INVENTARIO` y `VENTAS INTERNACIONAL Y SUS SUBDEPARTAMENTOS` (el departamento es `VENTAS INTERNACIONALES`).
- Erratas en la fila 3: `KEY ACCONTS` y `ZONA SANTODOMINGO ESTE`.
- La fila 2 no incluye a ALMACEN, CALIDAD ni a los demás departamentos entre quienes llenan la reclamación.
- La fila 3 enumera los diez departamentos de Ventas Locales uno por uno; la fila 2 dice «y sus
  subdepartamentos».

### 7.5 Reglas de enrutamiento **[Propuesta]**

| Formulario | Momento | Aplica a | Bloquea |
|---|---|---|---|
| `Reclamacion` | `AlCrearTicket` | PLASTIFAR CENTROAMERICA, VENTAS LOCALES y VENTAS INTERNACIONALES, con sus hijos | No |
| `RetiroMercancia` | `AlCrearTicket` | VENTAS LOCALES, con sus hijos | No |
| `RetiroMercancia` | `ConsultaDesdeTarea` | ALMACEN | No |
| `Hca` | `AlCompletarTarea` | CALIDAD, PRODUCCION y los equipos de planta | Sí |
| `DiscrepanciaCarga` | `AlCompletarTarea` | MONITOREO | Sí |
| `DiscrepanciaCarga` | `ConsultaDesdeTarea` | ALMACEN y EQUIPO DE CONTROL DE INVENTARIO | No |

La fuente ata los formularios a departamentos, no a tipos de tarea. La correspondencia con los tipos de tarea es
una inferencia de este plan (pregunta 3):

| Tipo de tarea | Formulario obligatorio propuesto |
|---|---|
| INVESTIGACION DE CALIDAD | `Hca` |
| INVESTIGACION DE MONITOREO | `DiscrepanciaCarga` |
| Los otros 11 tipos | Ninguno |

## 8. Lógica de negocio

1. **[Fuente]** Hay tareas que no pueden cerrarse sin su formulario: la HCA para Calidad, Producción y los
   equipos de planta, y la investigación de discrepancia para Monitoreo.
2. **[Fuente]** Todo formulario lleva la referencia del ticket y, si corresponde, de la tarea. Se asume que la
   palabra que falta en la nota es «número».
3. **[Propuesta]** Al crear una tarea con tipo, el servidor resuelve —no el navegador— el departamento, el
   plazo, el vencimiento y el formulario exigido. Que lo resuelva el servidor es un criterio técnico y no
   depende de Plastifar.
   **[Abierta]** Qué pasa con las tareas ya creadas cuando después cambia el plazo de su tipo. La fuente no lo
   dice. El plan original fija para los tickets que el cambio de la política no altera los ya creados (sección
   8.3, regla 2); es una regla de negocio de la maqueta y aquí figura solo como opción. Opciones (pregunta 11):
   (a) el plazo se copia a la tarea al crearla y un cambio posterior del tipo no la altera; (b) las tareas
   abiertas se recalculan con el plazo nuevo; (c) se recalculan solo las que aún no han vencido. Como referencia
   de lo construido: el ticket guarda sus vencimientos al crearse (`TicketsController.cs:513`), no una copia de
   la política, y se recalculan con la política vigente cuando el ticket se edita (:861) o cambia su prioridad
   en bloque (:1748). **Supuesto provisional de trabajo:** (a); por eso el modelo de la sección 6 guarda en la
   tarea una copia de `SlaDays`, `BusinessDaysOnly` y `RequiredForm`, que además permite aplicar (b) o (c) sin
   cambiar el esquema.
4. **[Abierta]** Cálculo del vencimiento. La fuente dice «DIAS» y nada más: no indica si son laborables o
   calendario, ni horario, ni feriados (pregunta 1). El plan no asume ninguna de las dos. Lo único común a
   ambas es que el vencimiento se obtiene sumando el plazo a la fecha de creación; el resto depende de la
   respuesta:
   - **Opción (a), días laborables.** Se saltan los días no laborables de la semana y los días de `Holiday`, y
     la tarea vence al final de la jornada del último día. El recorrido de días laborables y feriados ya existe
     para los tickets (`SlaCalculationService.cs:126-177` y :374-379) y se reutilizaría; lo nuevo sería contar
     días enteros en lugar de minutos. Queda por definir qué días de la semana cuentan y si el calendario es el
     mismo para RD y para Guatemala.
   - **Opción (b), días calendario.** El vencimiento es la fecha de creación más N días corridos, incluidos
     fines de semana y feriados. No interviene `Holiday`. Queda por definir si vence a la misma hora en que se
     creó o al final de ese día.

   Con plazos de 1 día la diferencia es total: una tarea creada un viernes vence el lunes con (a) y el sábado
   con (b). Por eso ningún vencimiento se calcula con datos reales hasta tener la respuesta.
5. **[Propuesta]** Si el tipo tiene un solo responsable habitual, la tarea nace asignada a esa persona. Si tiene
   varios, nace sin asignar y visible para todos ellos; cualquiera puede tomarla.
6. **[Propuesta]** Completar una tarea con formulario exigido requiere que exista ese formulario ligado a la
   tarea y en un estado que cada documento define como «lleno». Si falta, el servidor responde 409 con un
   mensaje que dice exactamente qué formulario falta.
7. **[Propuesta]** Una tarea cancelada no exige formulario, pero sí un motivo escrito.
8. **[Propuesta]** El incumplimiento se sella en el momento en que ocurre, sin esperar a que alguien abra la
   pantalla. El proceso en segundo plano que hoy revisa tickets revisa también tareas, y avisa al asignado y al
   responsable del departamento.
9. **[Propuesta]** El reloj de una tarea no se pausa. La fuente no describe ninguna pausa.
10. **[Propuesta]** Una tarea sin tipo sigue funcionando como hoy: fecha límite libre, sin vigilancia.
11. **[Propuesta]** La visibilidad de una tarea sigue al departamento: la ven quienes tienen `tasks.read` en el
    departamento de la tarea o en su padre, además de su creador y su asignado.

### 8.1 Estados

Se conservan los cuatro estados del enumerado: `Pendiente`, `EnProgreso`, `Completada` y `Cancelada`
(`TicketTask.cs:4-10`). Hoy existen tres transiciones: alternar entre `Pendiente` y `EnProgreso` al editar,
completar y reabrir. **[Propuesta]** Cambia la condición de completar y se añade la cancelación, que hoy no
tiene endpoint.

| Desde | Hacia | Quién y condición | Estado actual |
|---|---|---|---|
| `Pendiente` ↔ `EnProgreso` | — | Personal con `tasks.edit` | Existe (`TicketTasksController.cs:228-243`); sin clave |
| `Pendiente`, `EnProgreso` | `Completada` | Personal con `tasks.close`. Si la tarea exige formulario, debe estar lleno; en caso contrario, 409 | Existe (:263); se añade la condición del formulario |
| `Completada` | `Pendiente` | Personal con `tasks.close` | Existe (reabrir, :377); sin cambios de regla |
| `Pendiente`, `EnProgreso` | `Cancelada` | Personal con `tasks.close`. Exige motivo escrito | **Nueva:** hay que crear el endpoint y los campos de cancelación |

## 9. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-S1 | Administración completa de tipos de tarea: listar, crear, editar, activar y desactivar, con plazo, departamentos, responsables y formulario exigido |
| RF-S2 | Al crear una tarea puede elegirse un tipo; el plazo, el departamento y el asignado se proponen a partir de él |
| RF-S3 | La tarea muestra su vencimiento y un indicador de tiempo restante, con resaltado inequívoco de lo vencido |
| RF-S4 | Listado paginado de tareas con pastillas Todas, Pendientes, Por vencer, Vencidas y Completadas, y filtros por departamento, tipo y asignado |
| RF-S5 | El sistema impide completar una tarea a la que le falta su formulario obligatorio e indica cuál es |
| RF-S6 | Desde la tarea se accede al formulario que debe llenarse o consultarse, según las reglas de enrutamiento |
| RF-S7 | Aviso por correo al asignado cuando una tarea está por vencer y cuando vence |
| RF-S8 | Administración de las reglas de enrutamiento de formularios |
| RF-S9 | Al crear un ticket desde un departamento con regla `AlCrearTicket`, se presenta el formulario correspondiente |
| RF-S10 | Cada cambio en tipos, reglas y tareas queda en la bitácora |

## 10. Endpoints

| Método y ruta | Descripción | Permiso |
|---|---|---|
| `GET /api/settings/task-types` | Listado paginado de tipos | Autenticado |
| `POST · PUT · DELETE /api/settings/task-types` | Alta, edición y baja | `settings.write` |
| `GET /api/settings/form-routing-rules` | Listado paginado de reglas | Autenticado |
| `POST · PUT · DELETE /api/settings/form-routing-rules` | Alta, edición y baja | `settings.write` |
| `GET /api/tasks` | Listado paginado de tareas con filtros, orden y contadores | `tasks.read` |
| `POST /api/tickets/{ticketId}/tasks` (ya existe, `TicketTasksController.cs:109`) | Acepta `taskTypeId` y resuelve plazo, departamento y formulario | `tasks.create` |
| `POST /api/tickets/{ticketId}/tasks/{taskId}/complete` (ya existe, :263; recibe `multipart/form-data`) | Comprueba el formulario exigido; 409 si falta | `tasks.close` |
| `POST /api/tickets/{ticketId}/tasks/{taskId}/cancel` (nuevo) | Cancela con motivo; no exige formulario | `tasks.close` |
| `GET /api/tickets/required-forms?departmentId=` | Formularios que aplican al crear un ticket desde el departamento indicado | `tickets.create` |

Las rutas de tareas existentes conservan su forma actual; no se cambia ninguna ruta ya publicada. El alta de
tickets ya consulta `GET /api/tickets/create-options` (`TicketsController.cs:276`); si los formularios aplicables
se devuelven ahí o en la ruta nueva se acuerda con el responsable de la Bandeja.

## 11. Pantallas

- **Configuración → Tipos de tarea:** sección nueva con la estructura estándar de catálogo. Columnas: nombre,
  plazo, departamentos, formulario exigido y estado. Como las demás secciones de Configuración, lleva ruta propia
  en `src/App.tsx` (:126-130) y entrada en `SIDEBAR_NAV` (`src/lib/navigation.ts:92`); no son pestañas de una
  misma pantalla.
- **Configuración → Formularios:** sección nueva, con ruta propia, para las reglas de enrutamiento.
- **Diálogo de crear tarea** (`CreateTaskModal.tsx`): se añade el selector de tipo; al elegirlo se rellenan
  plazo, departamento y asignado.
- **Pestaña de tareas del ticket** (`TicketTasksTab.tsx`): columna de vencimiento con indicador, y acceso al
  formulario asociado.
- **Diálogo de completar tarea** (`CompleteTaskModal.tsx`): si falta el formulario, muestra el aviso dentro del
  diálogo y un acceso directo para llenarlo; el diálogo no se cierra.
- **Listado de tareas:** pantalla nueva con la estructura estándar de listado.
- Componentes: `ModuleHeader`, `DataTable`, `FilterChip`, `SearchInput`, `Pagination`, `Modal`, `Field`,
  `Select`, `LookupSelect`, `DatePicker`, `Badge`, `StatusDot`, `Alert`. El indicador de vencimiento reutiliza
  `formatSlaRemaining` (`src/lib/format.ts:133`), que es el que ya usa la bandeja de tickets
  (`TicketsPage.tsx:770`); no se crea otro. Hoy la pestaña de tareas calcula el vencido por su cuenta, comparando
  `dueDate` con la hora actual (`TicketTasksTab.tsx:244-245`).

## 12. Permisos

Las define el documento 01: `tasks.read`, `tasks.create`, `tasks.edit`, `tasks.assign`, `tasks.close`,
`tasks.comment`, `tasks.delete` y `tasks.transfer`. Los catálogos de este módulo se escriben con
`settings.write`.

## 13. Validación

Reglas espejo entre Zod y el servidor.

| Campo | Regla |
|---|---|
| `TaskType.Name` | Obligatorio, de 3 a 120 caracteres; único |
| `TaskType.SlaDays` | Entero entre 1 y 365 |
| `TaskType` | Al menos un departamento |
| `FormRoutingRule` | Formulario y momento obligatorios; departamento o equipo, al menos uno; `IsBlocking` solo puede ser verdadero con el momento `AlCompletarTarea` |
| Crear tarea con tipo | El tipo debe estar activo; el asignado debe tener acceso al departamento de la tarea |
| Completar tarea | Si exige formulario, este debe existir y estar lleno; en caso contrario, 409 con `{ message }` |
| Cancelar tarea | Motivo obligatorio, de 10 a 500 caracteres |

## 14. Criterios de aceptación

- [ ] Los 13 tipos de tarea de la sección 7.1 quedan cargados con su plazo y sus departamentos.
- [ ] El vencimiento de una tarea sigue el criterio que Plastifar confirme en la pregunta 1. Este criterio no
      puede cerrarse antes. Como ilustración de cada opción, para una tarea de tipo «APROBACION DE CASOS DE
      CALIDAD» (1 día) creada un viernes:
      - Solo si se confirma la opción (a), días laborables de lunes a viernes: vence al final del lunes
        siguiente, y al final del martes si el lunes es feriado.
      - Solo si se confirma la opción (b), días calendario: vence el sábado, sea o no feriado.
- [ ] Una tarea que exige HCA no puede completarse sin ella: el servidor responde 409 y el diálogo muestra qué
      falta sin cerrarse.
- [ ] El incumplimiento de una tarea queda sellado aunque nadie abra la pantalla.
- [ ] Bajo el supuesto provisional de la regla 3 (pregunta 11, opción a): cambiar el plazo de un tipo no modifica
      el vencimiento de las tareas ya creadas. Si Plastifar elige otra opción, este criterio se sustituye.
- [ ] No existe ninguna política de SLA para «RESPUESTA A RECLAMACIONES» con prioridad o primera respuesta
      inventadas: la fila se carga cuando se resuelva la pregunta 5.
- [ ] Un usuario sin acceso al departamento de una tarea no la ve en el listado.
- [ ] El listado de tareas responde en menos de 300 ms con 10 000 tareas de prueba.
- [ ] Las tareas creadas antes de este módulo siguen funcionando sin tipo.
- [ ] Cumple la lista de verificación de cierre de la sección 4.5 del plan original.

## 15. Riesgos

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| Días laborables o calendario sin definir | Vencimientos calculados con un criterio que Plastifar no comparte; con plazos de 1 día la diferencia es total | Resolver la pregunta 1 antes de calcular ningún vencimiento real; no se asume ninguna de las dos opciones, y el campo `BusinessDaysOnly` permite aplicar cualquiera, incluso por tipo |
| El SLA está atado a personas con nombre | Cuando esa persona se va o se ausenta, el plazo queda huérfano | Modelar el plazo sobre el tipo y el departamento; la persona es solo el asignado por defecto |
| Bloquear el cierre de tareas | Una tarea puede quedar atascada si el formulario no se puede completar | La cancelación con motivo no exige formulario |
| Cambios sobre el módulo de otro responsable | Conflictos de edición y criterios distintos | Acordar el contrato de `TicketTask` antes de empezar |
| La correspondencia entre tipo de tarea y formulario es una inferencia | Se exige un formulario en la tarea equivocada | Confirmar la pregunta 3 |
| El único plazo de ticket no cabe en el modelo de SLA por prioridad | Se inventan una prioridad y una primera respuesta, o las reclamaciones quedan sin plazo medido | Resolver la pregunta 5 antes de cargar la fila; no crear la política mientras tanto |

## 16. Preguntas abiertas para Plastifar

La última columna es siempre un supuesto provisional de trabajo de este plan, nunca una regla de Plastifar ni
del plan original (README, sección 2).

| # | Pregunta | Opciones | Se asume mientras tanto |
|---|---|---|---|
| 1 | Los plazos están en «DIAS». ¿Son días laborables o días calendario? Si son laborables, ¿qué días de la semana cuentan, con qué horario, qué feriados y si el calendario es el mismo para RD y Guatemala? Si son calendario, ¿la tarea vence a la misma hora en que se creó o al final del día? ¿El criterio es el mismo para los 14 plazos? | (a) laborables; (b) calendario; (c) depende del tipo de tarea. Lo que implica cada una está en la sección 6 y en la sección 8, regla 4 | **Ninguno.** El modelo admite las tres; no se calcula ningún vencimiento real hasta tener la respuesta |
| 2 | ¿El plazo pertenece a la persona nombrada o al departamento? Si la persona no está, ¿quién responde? | (a) al departamento, y la persona es el asignado habitual; (b) a la persona | (a) |
| 3 | ¿Qué tipo de tarea exige cada formulario? La hoja `FORMULARIOS` solo nombra departamentos | Ver la tabla de la sección 7.5 | INVESTIGACION DE CALIDAD exige HCA; INVESTIGACION DE MONITOREO exige PF-FOR-291 |
| 4 | En las filas con dos personas (6 y 15), ¿debe actuar cualquiera de las dos o ambas? | (a) cualquiera; (b) ambas | (a) |
| 5 | «RESPUESTA A RECLAMACIONES, 30 DIAS» es el único plazo de ticket: un solo plazo, sin prioridad y sin tiempo de primera respuesta. El SLA de tickets del sistema exige las dos cosas. ¿Cómo debe medirse? ¿Las reclamaciones tienen prioridades y un tiempo de primera respuesta en la operación real? | (a) se encaja en la política de SLA con la prioridad y la primera respuesta que Plastifar indique; (b) plazo único de resolución, sin primera respuesta; (c) se mide sobre la reclamación, fuera del SLA de tickets. Ver la sección 7.3 | **Ninguno.** No se crea la política ni se asume prioridad alguna hasta tener la respuesta |
| 6 | ¿Qué palabra falta en la nota «CADA FORMULARIO DEBE TENER EL DEL TICKET Y TAREA SI CORRESPONDE»? | (a) número; (b) otra | (a) |
| 7 | ¿Quiénes forman «EQUIPOS DE PLANTAS» y «EQUIPO DE CONTROL DE INVENTARIO»? | — | Los equipos propuestos en el documento 00, sección 7.2 |
| 8 | ¿Los demás departamentos (Almacén, Calidad, Soporte) no llenan la reclamación al crear un ticket? | (a) solo ventas; (b) cualquiera que cree un ticket de reclamación | (a), como dice la hoja |
| 9 | ¿Se requieren avisos antes del vencimiento, escalamiento o notificación a un superior? La hoja no define ninguno | — | Un aviso al asignado antes de vencer y otro al vencer, sin escalamiento |
| 10 | ¿Las tareas se crean a mano o deben generarse solas al abrir un ticket de cierto motivo? | (a) a mano; (b) automáticas por motivo | (a) |
| 11 | Si se cambia el plazo de un tipo de tarea, ¿qué pasa con las tareas de ese tipo que ya están creadas? | (a) conservan el plazo con el que nacieron; (b) las abiertas se recalculan con el plazo nuevo; (c) se recalculan solo las que aún no han vencido | Supuesto provisional de trabajo: (a) |
