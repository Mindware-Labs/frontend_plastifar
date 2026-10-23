# 03 · Módulo: Reclamación de clientes (PF-FOR-034)

Panel interno Plastifar · Plan de construcción · Ampliación v0.1 · 11 de octubre de 2026

**Responsable:** Por asignar  ·  **Prioridad:** tercera entrega  ·  **Tablas nuevas:** `CustomerClaim`, `CustomerClaimLine`, `CustomerClaimPlant`

Marcas usadas: **[Fuente]**, **[Propuesta]**, **[Abierta]**. Ver [README](README.md), sección 2.

> **Módulo de otro responsable.** El formulario se llena al crear el ticket, de modo que este módulo se integra
> en el alta de tickets de la Bandeja (sección 9 del plan original, Richard De León; pantalla
> `src/pages/tickets/CreateTicketModal.tsx`). El punto de integración debe acordarse con su responsable.

> **Estado (12 de octubre de 2026).** Construido en las ramas `modulo/reclamaciones` de ambos repositorios, bajo
> los supuestos provisionales de la sección 16: modelo, migración, los siete endpoints más `GET /api/claims/{id}`,
> cálculo en el servidor, cierre condicionado, reapertura, listado, ficha, impresión y la pestaña «Reclamación»
> del detalle del ticket. Lo que NO se construyó: el alta conjunta de ticket y reclamación desde
> `CreateTicketModal.tsx` (RF-R1 tal como está escrito), porque es el punto de integración que debe acordarse
> con el responsable de la Bandeja; mientras tanto la reclamación se registra desde la pestaña del ticket, en una
> segunda llamada. El toque a la Bandeja se limitó a esa pestaña (`TicketDetailPage.tsx`) y a una palabra en el
> tipo `TicketDetailTab`. Las rutas quedaron en `/reclamaciones`, no bajo `/calidad`, por la clave de lectura
> propia (sección 12).

## 1. Situación y objetivo

El formulario PF-FOR-034, «RECLAMACIONES DE CLIENTES», es el documento con el que Plastifar registra una
reclamación: quién reclama, qué producto, cuánto se facturó y cuánto se recibió, y cómo la trató Calidad. Hoy se
llena en una hoja de cálculo.

El sistema ya cubre parte de ese contenido repartido entre el ticket y la HCA: la empresa, el contacto, el
motivo, la causa raíz, las acciones y el cierre. Lo que falta es justamente lo que hace de una reclamación algo
cuantificable: los productos, el lote, las cantidades y el monto reclamado.

El objetivo es que la reclamación sea un registro estructurado ligado a su ticket, que se llene al abrirlo, que
Calidad complete su tratamiento y que pueda imprimirse con el formato controlado.

## 2. Alcance

**Incluye**

- Registro de la reclamación ligado a un ticket, con sus líneas de producto.
- Sección de tratamiento, reservada a Calidad.
- Cálculo de diferencias y totales en el servidor.
- Impresión con el formato del PF-FOR-034.

**No incluye**

- La versión en inglés del formulario. El archivo se llama «V3-ESP» y su única hoja es ` Español`; si existe una
  versión en otro idioma, no fue entregada.
- La emisión de la nota de crédito, que ya resuelven las solicitudes de crédito del módulo de Calidad.
- La firma del cliente: el formulario no la tiene.

## 3. Dependencias

- **00 Base común:** productos y plantas.
- **01 Organización y permisos:** departamentos de ventas que llenan el formulario.
- **02 Tareas y SLA:** la regla de enrutamiento `AlCrearTicket`. Puede construirse antes y conectarse después.

## 4. Fuente y trazabilidad

Archivo `PF-FOR-034 - Formulario Reclamaciones de Clientes-V3-ESP (2).xlsx`, hoja ` Español` (el nombre lleva un
espacio inicial). Rango usado A1:I62. Es una plantilla en blanco: sin listas desplegables, validaciones,
comentarios, macros ni hojas ocultas. Las opciones son casillas dibujadas, no controles.

Control documental, en el pie de página: `PF-FOR-034`, `Revisión No.:03`, `Sustituye a: 02`, `Ultima Revisión:
16-Oct-2024`, `Fecha de Creación: 03-May-2013`, y un campo `Emitido por:`.

| Sección del formulario | Celdas |
|---|---|
| Título `RECLAMACIONES DE CLIENTES` | A1:I1 |
| Encabezado: `Fecha de la Reclamación:`, `Código:` | F3, F4 |
| `I. Información General` | A5; campos en A6:I7 |
| `II. Información General sobre la Reclamación:` | A9; campos en A10:H38 |
| `III. Descripción de la Reclamación` | A39; área libre en filas 40 a 43; `Comentarios:` en A45 |
| `Nombre de quién recibe esta Reclamación:` | A46; campos en A47:A49 |
| `IV. Tratamiento de la Reclamación` · `Para uso exclusivo del Depto. de Calidad` | A51, A52; campos en A54:A62 |
| Reglas de quién lo llena | `PLAN-SLA-PERMISOS`, hoja `FORMULARIOS`, fila 2 |
| Plazo de respuesta | `PLAN-SLA-PERMISOS`, hoja `SLA`, fila 2 |

## 5. Lo que ya existe

La comparación se hizo sobre `src/types/*.ts` y una búsqueda por palabras clave; no se leyó cada pantalla línea
por línea.

| Campo del formulario | Dónde vive hoy | Cobertura |
|---|---|---|
| `Empresa:` | `Client.name` en `src/types/clients.ts:26`; `clientId` y `clientName` en el detalle del ticket (`src/types/api.ts:502`) | Completa cuando el ticket tiene cliente |
| `Contacto:`, `Teléfonos:` | `Contact` (:44) y `Client.phone` (:33) en `src/types/clients.ts`; `contactName` y `contactPhone` en el detalle del ticket (`src/types/api.ts:505`, :507) | Completa |
| `Código:`, `Fecha de la Reclamación:` | Número y fecha de creación del ticket | Aproximada |
| `Motivo del Reclamo:` | Catálogo de motivos (`src/pages/tickets/MotivosPage.tsx`, `MotivoModal.tsx`; backend `api/Models/Settings.cs:20-46` y `TicketTopicsController.cs`); es administrable, así que los cinco valores del formulario no están fijos en código | Aproximada |
| `Planta Involucrada : ` | Línea de producto (`productLineId`, `src/types/api.ts:510`; `src/api/productLines.ts`) | Aproximada; no es lo mismo |
| `Área Afectada:` | `departmentId` del ticket (`src/types/api.ts:508`) | Aproximada |
| Descripción (sección III) | `initialMessage` al crear el ticket (`CreateManualTicketRequest`, `src/types/api.ts:735`) | Completa |
| `Nombre:` de quien recibe | `createdByStaffName` del ticket (`src/types/api.ts:518`) | Aproximada |
| `Primera respuesta como corrección:` | `immediateAction` de la HCA | Solo si hay HCA |
| `Resultados del análisis Causa Raíz…` | `rootCause` de la HCA (`src/pages/quality/HcaModal.tsx`) | Solo si hay HCA |
| `Descripción de las acciones correctivas…` | `ActionPlanItem` (`src/pages/quality/ActionPlanItemModal.tsx`) | Solo si hay HCA |
| `Fecha de cierre…`, responsable del cierre | `closedAt` y `closedByName` de la HCA (`src/types/quality.ts:51`, :55); el ticket tiene su propio `closedAt` (`src/types/api.ts:525`) | Nombre, sin firma |
| `Tiempo de respuesta…` | Se deduce de `createdAt`, `firstResponseAt` (`src/types/api.ts:521`) y `closedAt`; no se guarda | Derivable |
| `Factura:`, `Total de la reclamacion: ` | Solo en `CreditRequest` (`invoiceRef`, `amount`, `currency`; `src/types/quality.ts:100-104`) | No en el ticket |
| `Se requiere acción correctiva:` | Implícito: existe o no una HCA ligada al ticket | Implícita |

**No existe en el sistema:** `País:`; `Producto/s:` y `Código/s:`; `Fecha de Producción  (# Lote):`; ` Número de
PO:`; las tres cantidades (compradas, defectuosa, a retornar); `Defecto Identificado Durante:`; la tabla
`Facturados` / ` Recibidos ` / ` Dif` / `Precio` / `Total`; `Fecha de primer contacto con el cliente:` como fecha
explícita; `¿Cliente Satisfecho?`; `Comentarios:`; y el texto libre de `Otros (especifique)`.

## 6. Modelo de datos

Todo el modelo de esta sección es **[Propuesta]**. La columna «Origen» indica la etiqueta literal del
formulario.

**CustomerClaim** — la reclamación. Una por ticket.

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `Id` | int | Identidad | — |
| `TicketId` | int | Obligatorio y único: una reclamación por ticket | Nota de `FORMULARIOS` |
| `ClaimDate` | date | Obligatoria | `Fecha de la Reclamación:` |
| `Country` | string(80)? | | `País:` |
| `Reason` | enum | `Sobrante` · `Faltante` · `Contaminacion` · `Cruce` · `Otros` | `Motivo del Reclamo:` |
| `ReasonOther` | string(200)? | Obligatorio si `Reason` es `Otros` | `Otros (especifique): ` |
| `AffectedAreas` | lista de enum | `Calidad` · `Almacen` · `Ventas`; al menos una | `Área Afectada:` |
| `ProductionLot` | string(80)? | Fecha de producción o número de lote, en un solo texto | `Fecha de Producción  (# Lote):` |
| `InvoiceRef` | string(40)? | | `Factura:` |
| `PoNumber` | string(40)? | | ` Número de PO:` |
| `UnitsToReturn` | decimal(14,2)? | Mayor o igual que cero | `Cantidad de Unidades a Retornar:` |
| `DefectFoundDuring` | enum? | `Recibo` · `Uso` | `Defecto Identificado Durante:` |
| `Currency` | string(3) | Código de moneda; obligatorio si alguna línea tiene precio | No está en el formulario |
| `TotalAmount` | decimal(14,2) | Calculado en el servidor | `Total de la reclamacion: ` |
| `Description` | text | Obligatoria | Sección III |
| `Comments` | text? | | `Comentarios:` |
| `ReceivedByStaffId` | int | Quién recibe la reclamación | `Nombre:` |
| `ReceivedAt` | date | | `Fecha:` |
| `FirstCustomerContactAt` | date? | | `Fecha de primer contacto con el cliente:` |
| `Status` | enum | `Registrada` · `EnTratamiento` · `Cerrada` | — |
| `FirstResponseCorrection` | text? | Solo Calidad | `Primera respuesta como corrección:` |
| `RequiresCorrectiveAction` | bool? | Solo Calidad | `Se requiere acción correctiva:` |
| `RootCauseAnalysis` | text? | Solo Calidad | `Resultados del análisis Causa Raíz de la reclamación: ` |
| `CorrectiveActions` | text? | Solo Calidad | `Descripción de las acciones correctivas y/o preventivas tomadas:` |
| `ClosedAt` | timestamptz? | Sello de cierre | `Fecha de cierre de la reclamación:` |
| `ClosedByStaffId` | int? | | `Nombre y firma del responsable del cierre:` |
| `CustomerSatisfied` | bool? | Solo Calidad | `¿Cliente Satisfecho?` |
| `Observations` | text? | | `Observaciones:` |
| `CreatedAt`, `UpdatedAt` | timestamptz | UTC | — |

`Empresa:`, `Contacto:` y `Teléfonos:` no se duplican: se leen del cliente y del contacto del ticket. El cliente
del ticket es opcional en el modelo actual (`api/Models/Ticket.cs:20`; `clientName: string | null` en
`src/types/api.ts:502`), de modo que el alta de la reclamación exige que el ticket tenga cliente y responde 409
si no lo tiene. `Código:` es el número del ticket (pregunta 3). `Tiempo de respuesta a la queja/reclamación:` no se guarda: se calcula entre
`ClaimDate` y `ClosedAt`.

**CustomerClaimPlant** — plantas involucradas: `ClaimId`, `PlantId`. Clave única sobre el par.

**CustomerClaimLine** — una línea por producto reclamado.

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `Id`, `ClaimId` | int | Borrado en cascada con la reclamación | — |
| `ProductId` | int | Referencia a `Product` | `Producto/s:` |
| `ProductCode`, `ProductName` | string | Copia en el momento de registrar | `Código/s:`, `Producto/s:` |
| `UnitsPurchased` | decimal(14,2)? | Mayor o igual que cero | `Cantidad de Unidades Compradas:` |
| `DefectiveQuantity` | decimal(14,2)? | Mayor o igual que cero | `Cantidad defectuosa:` |
| `InvoicedQuantity` | decimal(14,2)? | Mayor o igual que cero | `Facturados:` |
| `ReceivedQuantity` | decimal(14,2)? | Mayor o igual que cero | ` Recibidos :` |
| `UnitPrice` | decimal(14,4)? | Mayor o igual que cero | `Precio: ` |
| `Difference` | decimal(14,2) | Calculada: facturados menos recibidos | ` Dif: ` |
| `LineTotal` | decimal(14,2) | Calculada: diferencia por precio | `Total:` |
| `Position` | int | Orden dentro de la reclamación | — |

El formulario presenta los productos, las cantidades y la tabla de facturación en tres bloques separados de tres
renglones cada uno. Aquí se unen en una sola línea por producto, suponiendo que el primer renglón de cada bloque
se refiere al mismo artículo (pregunta 2).

**Índices obligatorios:** `CustomerClaim.TicketId` único; `CustomerClaim.Status`; `CustomerClaim.ClaimDate`;
`CustomerClaim.Reason`; `CustomerClaimLine.ClaimId`; `CustomerClaimLine.ProductId`; `CustomerClaimPlant.PlantId`.

## 7. Catálogos y datos semilla

Todos son **[Fuente]** y fijos en el formulario. Como las opciones son casillas dibujadas, la hoja no dice si en
cada grupo puede marcarse una o varias.

| Grupo | Opciones, tal como están | Celdas |
|---|---|---|
| `Planta Involucrada : ` | `Calimete`, `Clear`, `Cubiertos`, `PP`, `Termoformado Foam`, `Vasos Foam`, `Rígido`, `PVC`, `Pulpa` | A11:A14, D11:D15 |
| `Motivo del Reclamo:` | `Sobrante`, `Faltante`, `Contaminación`, `Cruce`, `Otros (especifique): ` con una línea de texto | G11:G15 |
| `Área Afectada:` | `Calidad`, `Almacén`, `Ventas` | A18, D18, G18 |
| `Defecto Identificado Durante:` | `Recibo:`, `Uso:` | E33, G33 |
| `Se requiere acción correctiva:` | `Si`, `No` | A55 |
| `¿Cliente Satisfecho?` | `Si`, `No` | A60 |

Las plantas se toman del catálogo del documento 00, con la correspondencia de su sección 7.3. Los demás grupos
se guardan como enumeraciones en texto legible.

## 8. Lógica de negocio

1. **[Fuente]** La sección IV es de uso exclusivo del Departamento de Calidad.
2. **[Fuente]** La diferencia de cada línea es facturados menos recibidos (`=A35-C35`), y el total de la línea
   es diferencia por precio (`=E35*G35`).
3. **[Abierta]** El total de la reclamación está escrito en la plantilla como `=SUM(H34:H36)`. Ese rango incluye
   la cabecera (texto, que se ignora) y deja fuera la tercera línea, H37. Se asume que es un error de la
   plantilla y que el total es la suma de **todas** las líneas (pregunta 1).
4. **[Fuente]** Lo llenan, al inicio del ticket, todos los agentes de PLASTIFAR CENTROAMERICA, VENTAS LOCALES y
   VENTAS INTERNACIONALES, con sus subdepartamentos (`FORMULARIOS`, fila 2).
5. **[Fuente]** El plazo de respuesta a una reclamación es de 30 días (`SLA`, fila 2). **[Abierta]** Cómo se
   mide —con la política de SLA del ticket o sobre la propia reclamación— está abierto en el documento 02
   (sección 7.3 y pregunta 5).
6. **[Propuesta]** Los cálculos se hacen en el servidor. La pantalla los muestra mientras se escribe, pero el
   valor guardado es el que calcula el servidor.
7. **[Propuesta]** Una reclamación tiene al menos una línea de producto y no tiene tope de líneas. El papel
   tiene tres renglones y el propio formulario admite ampliar la tabla.
8. **[Abierta]** Si una reclamación puede eliminarse. **[Fuente]** La matriz de permisos concede «Eliminar» solo
   sobre tickets y sobre tareas (hoja `PERMISOS`, filas 5 y 18); sobre los formularios no dice nada. El plan
   original establece que una HCA no se elimina nunca, por ser un registro de calidad (sección 10.3, regla 1);
   es una regla de negocio de la maqueta, escrita para otro registro, y aquí figura solo como opción. Opciones
   (pregunta 12): (a) no se elimina; si se abrió por error, se cierra con una observación que lo explique;
   (b) baja lógica auditada, con motivo, como la de tickets y tareas del documento 01 (sección 8, regla 9);
   (c) además, borrado físico en los casos que Plastifar indique. **Supuesto provisional de trabajo:** este
   módulo no crea ninguna acción ni clave de eliminación propia, porque la fuente no la concede. La reclamación
   sigue a su ticket: si el ticket recibe la baja lógica del documento 01, la reclamación deja de verse con él y
   se conserva en la base. Una reclamación abierta por error en un ticket que sigue vigente se cierra con
   observación.
9. **[Propuesta]** Si Calidad marca que se requiere acción correctiva, la reclamación no puede cerrarse hasta
   que exista una HCA ligada al mismo ticket. La HCA se abre desde la reclamación heredando el cliente.
10. **[Propuesta]** Para cerrar son obligatorios la primera respuesta, la decisión sobre la acción correctiva y
    la satisfacción del cliente. El sistema dice exactamente qué falta.
11. **[Propuesta]** Una reclamación cerrada no se edita. Para corregirla se reabre, y la reapertura queda en la
    bitácora.

### 8.1 Estados y transiciones

| Desde | Hacia | Quién y condición |
|---|---|---|
| (nueva) | `Registrada` | Al crearse junto con el ticket |
| `Registrada` | `EnTratamiento` | Personal con `claims.treat`, al guardar por primera vez algún campo de la sección IV |
| `EnTratamiento` | `Cerrada` | Personal con `claims.treat`; exige las condiciones de las reglas 9 y 10 |
| `Cerrada` | `EnTratamiento` | Personal con `claims.treat`; reapertura con motivo escrito |

Cualquier otra transición se responde con 409.

## 9. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-R1 | Al crear un ticket desde un departamento con la regla correspondiente, se presenta el formulario de reclamación y se guarda junto con el ticket |
| RF-R2 | La reclamación admite una o más líneas de producto, elegidas del catálogo, con cálculo de diferencia y total en vivo |
| RF-R3 | Selección de una o varias plantas involucradas y de una o varias áreas afectadas |
| RF-R4 | El detalle del ticket muestra la reclamación en una pestaña propia, con sus secciones I a IV |
| RF-R5 | La sección IV solo puede editarla quien tiene el permiso de tratamiento; los demás la ven en modo lectura |
| RF-R6 | Cierre de la reclamación con las validaciones de la sección 8, y reapertura con motivo |
| RF-R7 | Apertura de una HCA desde la reclamación cuando se requiere acción correctiva, con vínculo visible en ambos sentidos |
| RF-R8 | Listado paginado de reclamaciones con pastillas por estado y filtros por motivo, planta, cliente y rango de fechas |
| RF-R9 | Impresión de la reclamación con el formato y el control documental del PF-FOR-034 |
| RF-R10 | Toda escritura queda en la bitácora |

## 10. Endpoints

| Método y ruta | Descripción | Permiso |
|---|---|---|
| `GET /api/claims` | Listado paginado con filtros, orden y contadores | `claims.read` |
| `GET /api/tickets/{id}/claim` | Reclamación del ticket, con líneas y plantas | `claims.read` |
| `POST /api/tickets/{id}/claim` | Alta; 409 si el ticket ya tiene una | `claims.write` |
| `PUT /api/claims/{id}` | Edición de las secciones I a III y de las líneas | `claims.write` |
| `PUT /api/claims/{id}/treatment` | Edición de la sección IV | `claims.treat` |
| `POST /api/claims/{id}/close` | Cierre | `claims.treat` |
| `POST /api/claims/{id}/reopen` | Reapertura con motivo | `claims.treat` |
| `GET /api/claims/{id}` | Ficha por identificador propio, para la ruta `/reclamaciones/{id}`. No estaba en la propuesta; se añadió al construir | `claims.read` |

El alta conjunta de ticket y reclamación debe ocurrir en una sola transacción; cómo se expone (un solo endpoint
o dos llamadas) se acuerda con el responsable de la Bandeja. **Construido:** dos llamadas. La reclamación se
registra sobre un ticket que ya existe; el alta en una sola transacción queda para cuando se acuerde la
integración con `CreateTicketModal.tsx`.

**Construido, además de la tabla:** toda escritura exige su clave sobre el departamento del ticket, no solo «en
algún departamento»; un ticket que no se ve responde 404; cada 403 nombra la clave que falta; `GET /api/claims`
acota el listado a los departamentos donde se tiene `claims.read` (más los tickets sin departamento, como el
listado de tickets); la ficha devuelve `closureConditions` y `canClose` calculados en el servidor, como la HCA.
El 409 de cierre lleva, además del mensaje, la lista `missing` con los identificadores de lo que falta.

## 11. Pantallas

- **Alta de ticket** (`CreateTicketModal.tsx`): cuando aplica la regla, el diálogo incorpora las secciones I a
  III del formulario como un paso más. **No construido:** pendiente de acordar con el responsable de la Bandeja.
- **Detalle del ticket:** pestaña «Reclamación» con las cuatro secciones. La sección IV se distingue como zona de
  Calidad con un encabezado propio. **Construido con una variante:** la pestaña (`src/pages/claims/TicketClaimTab.tsx`)
  muestra el resumen y el botón «Registrar reclamación», que abre el formulario de las secciones I a III
  (`ClaimFormModal.tsx`); las cuatro secciones completas viven en la ficha propia, enlazada desde la pestaña.
  Así la Bandeja recibe un componente cerrado y no un bloque de cuatro secciones dentro de su página.
- **Listado de reclamaciones:** estructura estándar; columnas número de ticket, cliente, fecha, motivo, total y
  estado. **Construido** en `/reclamaciones` (`ClaimsPage.tsx`), con pastillas por estado, filtros por motivo,
  planta, cliente y rango de fechas, y orden por ticket, cliente, fecha y total. Sin botón «Nueva»: la reclamación
  nace del ticket.
- **Ficha** (`/reclamaciones/{id}`, `ClaimDetailPage.tsx`): las cuatro secciones, editar (I a III), tratamiento
  (IV, solo con `claims.treat`; los demás la leen), cerrar con la lista de lo que falta, reabrir con motivo y
  «Abrir HCA» cuando se requiere acción correctiva, que abre `HcaModal` heredando cliente y ticket (RF-R7). La
  HCA ligada se enlaza desde la ficha y desde la pestaña del ticket; del lado de la HCA, el vínculo es el número
  del ticket que ya muestra.
- **Vista de impresión:** página con hoja de estilos de impresión que reproduce la distribución del PF-FOR-034,
  sin dependencias nuevas. **Construida** en `/reclamaciones/{id}/imprimir` (`ClaimPrintPage.tsx`), fuera del
  armazón de la aplicación para que la barra lateral no salga en el papel; se abre en pestaña nueva y lanza el
  diálogo de impresión sola. Con menos de tres líneas rellena los renglones vacíos del papel; con más, sigue.
- Componentes: `Modal`, `FormSection`, `Field`, `Select`, `LookupSelect` para el producto, `DatePicker`,
  `DetailTable` para las líneas, `DataTable`, `FilterChip`, `Pagination`, `Badge`, `ConfirmDialog`, `Alert`.

## 12. Permisos

**[Propuesta]** Se añade el grupo «Reclamaciones» al catálogo. **Construido.** Como la hoja `PERMISOS` no tiene
fila para los formularios, la carga inicial (`OrganizationSeeder`) concede `claims.read` y `claims.write` a los
tres roles en uso, porque los agentes de ventas que llenan el formulario tienen cualquiera de los tres, y
`claims.treat` solo a ALL ACCESS hasta que Plastifar responda la pregunta 13. La migración
`AddFormModules` (consolidada en `feature/formularios`) aplica el mismo criterio a los roles ya guardados: lectura y escritura a quien tiene
`tickets.read`, tratamiento a quien tiene `quality.write`. Es un supuesto provisional, no una regla de Plastifar.

| Clave | Permite | Requiere |
|---|---|---|
| `claims.read` | Ver las reclamaciones de sus departamentos | — |
| `claims.write` | Registrar y editar las secciones I a III | `claims.read` |
| `claims.treat` | Completar la sección IV, cerrar y reabrir | `claims.read` |

La regla que aquí se heredaba del plan original (sección 9.8) mezcla dos cosas distintas, y se separan:

- **Código de respuesta: estándar técnico vigente.** Cuando alguien pide por identificador directo un registro
  que no puede ver, el servidor responde 404 y no 403, para no revelar que existe. Es una convención de
  seguridad, no una regla de proceso; las hojas de cálculo no la tocan y se aplica a la reclamación.
- **[Abierta]** **Quién puede ver una reclamación.** Esto sí es regla de negocio. El plan original lo resuelve
  con visibilidad estricta por departamento. Los datos reales introducen algo que la maqueta no tenía: cada
  departamento es PUBLICO o PRIVADO (31 y 7), y qué significa ese tipo no está definido (documento 01, preguntas
  6 y 16). Si PUBLICO quiere decir que otros departamentos ven sus tickets, la visibilidad estricta no vale.
  Hay además un caso propio de este formulario: lo llena Ventas y la sección IV es de Calidad, de modo que
  Calidad necesita ver reclamaciones de tickets que nacen en departamentos de ventas (pregunta 13).

**Supuesto provisional de trabajo:** la reclamación se ve con las mismas reglas con que hoy se ve su ticket,
porque es lo construido; no se añade ninguna regla de visibilidad propia hasta tener las respuestas.

## 13. Validación

Reglas espejo entre Zod y el servidor.

| Campo | Regla |
|---|---|
| `ClaimDate` | Obligatoria; no posterior a hoy |
| `Reason` | Obligatorio; si es `Otros`, `ReasonOther` es obligatorio, de 3 a 200 caracteres |
| Plantas | Al menos una |
| `AffectedAreas` | Al menos una |
| `Description` | Obligatoria, de 20 a 4000 caracteres |
| Líneas | Al menos una; producto activo; no se repite el mismo producto |
| Cantidades y precio | Números mayores o iguales que cero; hasta dos decimales en cantidades y cuatro en precio |
| `ReceivedQuantity` | Puede ser mayor que `InvoicedQuantity`: un sobrante da diferencia negativa |
| `Currency` | Obligatoria si alguna línea tiene precio |
| `FirstCustomerContactAt` | No anterior a `ClaimDate` |
| Cierre | Primera respuesta, decisión de acción correctiva y satisfacción del cliente, obligatorias |

## 14. Criterios de aceptación

- [ ] Un ticket creado desde VENTAS LOCALES / ZONA SUR presenta el formulario de reclamación. **Pendiente:**
      depende de la integración con el alta de tickets (sección 11). Hoy el formulario se presenta en la pestaña
      «Reclamación» de cualquier ticket cuyo departamento conceda `claims.write`.
- [x] Con tres líneas, el total de la reclamación es la suma de las tres, no de las dos primeras
      (`ClaimRulesTests`, `ClaimsControllerTests.Update_replaces_lines_and_plants_and_recomputes_the_total`).
- [x] Una línea con 100 facturados, 90 recibidos y precio 12,50 da diferencia 10 y total 125,00
      (`ClaimsControllerTests.Create_computes_the_lines_and_the_total_on_the_server`).
- [x] Un usuario sin `claims.treat` ve la sección IV en modo lectura y recibe 403 al intentar guardarla por API
      (`ClaimsControllerTests.Treatment_needs_claims_treat_and_moves_the_claim_to_in_treatment`; la pantalla
      esconde «Tratamiento» y rotula la sección como solo lectura).
- [x] Marcar «Se requiere acción correctiva: Sí» impide cerrar hasta que exista una HCA ligada
      (`ClaimsControllerTests.Closing_requires_an_hca_when_corrective_action_is_required`).
- [x] Intentar crear una segunda reclamación en el mismo ticket devuelve 409 con mensaje claro, que nombra el
      ticket (`ClaimsControllerTests.A_second_claim_on_the_same_ticket_is_rejected_with_409`).
- [x] La impresión muestra el código PF-FOR-034, la revisión y el número del ticket. Comprobado en el código de
      `ClaimPrintPage.tsx`; sin prueba automática, el frontend no tiene corredor de pruebas.
- [ ] Cumple la lista de verificación de cierre de la sección 4.5 del plan original. **Por revisar** en la revisión
      cruzada; la migración `AddFormModules` está aplicada en Postgres 17 local el 23 de octubre de 2026, desde el estado anterior a los módulos y sobre datos de prueba;
      falta aplicarla en Railway.

## 15. Riesgos

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| Doble registro de causa raíz y acciones, en la reclamación y en la HCA | Dos versiones de lo mismo | Decidir la pregunta 5; mientras tanto, la reclamación guarda un resumen y enlaza la HCA |
| Motivo de la reclamación y motivo del ticket son dos catálogos | Reportes inconsistentes | Decidir la pregunta 4 |
| El formulario presupone tres productos | Reclamaciones grandes no caben en la impresión | La vista de impresión añade páginas |
| Se integra en el alta de tickets de otro responsable | Conflicto de edición | Acordar el punto de integración antes de empezar |
| Sin maestro de productos | No puede probarse con datos reales | Depende del documento 00, pregunta 2 |
| Visibilidad sin definir | Calidad no puede llenar la sección IV de una reclamación que nace en un departamento de ventas al que no tiene acceso | Resolver la pregunta 13 antes de entregar el tratamiento |

## 16. Preguntas abiertas para Plastifar

La última columna es siempre un supuesto provisional de trabajo de este plan, nunca una regla de Plastifar ni
del plan original (README, sección 2).

| # | Pregunta | Opciones | Se asume mientras tanto |
|---|---|---|---|
| 1 | El total de la plantilla suma `H34:H36` y deja fuera la tercera línea. ¿Es un error? | (a) sí, debe sumar todas las líneas; (b) no, es intencional | (a) |
| 2 | Los productos, las cantidades compradas y defectuosas, y la tabla de facturados y recibidos, ¿se refieren a las mismas líneas? | (a) sí, una línea por producto; (b) son bloques independientes | (a) |
| 3 | ¿El `Código:` de la reclamación es el número del ticket o tiene numeración propia? | (a) el número del ticket; (b) secuencia propia | (a) |
| 4 | ¿El `Motivo del Reclamo:` sustituye al motivo del ticket o conviven? | (a) conviven; (b) el motivo del ticket se limita a estos cinco para las reclamaciones | (a) |
| 5 | Si la reclamación requiere acción correctiva, ¿la causa raíz y las acciones se escriben en la reclamación, en la HCA o en ambas? | (a) solo en la HCA, y la reclamación las muestra; (b) en ambas | (b): la reclamación guarda su propio texto y enlaza la HCA |
| 6 | ¿Pueden marcarse varias plantas, varios motivos o varias áreas afectadas? | Por grupo: una o varias | Varias plantas y áreas; un solo motivo; una sola opción en «Defecto Identificado Durante» |
| 7 | ¿En qué moneda se expresan `Precio:` y `Total:`? | (a) siempre una misma; (b) depende del cliente | Se elige por reclamación |
| 8 | `Fecha de Producción  (# Lote):` es un solo renglón. ¿Es una fecha, un número de lote o ambos? | — | Texto libre |
| 9 | ¿Debe agregarse `País:` a la ficha del cliente? | (a) sí; (b) solo en la reclamación | (b) |
| 10 | `Tiempo de respuesta a la queja/reclamación:` ¿se mide desde la fecha de la reclamación hasta el cierre, o hasta el primer contacto? ¿En qué unidad? | — | Días entre la fecha de la reclamación y el cierre |
| 11 | ¿Existe una versión del formulario en otro idioma que también deba incorporarse? | — | No |
| 12 | ¿Puede eliminarse una reclamación? La matriz de permisos solo concede «Eliminar» sobre tickets y tareas | (a) no; si se abrió por error se cierra con una observación; (b) sí, como baja lógica auditada con motivo, y Plastifar indica qué rol puede hacerlo; (c) además, borrado físico en los casos que indique | Supuesto provisional de trabajo: no hay eliminación propia ni clave nueva; la reclamación deja de verse si su ticket recibe la baja lógica del documento 01 |
| 13 | ¿Quién puede ver una reclamación? En particular, ¿Calidad ve las reclamaciones de tickets que pertenecen a departamentos de ventas, para llenar la sección IV? Depende también de qué significa que un departamento sea PUBLICO o PRIVADO (documento 01, pregunta 6) | (a) solo quien ve el ticket; (b) además, Calidad, todas; (c) además, cualquier departamento cuando el del ticket es PUBLICO | Supuesto provisional de trabajo: (a), que es como está construido el código |
