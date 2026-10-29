# 04 · Módulo: Retiro de mercancía (PF-FOR-068)

Panel interno Plastifar · Plan de construcción · Ampliación v0.1 · 11 de octubre de 2026

**Responsable:** Por asignar  ·  **Prioridad:** cuarta entrega  ·  **Tablas nuevas:** `MerchandiseWithdrawal`, `MerchandiseWithdrawalLine`

Marcas usadas: **[Fuente]**, **[Propuesta]**, **[Abierta]**. Ver [README](README.md), sección 2.

> **Módulo de otro responsable.** El formulario se llena al crear el ticket y se consulta desde una tarea; ambos
> puntos pertenecen a la Bandeja de tickets (sección 9 del plan original, Richard De León). La integración debe
> acordarse con su responsable.

> **Estado (29 de octubre de 2026).** Construido en `main` de ambos repositorios (backend `d3dfec7` y
> correcciones, frontend `d02f67a`), bajo los supuestos provisionales de la sección 16: modelo y migración
> `AddMerchandiseWithdrawals`; los endpoints `GET /api/withdrawals`, `GET /api/withdrawals/{id}`,
> `GET|POST /api/tickets/{ticketId}/withdrawals`, `PUT /api/withdrawals/{id}` y `POST …/decision`, `…/complete` y
> `…/cancel`; valores y total calculados en el servidor; aprobación exigida solo cuando el origen es un error; aviso
> al solicitante en cada cambio de estado hecho por otro; cambios concurrentes detectados con `xmin` y respondidos
> con 409; las claves `withdrawals.*`, que la lectura exige sobre el departamento del ticket; y las pantallas
> `/retiros` (listado con pastillas de estado y filtros), ficha y la impresión horizontal en
> `/retiros/{id}/imprimir`. Solo puede registrar un retiro el departamento con una regla de enrutamiento activa
> para este formulario al crear el ticket, y la heredan sus subdepartamentos. **No construido, a propósito:**
> llenarlo desde el alta del ticket (`CreateTicketModal.tsx`) y abrirlo desde la tarea de Almacén: es la Bandeja y
> depende del documento 02. Mientras tanto la solicitud se crea desde el listado eligiendo el ticket, o desde
> la pestaña «Formularios» del ticket (`TicketFormsTab`, de la Bandeja, 22 de octubre de 2026), que lista los retiros del ticket. La migración está aplicada en Postgres 17 local el 23 de octubre de 2026, desde el estado anterior a los módulos y sobre datos de prueba;
> falta aplicarla en Railway.

## 1. Situación y objetivo

El formulario PF-FOR-068, «SOLICITUD RETIRO DE MERCANCIA», autoriza recoger producto en las instalaciones de un
cliente, por devolución o por cambio. Lo firman el vendedor, el almacén y el cliente.

El sistema no tiene nada equivalente. De todo el formulario solo existen el nombre de la empresa y, de forma
aproximada, el vendedor asignado al cliente.

El objetivo es que la solicitud sea un registro ligado a su ticket, que la llene Ventas Locales al abrirlo, que
pase por su aprobación, y que Almacén la consulte e imprima desde su tarea para ejecutar el retiro.

## 2. Alcance

**Incluye**

- Registro de la solicitud con sus líneas de producto.
- Aprobación y registro del retiro efectuado.
- Consulta e impresión desde la tarea de Almacén, con el formato del PF-FOR-068.

**No incluye**

- La programación del transporte (conductor, vehículo, hora). El archivo contiene listas de otro formulario,
  PF-FOR-056, con esos datos, pero el PF-FOR-068 no las usa (ver README, sección 7).
- El movimiento de inventario que resulta del retiro.
- La nota de crédito o el cambio de producto posteriores.

## 3. Dependencias

- **00 Base común:** productos.
- **02 Tareas y SLA:** tipos de tarea «RETIRO DE MERCANCIA» y las dos aprobaciones de retiros, y las reglas de
  enrutamiento. Puede construirse antes como registro ligado al ticket y conectarse a la tarea después.

## 4. Fuente y trazabilidad

Archivo `PF-FOR-068 - Solicitud Retiro de Mercancia (1).xlsx`, hoja `FR-Retiro de Mercancia`. Rango usado
A1:N41; área de impresión A1:N32, horizontal. Sin listas desplegables, validaciones, comentarios, macros ni
fórmulas.

**El archivo no es una plantilla en blanco: es un formulario lleno.** Trae una empresa, una fecha, tres líneas de
producto y el nombre de un vendedor. Esos valores son datos de un caso real y no se copian a este documento;
solo se toma la estructura.

Control documental, en el pie de página: `PF-FOR-068`, `Revisión: 00`, `Sustituye a: N/A`, `Ultima revisión:
11-Junio-2013`, `Fecha de emisión: 11-Junio-2013`, y un campo `Emitido por:`.

| Elemento del formulario | Celdas |
|---|---|
| Título `SOLICITUD RETIRO DE MERCANCIA ` | A5:N5 |
| `Nombre Empresa` | A6:B6, valor en C6:G6 |
| `FECHA`, con `DIA`, `MES`, `AÑO` | I7:N7; I8, K8, N8; valores en la fila 9 |
| `Por Devolución`, `Por Cambio` | A8, A9; casillas dibujadas en B8 y B9 |
| Cabecera de líneas: `CODIGO`, `CANT.`, `UNID`, `DESCRICION`, `P. UNIT.`, `VALOR` | Fila 12 |
| Líneas | Filas 13 a 27 (15 renglones) |
| Firmas: `Vendedor`, `Almacén`, `Cliente` | B31, E31, I31; línea de firma en la fila 30 |
| Quién lo llena y quién lo consulta | `PLAN-SLA-PERMISOS`, hoja `FORMULARIOS`, filas 3 y 4 |
| Plazos | `PLAN-SLA-PERMISOS`, hoja `SLA`, filas 4, 14 y 15 |

La cabecera `DESCRICION` está escrita así en el original; el valor correcto es «DESCRIPCIÓN».

## 5. Lo que ya existe

| Campo del formulario | Dónde vive hoy | Cobertura |
|---|---|---|
| `Nombre Empresa` | `Client.name` en `src/types/clients.ts:26` | Completa |
| `Vendedor` | `Client.salesRepStaffId` en `src/types/clients.ts:32` | Aproximada: es el vendedor del cliente, no quien firma la solicitud |
| Todo lo demás | — | **No existe.** No hay registro de retiro, ni motivo, ni líneas, ni firmas. La búsqueda de «retiro» y «withdraw» en modelos, controladores, DTO y servicios del backend, y en `src` del frontend, no arrojó resultados |

## 6. Modelo de datos

Todo el modelo de esta sección es **[Propuesta]**.

**MerchandiseWithdrawal** — la solicitud.

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `Id` | int | Identidad | — |
| `Number` | string(12) | Visible, secuencial y único; nunca se reutiliza | — |
| `TicketId` | int | Obligatorio | Nota de `FORMULARIOS` |
| `TaskId` | int? | Tarea de retiro asociada | Nota de `FORMULARIOS` |
| `ClientId` | int | Se hereda del ticket. El cliente del ticket es opcional en el modelo actual (`api/Models/Ticket.cs:20`); si el ticket no lo tiene, el alta responde 409 | `Nombre Empresa` |
| `RequestDate` | date | Obligatoria | `FECHA` |
| `Reason` | enum | `PorDevolucion` · `PorCambio` | `Por Devolución`, `Por Cambio` |
| `ErrorOrigin` | enum? | `Vendedor` · `Almacen` | Hoja `SLA`, filas 14 y 15 |
| `Currency` | string(3)? | Obligatoria si alguna línea tiene precio | No está en el formulario |
| `TotalValue` | decimal(14,2) | Calculado en el servidor | — |
| `Status` | enum | `Solicitado` · `Aprobado` · `Rechazado` · `Retirado` · `Cancelado` | — |
| `RequestedByStaffId` | int | Quien firma como vendedor | `Vendedor` |
| `DecidedByStaffId`, `DecidedAt`, `DecisionNote` | int? · timestamptz? · text? | Aprobación o rechazo | Hoja `SLA`, filas 14 y 15 |
| `WarehouseStaffId`, `WithdrawnAt` | int? · timestamptz? | Quien ejecuta el retiro y cuándo | `Almacén` |
| `CustomerSignerName` | string(160)? | Persona del cliente que entrega | `Cliente` |
| `CreatedAt`, `UpdatedAt` | timestamptz | UTC | — |

**MerchandiseWithdrawalLine** — una línea por producto.

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `Id`, `WithdrawalId` | int | Borrado en cascada con la solicitud | — |
| `ProductId` | int | Referencia a `Product` | `CODIGO` |
| `ProductCode`, `ProductName` | string | Copia en el momento de registrar | `CODIGO`, `DESCRICION` |
| `Quantity` | decimal(14,2) | Mayor que cero | `CANT.` |
| `QuantityUnit` | string(10) | Unidad de la cantidad | `CANT.` |
| `WithdrawnQuantity` | decimal(14,2)? | Cantidad efectivamente recogida; se llena al registrar el retiro | — |
| `PackDetail` | string(20)? | Contenido o segunda unidad | `UNID` |
| `UnitPrice` | decimal(14,4)? | Mayor o igual que cero | `P. UNIT.` |
| `LineValue` | decimal(14,2)? | Calculado: cantidad por precio | `VALOR` |
| `Position` | int | Orden | — |

En el ejemplo lleno, las columnas `CANT.` y `UNID` contienen cada una un número seguido de una abreviatura de
unidad. Parece una cantidad en una unidad y un contenido en otra, pero el formulario no lo explica (pregunta 2).
Por eso `PackDetail` se deja como texto.

**Índices obligatorios:** `Number` único; `TicketId`; `TaskId`; `ClientId`; `Status`; `RequestDate`;
`RequestedByStaffId`; `MerchandiseWithdrawalLine.WithdrawalId`; `MerchandiseWithdrawalLine.ProductId`.

## 7. Catálogos y datos semilla

| Grupo | Opciones | Origen |
|---|---|---|
| Motivo del retiro | `Por Devolución`, `Por Cambio` | **[Fuente]** A8, A9. El grupo no tiene título impreso |
| Origen del error | `Vendedor`, `Almacén` | **[Propuesta]**, deducida de dos acciones de la hoja `SLA`; el formulario no lo tiene |

No hay datos semilla. Los valores del ejemplo lleno no se usan.

## 8. Lógica de negocio

1. **[Fuente]** La solicitud la llenan, al inicio del ticket, todos los agentes de VENTAS LOCALES y de sus nueve
   subdepartamentos (`FORMULARIOS`, fila 3).
2. **[Fuente]** Almacén la ve y la imprime desde una tarea (`FORMULARIOS`, fila 4).
3. **[Fuente]** Plazos de la hoja `SLA`: «RETIRO DE MERCANCIA», 15 días, Almacén; «APROBACION DE RETIROS X
   ERRORES VEND», 1 día, Ventas Locales; «APROBACION DE RETIROS X ERRORES DE ALMACEN», 1 día, Almacén.
4. **[Fuente]** El formulario lleva tres firmas: vendedor, almacén y cliente.
5. **[Abierta]** El formulario no tiene fórmulas: `VALOR` no se calcula y no hay renglón de total. Se asume que
   el valor de la línea es cantidad por precio unitario y que el total es la suma de las líneas.
6. **[Abierta]** Las dos acciones de aprobación de la hoja `SLA` implican que un retiro puede deberse a un error
   del vendedor o del almacén y que en esos casos requiere aprobación. El formulario no recoge ese dato. Se
   asume que, cuando se indica el origen del error, la solicitud necesita aprobación antes del retiro, y que la
   aprueba el departamento que la hoja señala (pregunta 1).
7. **[Abierta]** Si quien solicita puede aprobar su propia solicitud. La fuente no lo dice, y este plan no lo
   da por regla. El plan original exige esa separación para los créditos (sección 10.3, regla 5), pero es una
   regla de negocio de la maqueta y aquí figura solo como opción. La evidencia de la operación real apunta en
   otra dirección: la hoja `SLA` nombra a la misma persona, MARTA SEBASTIAN, como responsable de «RETIRO DE
   MERCANCIA» (fila 4) y de «APROBACION DE RETIROS X ERRORES DE ALMACEN» (fila 15, junto con una segunda
   persona). Esa evidencia no es concluyente: la fila 4 nombra a quien ejecuta el retiro en Almacén, no a quien
   lo solicita en Ventas; lo que muestra es que la fuente no separa por persona la ejecución de la aprobación.
   Opciones: (a) no hay restricción, aprueba quien tenga el permiso; (b) quien solicita no puede aprobar lo
   suyo; (c) además, quien aprueba no puede ser quien ejecuta el retiro. Mientras no haya respuesta, el servidor
   no valida ninguna separación (pregunta 9).
8. **[Propuesta]** Una solicitud aprobada o retirada no se edita. Para cambiarla se cancela con motivo y se crea
   otra.
9. **[Abierta]** Si una solicitud puede eliminarse. **[Fuente]** La matriz de permisos concede «Eliminar» solo
   sobre tickets y sobre tareas (hoja `PERMISOS`, filas 5 y 18); sobre los formularios no dice nada, y el
   PF-FOR-068 tampoco. Este plan no inventa una clave de eliminación que la fuente no concede, y tampoco da por
   regla que la solicitud no se elimine. **[Propuesta]** El tratamiento es el mismo que el documento 01 da a
   tickets y tareas (sección 8, regla 9): si Plastifar confirma que hace falta eliminar solicitudes, se
   implementa como baja lógica auditada, con actor, fecha y motivo; el borrado físico es la pregunta que queda
   abierta (pregunta 10). **Supuesto provisional de trabajo:** no hay eliminación propia. Una solicitud hecha
   por error se cancela con motivo escrito y queda visible como cancelada; y la solicitud sigue a su ticket: si
   el ticket recibe la baja lógica del documento 01, deja de verse con él y se conserva en la base.
10. **[Propuesta]** Al registrar el retiro, Almacén confirma las cantidades efectivamente recogidas. Si difieren
    de las solicitadas, se guarda la cantidad real por línea y la diferencia queda visible.
11. **[Propuesta]** El papel tiene 15 renglones; el sistema no pone tope y la impresión añade páginas.

### 8.1 Estados y transiciones

| Desde | Hacia | Quién y condición |
|---|---|---|
| (nueva) | `Solicitado` | Al crearse junto con el ticket |
| `Solicitado` | `Aprobado` | Personal con `withdrawals.approve`. Si además debe ser distinto del solicitante está abierto (regla 7) |
| `Solicitado` | `Rechazado` | Personal con `withdrawals.approve`; exige nota |
| `Solicitado` | `Retirado` | Personal de Almacén con `withdrawals.write`, solo si la solicitud no requiere aprobación |
| `Aprobado` | `Retirado` | Personal de Almacén con `withdrawals.write`; sella `WithdrawnAt` |
| `Solicitado`, `Aprobado` | `Cancelado` | Personal con `withdrawals.write`; exige motivo |
| `Rechazado`, `Retirado`, `Cancelado` | — | Estados finales |

Cualquier otra transición se responde con 409.

## 9. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-W1 | Al crear un ticket desde Ventas Locales o sus subdepartamentos puede llenarse la solicitud de retiro, que se guarda junto con el ticket |
| RF-W2 | La solicitud admite una o más líneas de producto del catálogo, con cantidad, unidad y precio opcional |
| RF-W3 | Aprobación y rechazo con nota, restringidos a quien tiene el permiso. **[Abierta]** Si se excluye al solicitante depende de la pregunta 9 |
| RF-W4 | Desde la tarea de retiro, Almacén consulta la solicitud y la imprime con el formato PF-FOR-068 |
| RF-W5 | Registro del retiro efectuado, con cantidades reales y nombre de quien entrega por parte del cliente |
| RF-W6 | Listado paginado de solicitudes con pastillas por estado y filtros por cliente, vendedor, motivo y rango de fechas |
| RF-W7 | El detalle del ticket muestra la solicitud y su estado |
| RF-W8 | Aviso por correo al solicitante en cada cambio de estado |
| RF-W9 | Toda escritura queda en la bitácora |

## 10. Endpoints

| Método y ruta | Descripción | Permiso |
|---|---|---|
| `GET /api/withdrawals` | Listado paginado con filtros, orden y contadores | `withdrawals.read` |
| `GET /api/withdrawals/{id}` | Detalle con líneas | `withdrawals.read` |
| `GET /api/tickets/{id}/withdrawals` | Solicitudes del ticket | `withdrawals.read` |
| `POST /api/tickets/{id}/withdrawals` | Alta | `withdrawals.write` |
| `PUT /api/withdrawals/{id}` | Edición mientras esté en `Solicitado` | `withdrawals.write` |
| `POST /api/withdrawals/{id}/decision` | Aprobar o rechazar, con nota | `withdrawals.approve` |
| `POST /api/withdrawals/{id}/complete` | Registrar el retiro efectuado | `withdrawals.write` |
| `POST /api/withdrawals/{id}/cancel` | Cancelar con motivo | `withdrawals.write` |

## 11. Pantallas

- **Alta de ticket:** paso adicional con el formulario cuando aplica la regla.
- **Detalle del ticket:** pestaña «Retiro de mercancía».
- **Tarea de retiro:** acceso a la solicitud en modo lectura, con las acciones «Imprimir» y «Registrar retiro».
- **Listado de solicitudes:** estructura estándar; columnas número, cliente, fecha, motivo, valor y estado.
- **Vista de impresión:** reproduce la distribución del PF-FOR-068, con las tres líneas de firma, sin
  dependencias nuevas.
- Componentes: `Modal`, `FormSection`, `Field`, `Select`, `LookupSelect`, `DatePicker`, `DetailTable`,
  `DataTable`, `FilterChip`, `Pagination`, `Badge`, `ConfirmDialog`, `Alert`.

## 12. Permisos

**[Propuesta]** Se añade el grupo «Retiros» al catálogo.

| Clave | Permite | Requiere |
|---|---|---|
| `withdrawals.read` | Ver las solicitudes de sus departamentos | — |
| `withdrawals.write` | Crear, editar, cancelar y registrar el retiro | `withdrawals.read` |
| `withdrawals.approve` | Aprobar o rechazar. Si alcanza a lo que uno mismo solicitó está abierto (pregunta 9) | `withdrawals.read` |

La visibilidad sigue al ticket y a la tarea: la ven quienes pueden ver el ticket y quienes tienen asignada la
tarea de retiro o pertenecen a su departamento.

## 13. Validación

Reglas espejo entre Zod y el servidor.

| Campo | Regla |
|---|---|
| `RequestDate` | Obligatoria |
| `Reason` | Obligatorio |
| Líneas | Al menos una; producto activo; no se repite el mismo producto |
| `Quantity` | Mayor que cero; hasta dos decimales |
| `QuantityUnit` | Obligatoria, de 1 a 10 caracteres |
| `UnitPrice` | Opcional; mayor o igual que cero |
| `Currency` | Obligatoria si alguna línea tiene precio |
| Decisión | La nota es obligatoria al rechazar, de 10 a 500 caracteres. No se valida que quien decide sea distinto de quien solicitó: esa separación es una opción pendiente de la pregunta 9, no una regla |
| Cancelación | Motivo obligatorio, de 10 a 500 caracteres |
| Registro del retiro | Cantidad real por línea, mayor o igual que cero; `CustomerSignerName` obligatorio |

## 14. Criterios de aceptación

- [ ] Un ticket creado desde VENTAS LOCALES / HAITI permite llenar la solicitud; uno creado desde CALIDAD, no.
- [ ] Almacén abre la solicitud desde su tarea y la imprime con el código PF-FOR-068 y el número del ticket.
- [x] Un usuario sin `withdrawals.approve` recibe 403 al intentar aprobar o rechazar una solicitud
      (`WithdrawalsControllerTests`, prueba marcada «Criterio 3»; el 403 nombra la clave).
- [ ] Solo si Plastifar confirma la separación (pregunta 9, opción b o c): el solicitante recibe 409 con mensaje
      claro al intentar aprobar su propia solicitud. Mientras la pregunta siga abierta, este criterio no aplica.
- [x] Una solicitud en `Retirado` no admite edición ni por la interfaz ni por API
      (`WithdrawalsControllerTests.A_rejected_one_is_final_and_a_withdrawn_one_cannot_be_edited_cancelled_or_withdrawn_again`;
      la ficha muestra las acciones según `canEdit` y los demás permisos que manda el servidor).
- [x] Una línea con cantidad 3 y precio 250,00 da valor 750,00, y el total es la suma de las líneas
      (`WithdrawalsControllerTests.Create_inherits_the_client_copies_the_product_and_computes_values_and_total`).
- [x] El listado responde en menos de 300 ms con 10 000 solicitudes de prueba. Medido el 23 de octubre de 2026
      en Postgres 17 local, llamando al controlador y serializando la respuesta (sin red ni HTTP): p95 de 5 ms en
      la primera página, 12 ms en la última y 27 ms con búsqueda y estado.
- [x] Ningún dato del archivo de ejemplo aparece en la base ni en los datos de prueba: no hay semilla de retiros
      (`DevelopmentSeeder` solo concede las claves `withdrawals.*`).
- [ ] Cumple la lista de verificación de cierre de la sección 4.5 del plan original.

## 15. Riesgos

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| El flujo de aprobación se deduce de la hoja `SLA`, no del formulario | Se construye una aprobación que la operación no usa, o falta una que sí usa | Confirmar la pregunta 1 antes de construir los estados |
| Las columnas `CANT.` y `UNID` son ambiguas | Cantidades mal interpretadas en el retiro | Confirmar la pregunta 2; `PackDetail` como texto hasta entonces |
| La firma del cliente | El sistema no puede autenticar a una persona externa | Registrar el nombre y firmar sobre la impresión |
| El formulario es de 2013, revisión 00 | Puede no reflejar la práctica actual | Validar el flujo con Almacén y Ventas Locales |
| Separación entre quien solicita y quien aprueba sin definir | Si se impone, puede bloquear a un departamento donde la misma persona ejecuta y aprueba; si no se impone, alguien aprueba lo suyo | Resolver la pregunta 9 antes de construir la aprobación; añadir la validación después es un cambio acotado |

## 16. Preguntas abiertas para Plastifar

La última columna es siempre un supuesto provisional de trabajo de este plan, nunca una regla de Plastifar ni
del plan original (README, sección 2).

| # | Pregunta | Opciones | Se asume mientras tanto |
|---|---|---|---|
| 1 | La hoja `SLA` tiene dos aprobaciones de retiros «por errores» de vendedor y de almacén. ¿Todo retiro requiere aprobación o solo los que se deben a un error? ¿Quién aprueba cada caso? | (a) solo los debidos a error; (b) todos | (a): con origen de error indicado se exige aprobación del departamento que señala la hoja |
| 2 | ¿Qué contienen `CANT.` y `UNID`? En el ejemplo, ambas llevan un número y una unidad | (a) cantidad en cajas y contenido en paquetes; (b) otra interpretación | Cantidad con su unidad, y un detalle de empaque en texto |
| 3 | ¿`VALOR` es cantidad por precio unitario? ¿Debe haber un total? ¿En qué moneda? | — | Sí, con total y moneda elegida por solicitud |
| 4 | ¿`P. UNIT.` y `VALOR` son obligatorios? En el ejemplo están vacíos | (a) opcionales; (b) obligatorios | (a) |
| 5 | ¿Un ticket puede tener más de una solicitud de retiro? | (a) sí; (b) una sola | (a) |
| 6 | ¿La firma del cliente y la de Almacén deben capturarse en el sistema? | (a) se firma en papel; (b) firma digital | (a): el sistema guarda nombre y fecha |
| 7 | ¿Qué diferencia práctica hay entre «Por Devolución» y «Por Cambio» después del retiro? | — | Ninguna en el sistema; solo se registra |
| 8 | ¿Los departamentos de ventas internacionales y de Centroamérica no hacen retiros? | (a) solo Ventas Locales; (b) también los demás | (a), como dice la hoja |
| 9 | ¿Quien solicita un retiro puede aprobarlo? ¿Y quien lo ejecuta en Almacén? La hoja `SLA` nombra a la misma persona en «RETIRO DE MERCANCIA» (fila 4) y en «APROBACION DE RETIROS X ERRORES DE ALMACEN» (fila 15) | (a) sin restricción: aprueba quien tenga el permiso; (b) quien solicita no puede aprobar lo suyo; (c) además, quien aprueba no puede ser quien ejecuta el retiro | **Ninguno.** El servidor no valida ninguna separación hasta tener la respuesta |
| 10 | ¿Puede eliminarse una solicitud de retiro, además de cancelarse? La matriz de permisos solo concede «Eliminar» sobre tickets y tareas. Si puede, ¿qué rol lo hace y basta con que deje de verse, o debe borrarse físicamente? | (a) no se elimina; se cancela con motivo; (b) baja lógica auditada, con el rol que Plastifar indique; (c) además, borrado físico en los casos que indique | Supuesto provisional de trabajo: (a), sin clave de eliminación; la solicitud deja de verse si su ticket recibe la baja lógica del documento 01 |
