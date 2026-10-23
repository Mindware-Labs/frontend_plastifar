# 06 · Módulo: Investigación de discrepancia de carga (PF-FOR-291)

Panel interno Plastifar · Plan de construcción · Ampliación v0.1 · 11 de octubre de 2026

**Responsable:** Por asignar  ·  **Prioridad:** quinta entrega  ·  **Tablas nuevas:** `LoadDiscrepancy`, `LoadDiscrepancyLine`, `LoadDiscrepancyCheck`

Marcas usadas: **[Fuente]**, **[Propuesta]**, **[Abierta]**. Ver [README](README.md), sección 2.

> **Módulos relacionados.** El formulario se llena desde una tarea del ticket, que pertenece a la Bandeja
> (sección 9 del plan original, Richard De León), y se relaciona con las solicitudes de crédito del módulo de
> Calidad (sección 10, Yordy Acosta).

> **Estado (12 de octubre de 2026).** Construido en las ramas `modulo/discrepancia-carga` de ambos repositorios,
> bajo los supuestos provisionales de la sección 16: modelo, migración con numeración propia (`DC-000001`), los
> nueve endpoints de la sección 10, las líneas con sus reglas, los nueve puntos con el punto 9 condicionado, dar
> por completa con la lista de lo que falta, aprobar o devolver con nota, reabrir, el aviso automático de
> hallazgo con constancia, la solicitud de crédito desde una línea apta, el listado con la pastilla «Con hallazgo
> de seguridad», la ficha, la impresión horizontal y las claves `discrepancies.*`. **No construido, a propósito:**
> `TaskId` y todo lo que toca la tarea (RF-D1 «desde la tarea», RF-D4, RF-D8 «desde su tarea», pestaña del
> ticket): es la Bandeja y depende del documento 02. Mientras tanto la investigación se crea desde el listado
> eligiendo el ticket. Los destinatarios del aviso (pregunta 2) se leen de la configuración
> `Discrepancies:SecurityNotifyEmails`; sin ella, el hallazgo queda en la bitácora sin aviso. La migración está
> aplicada en Postgres 17 local el 23 de octubre de 2026, desde el estado anterior a los módulos y sobre datos de prueba;
> falta aplicarla en Railway.

## 1. Situación y objetivo

El formulario PF-FOR-291, «Formulario de Investigación de Discrepancia de Carga», documenta la investigación que
hace Monitoreo cuando un cliente recibe más o menos producto del facturado. Tiene dos partes: una tabla con las
líneas en discrepancia, donde se decide si procede una nota de crédito, y una lista de nueve puntos de seguridad
que evalúan cómo se hizo la carga.

El sistema no tiene nada equivalente. Lo más cercano es la solicitud de crédito, que comparte la factura, el
cliente, el ticket y la separación entre quien solicita y quien aprueba, pero no tiene líneas de producto,
despachador, supervisor ni lista de seguridad.

El objetivo es que la investigación sea un registro ligado a su ticket y a su tarea, que Monitoreo la llene para
poder cerrar la tarea, que Almacén y control de inventario la consulten, y que un resultado positivo en seguridad
no pase inadvertido.

## 2. Alcance

**Incluye**

- Registro de la investigación con sus líneas de discrepancia.
- Lista de nueve puntos de seguridad.
- Realización y aprobación de la investigación. Si deben hacerlas personas distintas está abierto (sección 8,
  regla 10).
- Vínculo de cada línea con una solicitud de crédito, cuando procede.
- Consulta e impresión con el formato PF-FOR-291.

**No incluye**

- El costeo de las discrepancias y los resúmenes mensuales por despachador. Las hojas ocultas del archivo
  muestran que alguna vez se llevaron, pero no forman parte del formulario (pregunta 4).
- El ajuste de inventario que resulta de la investigación.
- La emisión de la nota de crédito, que ya resuelven las solicitudes de crédito.

## 3. Dependencias

- **00 Base común:** productos.
- **02 Tareas y SLA:** tipo de tarea «INVESTIGACION DE MONITOREO» y el bloqueo de cierre.

## 4. Fuente y trazabilidad

Archivo `PF-FOR-291- Formulario Investigación de Discrepancia de Carga V1 (1).xlsx`. La hoja visible
`PF-FOR-291` (rango B1:M31) es el formulario. No tiene fórmulas, validaciones, comentarios ni controles; las
marcas son celdas donde se escribe una «X».

**Hojas ocultas.** El archivo tiene cuatro hojas ocultas —`Costo`, `Hoja4`, `Hoja3` y `Hoja5`— con un registro
de reclamos de exportación de 2015: clientes, facturas, cantidades y montos por despachador. Son historial de
negocio, no definición del formulario, y no se copian a este documento. Sus fórmulas de costo apuntan a una tabla
eliminada (`#REF!`).

Control documental, en la cabecera de la hoja (filas 2 y 3): `Código Documento:` `PF-FOR-291`; `Fecha de
Emisión:` 30 de mayo de 2019; `Revisión:` `1`; `Fecha de Revision` 27 de agosto de 2020; y los campos `Emitido
por:` y `Aprobado por:`, que se refieren a la plantilla, no a cada registro.

| Elemento del formulario | Celdas |
|---|---|
| Título `Formulario de Investigación de Discrepancia de Carga` | B1:M1 |
| Cabecera de grupo `Cumple Para Nota de Credito?` | I5:J5 |
| Cabecera de líneas | Fila 6, columnas B a M |
| Líneas | Filas 7 a 12 (6 renglones) |
| `Realizado por:`, `Aprobado por:` | B14, B16 |
| `Nota:  ` | F14:F17; recuadro G14:M17 |
| `Marcar X`; `Puntos de Seguridad a Evaluar`, `Positivo`, `Negativo` | J19:L19; fila 20 |
| Nueve puntos de seguridad | B21:B29 |
| Quién lo llena y quién lo consulta | `PLAN-SLA-PERMISOS`, hoja `FORMULARIOS`, filas 6 y 7 |
| Plazos relacionados | `PLAN-SLA-PERMISOS`, hoja `SLA`, filas 6 a 12 |

## 5. Lo que ya existe

No hay contraparte. La búsqueda de «discrepancia», «despachador», «sobrante», «faltante», «contenedor» y
«PF-FOR» en `src` del frontend no encontró nada relacionado; el único resultado de negocio es un texto de
ejemplo en `src/pages/tickets/MotivoModal.tsx:103` (las demás apariciones de «contenedor» son comentarios de
maquetación). La misma búsqueda en modelos, controladores, DTO y servicios del backend tampoco encontró ninguna
entidad.

El vecino más cercano es la solicitud de crédito (`CreditRequest` en `src/types/quality.ts:92-116` y
`api/Models/Quality.cs:105-136`; controlador `api/Controllers/CreditRequestsController.cs`, ruta
`api/quality/credit-requests`, :20; pantalla `src/pages/quality/CreditRequestModal.tsx`):

| Campo del formulario | Equivalente aproximado en `CreditRequest` |
|---|---|
| `Factura` | `invoiceRef` (`quality.ts:104`) |
| `Cliente` | `clientId` |
| `# Reclamo` | `ticketId` y `ticketNumber` |
| `# N C` | `number` |
| `Cumple Para Nota de Credito?` | Decisión `Solicitada` / `Aprobada` / `Rechazada` / `Aplicada` (:83) |
| `Realizado por:` / `Aprobado por:` | Separación entre solicitante y quien decide (:106-113); la regla vive en `api/Services/QualityRules.cs:153-183` |

**No existe:** las líneas por producto (`Codigo`, `Descripcion del Producto`, `Cantidad Sobrante`, `Cantidad
Faltante`); `Despachador` y `Supervisor`; el campo `Nota`; la lista de nueve puntos de seguridad y su regla de
notificación; y un catálogo de productos.

## 6. Modelo de datos

Todo el modelo de esta sección es **[Propuesta]**.

**LoadDiscrepancy** — la investigación.

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `Id` | int | Identidad | — |
| `Number` | string(12) | Visible, secuencial y único; nunca se reutiliza | — |
| `TicketId` | int | Obligatorio | Nota de `FORMULARIOS` |
| `TaskId` | int? | Tarea de investigación asociada | Nota de `FORMULARIOS` |
| `Note` | text? | | `Nota:  ` |
| `Status` | enum | `EnInvestigacion` · `Completada` · `Aprobada` · `Devuelta` | — |
| `HasSecurityFinding` | bool | Calculado: algún punto del 1 al 8 es positivo | Puntos de seguridad |
| `PerformedByStaffId`, `PerformedAt` | int? · timestamptz? | Quién realizó la investigación y cuándo la dio por completa | `Realizado por:` |
| `ApprovedByStaffId`, `ApprovedAt`, `ApprovalNote` | int? · timestamptz? · text? | Quién aprobó o devolvió | `Aprobado por:` |
| `CreatedAt`, `UpdatedAt` | timestamptz | UTC | — |

**LoadDiscrepancyLine** — una línea por producto en discrepancia.

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `Id`, `DiscrepancyId` | int | Borrado en cascada con la investigación | — |
| `ClaimRef` | string(20)? | Número del reclamo; por defecto, el del ticket | `# Reclamo` |
| `InvoiceRef` | string(40) | Obligatoria | `Factura` |
| `ClientId` | int | Por defecto, el cliente del ticket | `Cliente` |
| `ProductId` | int | Referencia a `Product` | `Codigo` |
| `ProductCode`, `ProductName` | string | Copia en el momento de registrar | `Codigo`, `Descripcion del Producto` |
| `SurplusQuantity` | decimal(14,2) | Mayor o igual que cero | `Cantidad Sobrante` |
| `ShortageQuantity` | decimal(14,2) | Mayor o igual que cero | `Cantidad Faltante` |
| `QualifiesForCreditNote` | bool? | Nulo hasta que se decide | `SI`, `NO` |
| `CreditNoteNumber` | string(20)? | | `# N C` |
| `CreditRequestId` | int? | Solicitud de crédito del sistema, si existe | — |
| `DispatcherName` | string(160) | Obligatorio | `Despachador` |
| `DispatcherStaffId` | int? | Si el despachador es personal del sistema | `Despachador` |
| `SupervisorName` | string(160)? | | `Supervisor` |
| `SupervisorStaffId` | int? | Si el supervisor es personal del sistema | `Supervisor` |
| `Position` | int | Orden | — |

El despachador y el supervisor se guardan por nombre, con una referencia opcional al personal, porque no hay
garantía de que quienes cargan los contenedores sean usuarios del sistema (pregunta 6).

**LoadDiscrepancyCheck** — respuesta a cada punto de seguridad.

| Campo | Tipo | Regla |
|---|---|---|
| `Id`, `DiscrepancyId` | int | Borrado en cascada con la investigación |
| `ItemNumber` | int | Del 1 al 9; único dentro de la investigación |
| `Result` | enum? | `Positivo` · `Negativo`; nulo mientras no se responde |

Los textos de los nueve puntos son una constante del servidor expuesta al frontend, no una tabla: forman parte
de un formulario controlado y cambian solo con una nueva revisión del documento.

**Índices obligatorios:** `Number` único; `TicketId`; `TaskId`; `Status`; `HasSecurityFinding`;
`LoadDiscrepancyLine.DiscrepancyId`; `LoadDiscrepancyLine.ProductId`; `LoadDiscrepancyLine.ClientId`;
`LoadDiscrepancyLine.InvoiceRef`; `LoadDiscrepancyLine.CreditRequestId`;
`(LoadDiscrepancyCheck.DiscrepancyId, ItemNumber)` único.

## 7. Catálogos y datos semilla

### 7.1 Puntos de seguridad a evaluar **[Fuente]**

Hoja `PF-FOR-291`, B21:B29. Cada uno se marca con una «X» bajo `Positivo` o `Negativo`. El texto se transcribe
tal como está, sin corregir tildes ni redacción.

| # | Texto literal |
|---|---|
| 1 | No se pudo evidenciar video de vigilancia de la carga al momento de la investigación |
| 2 | El despachador no realizó la inspeccion previa de contenedor vacio antes de iniciar la carga de materiales. |
| 3 | El despachador no utiliza las herramientas de inspeccion (Martillo de Goma, Formato de Inspección). |
| 4 | No hay suficiente iluminacion al momento de realizar la inspeccion del contenedor y no se utilizo linterna en caso falta de iluminacion. |
| 5 | La carga es introducida al contenedor antes de realizar la inspeccion de seguridad. |
| 6 | Durante el proceso de carga se pudo evidenciar la manipulación de empaques para introducir materiales sospechas dentro del empaque? |
| 7 | Durante el proceso de carga se pudo evidenciar la presencia de personal ajeno a la carga o no autorizado? |
| 8 | Alguna persona de las que trabajaron en la carga de contenedor nunca salió del contenedor al finalizar la carga? Contrabando de personas |
| 9 | En caso de positivo en alguna de las anteriores preguntas se notifico a las Gerencias de Seguridad y Logística del evento? |

Observaciones sobre la fuente:

- Los puntos 1 a 5 están redactados en negativo: «Positivo» significa que se confirmó una falla.
- El punto 9 no evalúa la carga: pregunta si se notificó, y solo aplica cuando alguno de los anteriores es
  positivo.
- En el punto 4, el texto ocupa dos renglones dentro de la celda.

### 7.2 Opciones de las líneas **[Fuente]**

`Cumple Para Nota de Credito?` con `SI` y `NO`, por cada línea (I5:J6).

No hay datos semilla. Los registros de 2015 de las hojas ocultas no se cargan.

## 8. Lógica de negocio

1. **[Fuente]** La llena Monitoreo desde una tarea y al terminarla; la tarea no puede cerrarse sin ella
   (`FORMULARIOS`, fila 6).
2. **[Fuente]** Almacén y el equipo de control de inventario la ven y la imprimen desde una tarea
   (`FORMULARIOS`, fila 7). La fuente nombra además a cuatro agentes concretos en esa fila.
3. **[Fuente]** Plazos de la hoja `SLA` relacionados: «INVESTIGACION DE MONITOREO», 5 días, Monitoreo;
   «INVESTIGACION DE INVENTARIO», 5 días, Almacén; «CREACION DE NOTA DE CREDITO», 2 días, Almacén; «REVISION DE
   NOTA DE CREDITO», 2 días, Créditos y Cobros; «APROBACIONES ADMINISTRACION», 3 días, Créditos y Cobros;
   «AJUSTE DE INVENTARIO», 2 días, Costos; «APROBACION DE AJUSTE DE INVENTARIO», 2 días, Administración.
4. **[Fuente]** Si algún punto de seguridad es positivo, debe notificarse a las Gerencias de Seguridad y
   Logística (punto 9).
5. **[Fuente]** El formulario lleva dos firmas: quien lo realiza y quien lo aprueba.
6. **[Propuesta]** Cada línea tiene sobrante o faltante, no ambos, y los dos se guardan como números positivos.
   En el historial de 2015 los faltantes aparecen en negativo; aquí la columna ya indica el sentido.
7. **[Propuesta]** Para dar la investigación por completa deben estar respondidos los puntos 1 a 8, y cada línea
   debe tener decidida la nota de crédito. Si algún punto del 1 al 8 es positivo, el punto 9 es obligatorio; si
   ninguno lo es, el punto 9 no se responde.
8. **[Propuesta]** La investigación está «llena», a efectos de cerrar la tarea, cuando alcanza el estado
   `Completada`. No hace falta que esté aprobada.
9. **[Propuesta]** Al completar una investigación con algún punto positivo, el sistema envía un aviso por correo
   a los responsables de los departamentos que Plastifar designe para Seguridad y Logística, y deja constancia
   del envío. El punto 9 se sigue respondiendo a mano: el aviso del sistema no sustituye la notificación formal
   (pregunta 2).
10. **[Abierta]** Si quien realiza la investigación puede aprobarla. **[Fuente]** El formulario tiene dos líneas
    de firma, `Realizado por:` y `Aprobado por:`, y no dice que deban ser personas distintas ni indica cargo. El
    plan original exige separar a quien solicita de quien aprueba en los créditos (sección 10.3, regla 5), pero
    es una regla de negocio de la maqueta y aquí figura solo como opción. La operación real da un indicio en
    contra en un flujo vecino: la hoja `SLA` nombra a la misma persona en «RETIRO DE MERCANCIA» (fila 4) y en
    «APROBACION DE RETIROS X ERRORES DE ALMACEN» (fila 15); sobre la investigación de discrepancia la fuente no
    dice nada. Opciones (pregunta 1, d y e): quien realiza no puede aprobar, o sin restricción y aprueba quien
    tenga el permiso. Mientras no haya respuesta, el servidor no valida la separación.
11. **[Propuesta]** Quien aprueba puede devolverla con una nota; vuelve a `EnInvestigacion` y se puede corregir.
12. **[Propuesta]** Una línea marcada como apta para nota de crédito puede generar una solicitud de crédito del
    módulo de Calidad, que hereda ticket, cliente y factura. El monto se escribe en la solicitud; este formulario
    no maneja importes. La solicitud exige monto, moneda y motivo (`api/Models/Quality.cs:116-119`), de modo que
    no puede crearse sola: se abre el diálogo de solicitud con los tres datos heredados ya puestos.
13. **[Propuesta]** Una investigación aprobada no se edita. El papel tiene seis renglones; el sistema no pone
    tope y la impresión añade páginas.
14. **[Abierta]** Si una investigación puede eliminarse. **[Fuente]** La matriz de permisos concede «Eliminar»
    solo sobre tickets y sobre tareas (hoja `PERMISOS`, filas 5 y 18); sobre los formularios no dice nada, y el
    PF-FOR-291 tampoco. Este plan no inventa una clave de eliminación que la fuente no concede, y tampoco da por
    regla que la investigación no se elimine. **[Propuesta]** El tratamiento es el mismo que el documento 01 da
    a tickets y tareas (sección 8, regla 9): si Plastifar confirma que hace falta eliminar investigaciones, se
    implementa como baja lógica auditada, con actor, fecha y motivo; el borrado físico es la pregunta que queda
    abierta (pregunta 10). **Supuesto provisional de trabajo:** no hay eliminación propia. La investigación
    sigue a su ticket y a su tarea: si alguno recibe la baja lógica del documento 01, la investigación deja de
    verse con él y se conserva en la base. Conviene tener presente que este registro puede contener un hallazgo
    de seguridad; por eso, si se llega a permitir eliminarlo, el motivo y la bitácora no son opcionales.

### 8.1 Estados y transiciones

| Desde | Hacia | Quién y condición |
|---|---|---|
| (nueva) | `EnInvestigacion` | Al crearse desde la tarea |
| `EnInvestigacion` | `Completada` | Personal con `discrepancies.write`; exige las condiciones de la regla 7. Sella `PerformedAt` |
| `Completada` | `Aprobada` | Personal con `discrepancies.approve`. Si además debe ser distinto de quien la realizó está abierto (regla 10) |
| `Completada` | `Devuelta` | Personal con `discrepancies.approve`; exige nota |
| `Devuelta` | `EnInvestigacion` | Al reabrirla quien la realizó |
| `Aprobada` | — | Estado final |

Cualquier otra transición se responde con 409.

## 9. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-D1 | Alta de la investigación desde la tarea que la exige, heredando ticket y cliente |
| RF-D2 | Líneas de discrepancia con producto del catálogo, factura, cantidad sobrante o faltante, decisión de nota de crédito, despachador y supervisor |
| RF-D3 | Lista de los nueve puntos de seguridad, con el punto 9 habilitado solo cuando alguno anterior es positivo |
| RF-D4 | La tarea que exige la investigación no puede completarse hasta que esté completa; el aviso indica qué falta |
| RF-D5 | Aprobación o devolución con nota, por quien tiene el permiso. **[Abierta]** Si se excluye a quien la realizó depende de la pregunta 1 |
| RF-D6 | Aviso a Seguridad y Logística cuando hay algún punto positivo, con constancia del envío |
| RF-D7 | Desde una línea apta para nota de crédito se crea o se enlaza una solicitud de crédito |
| RF-D8 | Almacén y control de inventario consultan e imprimen la investigación desde su tarea, con el formato PF-FOR-291 |
| RF-D9 | Listado paginado con pastillas por estado, una pastilla «Con hallazgo de seguridad» y filtros por cliente, despachador y rango de fechas |
| RF-D10 | Toda escritura queda en la bitácora |

## 10. Endpoints

| Método y ruta | Descripción | Permiso |
|---|---|---|
| `GET /api/discrepancies` | Listado paginado con filtros, orden y contadores | `discrepancies.read` |
| `GET /api/discrepancies/{id}` | Detalle con líneas y puntos de seguridad | `discrepancies.read` |
| `GET /api/discrepancies/security-items` | Textos de los nueve puntos | `discrepancies.read` |
| `POST /api/tickets/{id}/discrepancies` | Alta, opcionalmente ligada a una tarea | `discrepancies.write` |
| `PUT /api/discrepancies/{id}` | Edición de nota, líneas y puntos mientras esté en `EnInvestigacion` | `discrepancies.write` |
| `POST /api/discrepancies/{id}/complete` | Dar por completa | `discrepancies.write` |
| `POST /api/discrepancies/{id}/decision` | Aprobar o devolver, con nota | `discrepancies.approve` |
| `POST /api/discrepancies/{id}/reopen` | Volver a `EnInvestigacion` tras una devolución | `discrepancies.write` |
| `POST /api/discrepancies/lines/{lineId}/credit-request` | Crear la solicitud de crédito de una línea, con el mismo cuerpo y las mismas validaciones que `POST /api/quality/credit-requests` (`CreditRequestsController.cs:185`), y dejar el vínculo en la línea | `quality.write` |

## 11. Pantallas

- **Tarea de investigación:** acceso para crear o abrir la investigación, y aviso cuando falta.
- **Detalle de la investigación:** tres secciones —líneas, nota y puntos de seguridad— y la ficha de realización
  y aprobación. Un hallazgo de seguridad se muestra con un aviso destacado en la cabecera.
- **Detalle del ticket:** pestaña «Discrepancia de carga».
- **Listado de investigaciones:** estructura estándar; columnas número, ticket, cliente, fecha, hallazgo de
  seguridad y estado.
- **Vista de impresión:** reproduce la distribución del PF-FOR-291 en horizontal, con el control documental y las
  dos líneas de firma, sin dependencias nuevas.
- Componentes: `Modal`, `FormSection`, `Field`, `Select`, `LookupSelect`, `DetailTable`, `SegmentedFilter` para
  Positivo y Negativo, `DataTable`, `FilterChip`, `Pagination`, `Badge`, `Alert`, `ConfirmDialog`.

## 12. Permisos

**[Propuesta]** Se añade el grupo «Discrepancias de carga» al catálogo.

| Clave | Permite | Requiere |
|---|---|---|
| `discrepancies.read` | Ver las investigaciones de sus departamentos | — |
| `discrepancies.write` | Crear, editar y dar por completa una investigación | `discrepancies.read` |
| `discrepancies.approve` | Aprobar o devolver. Si alcanza a la que uno mismo realizó está abierto (pregunta 1) | `discrepancies.read` |

La visibilidad sigue al ticket y a la tarea. Además, la ven los integrantes del equipo de control de inventario
y el personal de Almacén con `discrepancies.read`, como indica la hoja `FORMULARIOS`.

## 13. Validación

Reglas espejo entre Zod y el servidor.

| Campo | Regla |
|---|---|
| Líneas | Al menos una para dar por completa |
| `InvoiceRef` | Obligatoria, de 1 a 40 caracteres |
| `ProductId` | Obligatorio; producto activo |
| `SurplusQuantity`, `ShortageQuantity` | Mayores o iguales que cero; exactamente una de las dos mayor que cero |
| `QualifiesForCreditNote` | Obligatorio para dar por completa |
| `CreditNoteNumber` | Solo admite valor si la línea es apta para nota de crédito |
| `DispatcherName` | Obligatorio, de 3 a 160 caracteres |
| Puntos 1 a 8 | Todos respondidos para dar por completa |
| Punto 9 | Obligatorio si algún punto del 1 al 8 es positivo; vacío en caso contrario |
| Decisión | Nota obligatoria al devolver, de 10 a 500 caracteres. No se valida que quien decide sea distinto de quien realizó: esa separación es una opción pendiente de la pregunta 1, no una regla |

## 14. Criterios de aceptación

- [ ] La tarea «INVESTIGACION DE MONITOREO» no puede completarse sin una investigación en estado `Completada`.
      **Pendiente:** es la Bandeja (documento 02).
- [x] Con el punto 6 en positivo, el sistema exige responder el punto 9 y envía el aviso a Seguridad y Logística
      (`DiscrepanciesControllerTests.Completing_needs_decided_lines…` y `A_security_finding_notifies…`). El aviso
      sale si hay destinatarios configurados; sin ellos queda en la bitácora.
- [x] Con los puntos 1 a 8 en negativo, el punto 9 aparece deshabilitado y no se exige (misma prueba; la ficha
      lo muestra como «No aplica» y rechaza completar si se respondió).
- [x] Una línea con sobrante y faltante a la vez se rechaza con el error en su campo (`A_line_with_both…`; en
      Zod el error cae en «Cantidad faltante»).
- [x] Un usuario sin `discrepancies.approve` recibe 403 al intentar aprobar o devolver una investigación
      (`Decision_needs_the_approve_key…`; el 403 nombra la clave).
- [ ] Solo si Plastifar confirma la separación (pregunta 1, opción d): quien realizó la investigación recibe 409
      con mensaje claro al intentar aprobarla. Mientras la pregunta siga abierta, este criterio no aplica.
- [ ] Un integrante del equipo de control de inventario puede abrirla e imprimirla, y no puede editarla.
      **Parcial:** con `discrepancies.read` y sin `discrepancies.write` se abre e imprime y los botones de
      edición no aparecen; que el equipo de control de inventario la vea aunque el ticket no sea de su
      departamento es la visibilidad propia de la sección 12, que no se construyó: sigue al ticket.
- [x] La impresión muestra el código PF-FOR-291, la revisión y el número del ticket. El de la tarea, cuando
      exista el vínculo (documento 02).
- [x] Ningún registro de 2015 de las hojas ocultas aparece en la base ni en los datos de prueba: no hay semilla.
- [ ] Cumple la lista de verificación de cierre de la sección 4.5 del plan original. **Por revisar** en la
      revisión cruzada.

## 15. Riesgos

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| Un hallazgo de seguridad que nadie ve | Es el caso más grave que este formulario puede registrar | Aviso automático, pastilla propia en el listado y aviso destacado en el detalle |
| El aviso automático se confunde con la notificación formal | Se da por notificado lo que no se notificó | El punto 9 sigue siendo manual y obligatorio |
| Dos registros de la misma nota de crédito | El número de nota en la línea y la solicitud de crédito pueden no coincidir | Enlazar la línea con la solicitud; el número escrito a mano solo cuando la nota se emitió fuera del sistema |
| Despachadores y supervisores fuera del sistema | No se pueden agrupar de forma fiable por persona | Nombre obligatorio y referencia opcional al personal; decidir la pregunta 6 |
| El costeo quedó fuera | Plastifar puede esperar los resúmenes por despachador que llevaba en 2015 | Confirmar la pregunta 4 antes de dar por cerrado el alcance |
| Separación entre quien realiza y quien aprueba sin definir | Si se impone, puede bloquear a un departamento pequeño donde la misma persona investiga y aprueba; si no se impone, alguien aprueba lo suyo | Resolver la pregunta 1 antes de construir la aprobación; añadir la validación después es un cambio acotado |

## 16. Preguntas abiertas para Plastifar

La última columna es siempre un supuesto provisional de trabajo de este plan, nunca una regla de Plastifar ni
del plan original (README, sección 2).

| # | Pregunta | Opciones | Se asume mientras tanto |
|---|---|---|---|
| 1 | ¿Quién aprueba la investigación? El formulario dice «Aprobado por» sin indicar cargo. ¿Puede aprobarla la misma persona que la realizó? El formulario no lo impide, y la hoja `SLA` nombra a una misma persona en la ejecución y en la aprobación de los retiros (filas 4 y 15) | Quién: (a) el responsable de Monitoreo; (b) Almacén; (c) otro. Separación: (d) quien realiza no puede aprobar; (e) sin restricción | Aprueba cualquier persona con el permiso de aprobar. Sobre la separación, **ninguno:** el servidor no la valida hasta tener la respuesta |
| 2 | Cuando un punto de seguridad es positivo, ¿a quién exactamente se notifica y por qué medio? | (a) aviso automático a personas designadas; (b) solo se registra que se notificó | Aviso automático a los responsables que se designen, más la respuesta manual del punto 9 |
| 3 | ¿El `# Reclamo` es el número del ticket o una numeración aparte? ¿Una investigación puede cubrir varios reclamos o varios clientes? La tabla tiene cliente y reclamo por línea | (a) un ticket, un cliente; (b) varios por investigación | (b) en el modelo: cliente y reclamo por línea, con el del ticket por defecto |
| 4 | ¿Deben valorarse las discrepancias por costo y resumirse por despachador y por mes, como en las hojas de 2015? | (a) no; (b) sí, como reporte | (a) |
| 5 | ¿Una misma línea puede tener sobrante y faltante? | (a) no; (b) sí | (a) |
| 6 | ¿Los despachadores y supervisores serán usuarios del sistema? | (a) sí; (b) no, solo se escribe su nombre | (b), con referencia opcional |
| 7 | ¿`# N C` es el número de la nota de crédito emitida en el sistema de gestión o el de la solicitud de este panel? | (a) el de la nota emitida; (b) el de la solicitud | (a), con enlace aparte a la solicitud |
| 8 | Los puntos 1 a 5 están redactados en negativo y los 6 a 8 como pregunta. ¿Se conserva el texto literal o puede uniformarse? | (a) literal; (b) uniformado | (a) |
| 9 | «INVESTIGACION DE INVENTARIO», 5 días, Almacén: ¿usa este mismo formulario o es otro proceso? | (a) el mismo; (b) otro | Otro proceso; solo consulta este formulario |
| 10 | ¿Puede eliminarse una investigación de discrepancia? La matriz de permisos solo concede «Eliminar» sobre tickets y tareas. Si puede, ¿qué rol lo hace, también cuando tiene un hallazgo de seguridad, y basta con que deje de verse o debe borrarse físicamente? | (a) no se elimina; (b) baja lógica auditada, con el rol que Plastifar indique; (c) además, borrado físico en los casos que indique | Supuesto provisional de trabajo: (a), sin clave de eliminación; la investigación deja de verse si su ticket o su tarea reciben la baja lógica del documento 01 |
