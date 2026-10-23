# 05 · Módulo: HCA ampliada (PF-FOR-109)

Panel interno Plastifar · Plan de construcción · Ampliación v0.1 · 11 de octubre de 2026

**Responsable:** Por asignar  ·  **Prioridad:** cuarta entrega  ·  **Tablas nuevas:** `HcaCause`, `HcaParticipant`, `ActionPlanItemAttachment`; amplía `CorrectiveActionSheet` y `ActionPlanItem`

Marcas usadas: **[Fuente]**, **[Propuesta]**, **[Abierta]**. Ver [README](README.md), sección 2.

> **Módulos relacionados.** Este documento es un delta sobre el módulo de Calidad ya entregado (sección 10 del
> plan original, Yordy Acosta). La conexión con las tareas del ticket toca la Bandeja (sección 9, Richard De
> León) y se especifica en el documento 02.

> **Estado (12 de octubre de 2026).** Construido en las ramas `modulo/hca-ampliada` de ambos repositorios todo
> lo que es de Calidad: autor, planta, producto y comentarios en la hoja; lista de causas con las tres reglas
> movidas de la causa raíz a las causas (regla 4) y la migración de datos (RF-H11); evidencias por acción, texto
> y archivos, con `AttachmentPolicy` e `IAttachmentStorage`; participantes con confirmación; filtros por planta y
> producto; impresión PF-FOR-109 en `/calidad/hca/{id}/imprimir`; y el nombre «Hecho, Causa y Acción» en código
> y textos (RF-H12). **No construido, a propósito:** `TaskId` y todo lo que toca la tarea (RF-H7, RF-H8, los
> criterios 3 y 4 de la sección 14): es la Bandeja y depende del documento 02. La migración
> `AddFormModules` (consolidada en `feature/formularios`) está aplicada en Postgres 17 local el 23 de octubre de 2026,
> desde el estado anterior a los módulos y sobre datos de prueba; falta aplicarla en Railway.

## 1. Situación y objetivo

HCA significa «Hecho, Causa y Acción»: es el nombre oficial del formulario PF-FOR-109 y el que este documento
usa en adelante (sección 5, «Nombre»).

El módulo de Calidad ya gestiona la HCA y tiene más estructura que el formulario en papel: un flujo de cinco
estados, verificación de eficacia y condiciones de cierre que el PF-FOR-109 no contempla. Esa estructura viene
del plan original, no de la operación; no hay que rehacer el módulo, pero cuáles de esas condiciones gobiernan
el cierre queda por confirmar con Plastifar (sección 8, regla 3).

El formulario aporta, sin embargo, seis elementos que el sistema no tiene: quién lo elaboró, la planta, el
producto específico, varias causas en lugar de un solo texto, las evidencias de que las acciones se
implementaron, y la lista de participantes con su firma. Además, la hoja `FORMULARIOS` convierte la HCA en
requisito para cerrar ciertas tareas.

El objetivo es añadir lo que falta sin romper lo que existe, y conectar la HCA con la tarea que la exige.

## 2. Alcance

**Incluye**

- Campos nuevos en la hoja: autor, planta, producto y comentarios.
- Varias causas por hoja.
- Evidencias de implementación por acción del plan, con texto y adjuntos.
- Participantes.
- Vínculo de la HCA con una tarea, y la condición de «llena» para permitir el cierre de la tarea.
- Impresión con el formato PF-FOR-109.
- El nombre oficial «Hecho, Causa y Acción» en el código y en la interfaz.

**No incluye**

- Cambios al flujo de estados, a la verificación de eficacia ni a las solicitudes de crédito, salvo los que
  resulten de la respuesta de Plastifar a las preguntas 1 y 10.
- Las listas `Tipo de Anexo` y `Proceso` incrustadas en el archivo: provienen de otra organización (ver README,
  sección 7).
- La aprobación de casos de calidad que nombra la hoja `SLA`, mientras Plastifar no la defina (pregunta 3).

## 3. Dependencias

- **00 Base común:** productos y plantas.
- **02 Tareas y SLA:** tipos de tarea y el bloqueo de cierre.

## 4. Fuente y trazabilidad

Archivo `PF-FOR-109-HCA-Hecho Causa y Acción V0.xls`, hoja `HCA`. Rango usado A1:J43. La hoja tiene 18 celdas de
texto en total y ninguna fórmula, validación, comentario ni macro.

**Procedencia de la plantilla.** Las propiedades del archivo nombran a otra empresa como autora, y el logotipo
incrustado (A2:C4) no es el de Plastifar. La plantilla fue heredada. En la impresión se usa el logotipo de
Plastifar.

Control documental, en el pie de página: `PF-FOR-109`, `Revisión: 00`, `Sustituye a: N/A`, `Última revisión:
N/A`, `Fecha emisión: 17 .04.2015`, y un campo `Emitido por:`. El nombre del archivo dice «V0».

| Elemento del formulario | Celdas |
|---|---|
| Título `HCA` | C1:C5 |
| `Codigo:`, `Fecha: `, `Elaborado por:` | D2, D3, D4; valores en F2, F3, F4 |
| `Producto:`, `Planta:`, `Responsible:` | G2, G3, G4; valores en H2, H3, H4 |
| `HECHO` | A6:A10; área libre B6:H10 |
| `CAUSAS` | A12:A18; cuatro renglones (B13:H16) y dos filas abiertas |
| `PLAN DE ACCIÓN`: `ACCIÓN (QUE)`, `QUIEN`, `CUANDO` | A20:A33; cabecera en la fila 20; dos renglones de acción (filas 21 a 27) |
| `EVIDENCIAS DE LA IMPLEMENTACIÓN DE LAS ACCIONES ` | B28:H30; cuatro recuadros sin título debajo (filas 31 a 33) |
| `PARTICIPANTES`: `NOMBRE`, `FIRMA` | A35:A39; cabecera en la fila 35; cuatro filas |
| `COMENTARIOS` | A40:A42; área libre B40:H42 |
| Quién la llena y cuándo | `PLAN-SLA-PERMISOS`, hoja `FORMULARIOS`, fila 5 |
| Plazos relacionados | `PLAN-SLA-PERMISOS`, hoja `SLA`, filas 3, 5 y 13 |

La etiqueta `Responsible:` está escrita así en el original, con grafía inglesa; el valor correcto es
«Responsable:». `Codigo:` no lleva tilde en el original.

El formulario no marca ningún campo como obligatorio, no define estados ni aprobaciones, y su único bloque de
firma es el de participantes, sin indicar cargo.

## 5. Lo que ya existe

Archivos: backend `api/Models/Quality.cs`, `api/Services/QualityRules.cs`,
`api/Controllers/CorrectiveActionSheetsController.cs` (ruta `api/quality/sheets`, :19) y
`api/Controllers/ActionPlanController.cs` (rutas `api/quality/sheets/{sheetId}/plan` y
`api/quality/plan-items/{id}`); frontend `src/types/quality.ts`, `src/api/quality.ts`, `src/lib/quality.ts` y
`src/pages/quality/` (`HcaPage.tsx`, `HcaModal.tsx`, `HcaDetailPage.tsx`, `ActionPlanItemModal.tsx`,
`EffectivenessModal.tsx`, `CloseSheetModal.tsx`, `CancelPlanItemModal.tsx`), servidas en `/calidad/hca`
(`src/App.tsx:116-119`).

| Campo del formulario | En el sistema | Estado |
|---|---|---|
| `Codigo:` | `number` (`src/types/quality.ts:24`), mostrado como «Número» (`HcaDetailPage.tsx:368`) | Existe; lo genera el sistema |
| `Fecha: ` | `detectedAt` (`quality.ts:35`), «Detectada el» (`HcaModal.tsx:196`); también `createdAt` (:58) | Existe; el formulario tiene una sola fecha sin calificar |
| `Elaborado por:` | Ninguno; solo `closedByStaffId` (:52) y `responsibleStaffId` (:43) | **Falta** |
| `Producto:` | `productLineId` y `productLineName` (:32-33), «Línea de producto» (`HcaModal.tsx:174`) | **Difiere:** línea de producto, no producto específico |
| `Planta:` | Ninguno | **Falta** |
| `Responsible:` | `responsibleStaffId` y `responsibleName` (:43-44), «Responsable» (`HcaModal.tsx:218`) | Existe |
| `HECHO` | `description` (:37), «Qué ocurrió», de 20 a 2000 caracteres (`HcaModal.tsx:32-36`, :237) | Existe con otra etiqueta |
| `CAUSAS` | `rootCause` (:41), «Causa raíz», solo en edición (`HcaModal.tsx:253-262`) | **Difiere:** un solo texto; el formulario sugiere varias |
| `ACCIÓN (QUE)` | `ActionPlanItem.description` (:70), «Acción» (`ActionPlanItemModal.tsx:118`) | Existe |
| `QUIEN` | `responsibleStaffId` y `responsibleName` (:71-73), «Responsable» (`ActionPlanItemModal.tsx:132`) | Existe |
| `CUANDO` | `dueDate` (:75), «Comprometida para» (`ActionPlanItemModal.tsx:149`) | Existe |
| `EVIDENCIAS DE LA IMPLEMENTACIÓN…` | Ninguno: ni texto ni adjuntos en la hoja ni en la acción (`quality.ts:67-81`; `SavePlanItemRequest` en `src/api/quality.ts:62-66`) | **Falta.** Lo más cercano, `effectivenessNotes` (:50), es otro concepto |
| `PARTICIPANTES` (`NOMBRE`, `FIRMA`) | Ninguno | **Falta** |
| `COMENTARIOS` | Ninguno general; solo `closingNote` (:57) y `effectivenessNotes` | **Falta** |
| Control documental | Ninguno | Falta; solo importa para la impresión |

**En el sistema y no en el formulario:** cliente (`quality.ts:28-30`) y ticket (:26-27); acción inmediata (:39);
cierre comprometido (:46); verificación de eficacia (:49-50; `src/api/quality.ts:160-164`); datos de cierre
(:51-57); y, en cada acción, fecha de cumplimiento, estado y motivo de anulación (:77-80).

**Flujo existente,** que este documento no modifica mientras las preguntas 1 y 10 sigan abiertas: `Abierta → En análisis → En ejecución → En verificación →
Cerrada` (`quality.ts:10-16`; `src/lib/quality.ts:117-133`; `api/Models/Quality.cs:4-11`), siempre de un estado
al siguiente y sin retroceder (`api/Services/QualityRules.cs:94-104`). Las acciones tienen los estados
`Pendiente`, `En curso`, `Cumplida` y `Anulada` (`quality.ts:62`).

**La causa raíz interviene hoy en tres reglas del servidor,** no en una:

1. Es obligatoria para pasar a «En ejecución» (`QualityRules.cs:106-109`; espejo en `src/lib/quality.ts:125-126`).
2. Es una de las tres condiciones de cierre, junto con las acciones resueltas y la verificación de eficacia
   (`QualityRules.cs:47-72`; el frontend las recibe ya evaluadas, `src/api/quality.ts:36-48`).
3. No puede dejarse en blanco una vez que la hoja está en ejecución o más adelante (`QualityRules.cs:123-134`).

**Campos obligatorios de la hoja en el modelo:** cliente (`Quality.cs:40`), línea de producto (:44) y
responsable (:54). El ticket es opcional (:38).

**Nombre.** **[Fuente]** El formulario se llama «Hecho Causa y Acción»: lo dice el nombre del archivo
(`PF-FOR-109-HCA-Hecho Causa y Acción V0.xls`) y lo confirman sus tres bloques, `HECHO`, `CAUSAS` y `PLAN DE
ACCIÓN`. El código documenta la HCA como «Hoja de Corrección de Acción» (comentario en
`src/types/quality.ts:20`; `api/Models/Quality.cs:29`), y el plan original la llama «Hojas de Corrección de
Acción» (sección 10.1). Ese desarrollo de la sigla salió de la maqueta, no de Plastifar. **[Propuesta]** Este
plan adopta «Hecho, Causa y Acción» como nombre oficial y propone el cambio de nombre: corregir los dos
comentarios del código y todo texto visible que desarrolle la sigla. La sigla «HCA», las rutas y los nombres de
clases y tablas no cambian.

## 6. Modelo de datos

Todo el modelo de esta sección es **[Propuesta]**.

**Cambios en `CorrectiveActionSheet`**

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `CreatedByStaffId` | int? | Quien elabora la hoja. Nulo en las hojas anteriores a este cambio | `Elaborado por:` |
| `PlantId` | int? | Referencia a `Plant` | `Planta:` |
| `ProductId` | int? | Referencia a `Product`. `ProductLineId` se conserva | `Producto:` |
| `TaskId` | int? | Tarea que exige esta hoja | Nota de `FORMULARIOS` |
| `Comments` | text? | Comentarios generales | `COMENTARIOS` |

**HcaCause** — cada causa identificada.

| Campo | Tipo | Regla |
|---|---|---|
| `Id`, `SheetId` | int | Borrado en cascada con la hoja |
| `Description` | text | Obligatoria |
| `Position` | int | Orden |
| `CreatedAt`, `UpdatedAt` | timestamptz | UTC |

**Cambios en `ActionPlanItem`**

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `EvidenceNotes` | text? | Descripción de la evidencia de implementación | `EVIDENCIAS DE LA IMPLEMENTACIÓN DE LAS ACCIONES ` |

**ActionPlanItemAttachment** — archivos de evidencia de una acción: acción a la que pertenece, nombre original,
tipo, tamaño, clave de almacenamiento generada, quién lo subió y cuándo; los mismos campos que ya tiene
`TicketTaskAttachment` (`TicketTasksController.cs:315-324`). El almacenamiento se hace con `IAttachmentStorage`,
igual que las evidencias de las tareas.

Las reglas de adjuntos que el plan original reunía en una sola regla de negocio (sección 9.4, regla 10) son en
realidad dos cosas, y se separan:

- **Estándar técnico vigente, ya aplicado en código.** Todo archivo que sube el personal pasa por un único
  sitio, `api/Services/AttachmentPolicy.cs`, y las evidencias de la HCA también: rechazo de ejecutables y
  guiones por extensión y por tipo declarado (:16-29, :37-45), solo el nombre del archivo sin ruta (:54), nombre
  de almacenamiento generado (:125-130), y entrega únicamente a quien puede ver la hoja, por enlace firmado y
  temporal. Son medidas de seguridad; no dependen de Plastifar.
- **[Abierta]** **Límite de negocio.** Qué archivos y de qué tamaño necesita Plastifar como evidencia. Los
  valores que hoy aplica el código —10 MB por archivo (:8), 25 MB por envío (:9), 10 archivos por envío (:10) y
  la lista de extensiones permitidas (:31-35)— salen del plan original, donde se pensaron para los mensajes de
  un ticket. La fuente no dice nada sobre el tamaño ni el tipo de las evidencias. La lista permitida admite PDF,
  imágenes, documentos de oficina y comprimidos; no admite video, que es una forma verosímil de evidencia en
  planta (pregunta 11). **Supuesto provisional de trabajo:** se reutilizan los límites actuales tal cual,
  porque son los construidos; cambiarlos es modificar constantes en un solo archivo.

**HcaParticipant** — quienes participaron en el análisis.

| Campo | Tipo | Regla |
|---|---|---|
| `Id`, `SheetId` | int | Borrado en cascada con la hoja |
| `StaffId` | int? | Si el participante es personal del sistema |
| `Name` | string(160) | Obligatorio; se copia del personal o se escribe a mano |
| `AcknowledgedAt` | timestamptz? | Cuándo confirmó su participación en el sistema |

**Migración de la causa raíz.** Cada hoja existente con `RootCause` no vacío genera una fila de `HcaCause` con
ese texto. La columna `RootCause` se conserva sin uso en esta entrega y se retira en una migración posterior,
una vez verificados los datos. No se edita ninguna migración ya aplicada.

**Índices obligatorios:** `CorrectiveActionSheet.PlantId`; `CorrectiveActionSheet.ProductId`;
`CorrectiveActionSheet.TaskId`; `CorrectiveActionSheet.CreatedByStaffId`; `HcaCause.SheetId`;
`HcaParticipant.SheetId`; `ActionPlanItemAttachment.PlanItemId`.

## 7. Catálogos y datos semilla

El formulario no tiene listas de valores permitidos. `Planta:` y `Producto:` se toman de los catálogos del
documento 00.

Las listas `Tipo de Anexo` (7 valores) y `Proceso` (20 valores) incrustadas en el archivo describen procesos de
otra organización y **no** se usan como valores de `Planta:`.

## 8. Lógica de negocio

1. **[Fuente]** La HCA la llenan Calidad, Producción y los equipos de planta, desde una tarea y al terminarla; la
   tarea no puede cerrarse sin ella (`FORMULARIOS`, fila 5).
2. **[Fuente]** Plazos de la hoja `SLA`: «INVESTIGACION DE CALIDAD», 15 días; «REVISION DE ACCIONES
   IMPLEMENTADAS», 30 días; ambos de Calidad y Producción. «APROBACION DE CASOS DE CALIDAD», 1 día, Producción.
3. **[Abierta]** Qué condiciones gobiernan el cierre. Hay dos cierres distintos —el de la tarea que exige la
   HCA y el de la HCA misma— y dos fuentes de reglas que no coinciden:
   - **El contenido mínimo del formulario.** **[Fuente]** El PF-FOR-109 pide el hecho, las causas, el plan de
     acción (qué, quién y cuándo), las evidencias de implementación, los participantes y los comentarios. No
     marca ningún campo como obligatorio y no define estados, aprobaciones ni verificación de eficacia.
   - **La puerta de cierre del plan original, que el código ya aplica.** La HCA del sistema no se cierra sin
     causa raíz escrita, acciones resueltas y eficacia verificada (`QualityRules.cs:47-72`), y avanza por cinco
     estados. Es comportamiento construido a partir de la sección 10.3 del plan original; ninguna hoja de
     cálculo lo pide.

   La elección tiene consecuencias prácticas. La verificación de eficacia puede tardar semanas: si la tarea
   exigiera una HCA cerrada con la puerta actual, una «INVESTIGACION DE CALIDAD» de 15 días no podría terminar a
   tiempo. Y si el cierre de la HCA se redujera al mínimo del formulario, se perdería la verificación de
   eficacia, que la hoja `SLA` parece reflejar en «REVISION DE ACCIONES IMPLEMENTADAS» (pregunta 8).

   Este plan no decide cuál gobierna (preguntas 1 y 10). **Supuesto provisional de trabajo,** solo para que el
   documento sea coherente: la tarea puede cerrarse cuando la HCA tiene el hecho, al menos una causa y al menos
   una acción en el plan —el mínimo del formulario, que en el sistema equivale a haber alcanzado «En
   ejecución»—; y el cierre de la HCA conserva la puerta que hoy aplica el código, porque es lo que está
   construido, no porque sea un requisito de Plastifar.
4. **[Propuesta]** Las tres reglas que hoy dependen de la causa raíz (sección 5) pasan a depender de las causas
   registradas: para pasar a «En ejecución» hace falta al menos una causa; la condición de cierre «Causa raíz
   escrita» se cumple con al menos una causa; y, desde «En ejecución», no puede quitarse la última causa. Hay
   que cambiar las tres en `QualityRules.cs` (:106-109, :55-58 y :123-134) y su espejo en
   `src/lib/quality.ts:125-126`. Las otras dos condiciones de cierre, y el avance de un estado al siguiente, no
   se tocan en esta propuesta; si siguen vigentes depende de la regla 3.
5. **[Propuesta]** La evidencia es opcional para marcar una acción como cumplida, de modo que el comportamiento
   actual no cambia. Las acciones cumplidas sin evidencia se señalan en el detalle de la hoja (pregunta 2).
6. **[Propuesta]** Al crear la hoja, el sistema registra como autor a quien la crea. No es editable.
7. **[Propuesta]** Planta y producto son opcionales para no invalidar las hojas existentes. Si se elige un
   producto, la línea de producto se propone a partir de él.
8. **[Propuesta]** Un participante que es personal del sistema puede confirmar su participación; queda el sello
   de fecha. La firma autógrafa se hace sobre la impresión.
9. **[Propuesta]** Una HCA abierta desde una tarea hereda el ticket de esa tarea y, de él, el cliente. El cliente
   y la línea de producto son obligatorios en la hoja (`Quality.cs:40`, :44) y opcionales en el ticket
   (`api/Models/Ticket.cs:20`, :29): cuando el ticket no los tiene, el diálogo los pide antes de crear la hoja.
10. **[Abierta]** Las reglas 1 a 4 y 8 de la sección 10.3 del plan original —entre ellas, que una HCA no se
    elimina nunca y las condiciones de cierre— vienen de la maqueta. Lo que el código aplica de verdad,
    comprobado el 11 de octubre de 2026:
    - **Condiciones de cierre (reglas 2 y 3):** aplicadas por una regla explícita del servidor (sección 5).
    - **«Una HCA no se elimina nunca» (regla 1):** no hay ninguna regla que lo impida; lo que ocurre es que la
      eliminación no existe. `CorrectiveActionSheetsController.cs` expone listar (:89), detalle (:193), alta
      (:225), edición (:270), avance (:319), verificación de eficacia (:353) y cierre (:405), y ningún
      `DELETE`; tampoco hay en el backend ningún punto que borre una hoja. Las relaciones de la hoja con
      cliente, línea de producto y responsable son restrictivas (`api/Data/Configurations/QualityConfiguration.cs:28-47`),
      de modo que tampoco puede borrarse a quien una hoja referencia. La hoja no tiene campos de baja lógica.
    - **HCA vencidas destacadas (regla 4) y vínculo visible con el ticket (regla 8):** no se comprobaron.

    Este documento no modifica nada de eso, pero tampoco lo afirma como requisito: si sigue rigiendo lo decide
    la respuesta de Plastifar a las preguntas 1 y 10. La matriz de permisos de la fuente concede «Eliminar» solo
    sobre tickets y tareas y no menciona la HCA, así que este plan no crea ninguna clave para eliminarla. Hasta
    entonces el código queda como está.
11. **[Propuesta]** El nombre oficial es «Hecho, Causa y Acción» (sección 5, «Nombre»). Se corrigen el
    comentario de `src/types/quality.ts:20`, el de `api/Models/Quality.cs:29` y los textos visibles que
    desarrollen la sigla. Cambiar además las etiquetas de los campos por las palabras del formulario («Hecho»,
    «Causas») queda pendiente de la pregunta 5.

## 9. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-H1 | La hoja registra y muestra quién la elaboró |
| RF-H2 | La hoja admite planta y producto específico, además de la línea de producto |
| RF-H3 | Gestión de causas: agregar, editar, reordenar y quitar, mientras la hoja no esté cerrada |
| RF-H4 | Cada acción del plan admite una descripción de evidencia y archivos adjuntos |
| RF-H5 | Gestión de participantes, elegidos del personal o escritos a mano, con confirmación de participación |
| RF-H6 | Campo de comentarios generales en la hoja |
| RF-H7 | Apertura de una HCA desde una tarea que la exige, con el vínculo visible en ambos sentidos |
| RF-H8 | La tarea que exige HCA no puede completarse hasta que la hoja esté llena; el aviso indica qué falta |
| RF-H9 | Filtros por planta y por producto en el listado de HCA |
| RF-H10 | Impresión de la hoja con el formato y el control documental del PF-FOR-109 |
| RF-H11 | Las hojas anteriores al cambio conservan su causa raíz como primera causa |
| RF-H12 | El código y la interfaz desarrollan la sigla HCA como «Hecho, Causa y Acción»; no queda ninguna aparición de «Hoja de Corrección de Acción» |

## 10. Endpoints

Los endpoints existentes de HCA conservan su ruta y su forma; se amplían sus cuerpos con los campos nuevos.

| Método y ruta | Descripción | Permiso |
|---|---|---|
| `POST /api/quality/sheets` y `PUT /api/quality/sheets/{id}` (ya existen, `CorrectiveActionSheetsController.cs:225`, :270) | Aceptan `plantId`, `productId`, `taskId` y `comments` | `quality.write` |
| `GET /api/quality/sheets` (ya existe, :89) | Añade los filtros `plantId` y `productId` | `quality.read` |
| `GET /api/quality/sheets/{id}` (ya existe, :193) | Devuelve además causas, participantes y autor | `quality.read` |
| `GET · POST /api/quality/sheets/{sheetId}/causes` | Causas de la hoja | `quality.read` / `quality.write` |
| `PUT · DELETE /api/quality/causes/{id}` | Edición y baja de una causa | `quality.write` |
| `GET · POST /api/quality/sheets/{sheetId}/participants` | Participantes | `quality.read` / `quality.write` |
| `DELETE /api/quality/participants/{id}` | Quitar un participante | `quality.write` |
| `POST /api/quality/participants/{id}/acknowledge` | Confirmar la propia participación | `quality.read` |
| `PUT /api/quality/plan-items/{id}` (ya existe, `ActionPlanController.cs:139`) | Acepta además `evidenceNotes` | `quality.write` |
| `POST /api/quality/plan-items/{id}/attachments` | Subir evidencia, como `multipart/form-data` | `quality.write` |
| `GET /api/quality/plan-items/{id}/attachments/{attachmentId}` | Devuelve un enlace firmado y temporal, previa comprobación de acceso a la hoja | `quality.read` |

Las rutas nuevas son **[Propuesta]** y siguen el prefijo real del módulo: la hoja vive en `api/quality/sheets`
y sus hijos se abordan por la hoja para listar y crear (`api/quality/sheets/{sheetId}/plan`,
`ActionPlanController.cs:33`, :99) y por su propio identificador para lo demás (`api/quality/plan-items/{id}`,
:139). No existe ninguna ruta `api/quality/hca`; «hca» aparece solo en las rutas de pantalla del frontend. La
descarga por enlace firmado es el mismo mecanismo de las evidencias de tareas
(`TicketTasksController.cs:490-532`).

## 11. Pantallas

- **Diálogo de HCA** (`HcaModal.tsx`): se añaden planta y producto; el campo de causa raíz se sustituye por la
  lista de causas.
- **Detalle de HCA** (`HcaDetailPage.tsx`): se añaden el autor en la ficha, la sección «Causas», la sección
  «Participantes», el campo «Comentarios» y, en cada acción, su evidencia.
- **Diálogo de acción** (`ActionPlanItemModal.tsx`): se añaden la descripción de evidencia y la subida de
  archivos.
- **Tarea:** acceso a la HCA asociada, y aviso cuando falta.
- **Vista de impresión:** reproduce la distribución del PF-FOR-109 con el logotipo de Plastifar, sin
  dependencias nuevas.
- Componentes: `Modal`, `FormSection`, `Field`, `Select`, `LookupSelect`, `DetailTable`, `Badge`, `Alert`,
  `ConfirmDialog`, `RowAction`. Para la subida de archivos no hay un componente compartido que reutilizar: cada
  pantalla que hoy adjunta archivos lleva su propio `<input type="file">` (por ejemplo
  `src/pages/tickets/CompleteTaskModal.tsx:185`), y las tareas solo admiten evidencias en el momento de
  completarlas, dentro del mismo envío. Aquí se sigue ese mismo patrón de selección y envío con `FormData`
  (`CompleteTaskModal.tsx:78-83`); lo que se reutiliza de verdad está en el servidor (`AttachmentPolicy` e
  `IAttachmentStorage`).

## 12. Permisos

No se añaden claves. Lectura con `quality.read` y escritura con `quality.write`, que ya existen
(`api/Security/PermissionCatalog.cs:38-39`).

## 13. Validación

Reglas espejo entre Zod y el servidor. Las validaciones existentes de la hoja no cambian.

| Campo | Regla |
|---|---|
| `PlantId`, `ProductId` | Opcionales; deben estar activos |
| `HcaCause.Description` | Obligatoria, de 10 a 1000 caracteres |
| Causas | Al menos una para pasar a «En ejecución»; máximo 20 por hoja |
| `EvidenceNotes` | Opcional; hasta 2000 caracteres |
| Adjuntos de evidencia | Las comprobaciones de seguridad de `AttachmentPolicy` se aplican siempre. Los límites de tamaño, cantidad y extensiones son, como supuesto provisional, los actuales (10 MB por archivo, 25 MB y 10 archivos por envío, lista de extensiones permitidas); si son los adecuados para evidencias depende de la pregunta 11 |
| `HcaParticipant.Name` | Obligatorio, de 3 a 160 caracteres; no se repite la misma persona en una hoja |
| `Comments` | Opcional; hasta 4000 caracteres |

## 14. Criterios de aceptación

- [x] Una hoja existente con causa raíz muestra ese texto como su primera causa después de la migración.
      Comprobado en Postgres 17 local el 23 de octubre de 2026: la causa sale recortada de espacios y cortada a
      1000 caracteres, y las hojas con causa vacía o nula no reciben ninguna. Falta repetirlo en Railway.
- [x] Una hoja sin causas no puede pasar a «En ejecución», y el mensaje dice qué falta
      (`HcaFormTests.Advancing_to_execution_needs_at_least_one_cause_and_the_message_says_so`).
- [ ] Una tarea que exige HCA no puede completarse con una hoja que no tiene causas ni acciones. **Pendiente:**
      es la Bandeja (documento 02).
- [ ] Bajo el supuesto provisional de la regla 3 (pregunta 1, opción a): la misma tarea sí puede completarse con
      una hoja en «En ejecución», aunque no esté cerrada. Si Plastifar elige otra opción, este criterio se
      sustituye. **Pendiente:** es la Bandeja (documento 02).
- [x] Un adjunto de evidencia solo puede descargarlo quien puede ver la hoja: el enlace firmado exige
      `quality.read` y se emite por diez minutos (`HcaFormTests.Evidence_is_stored_and_linked_and_a_settled_action_only_takes_evidence`).
- [x] La impresión muestra el código PF-FOR-109, el número de la hoja y el del ticket, y el logotipo de Plastifar.
      Comprobado en el código de `HcaPrintPage.tsx`; sin prueba automática, el frontend no tiene corredor.
- [x] Mientras la pregunta 10 siga abierta, las condiciones de cierre de la HCA que el código aplica hoy siguen
      funcionando igual (`HcaFormTests.The_closing_gate_still_needs_resolved_actions_and_effectiveness`).
- [x] Ningún comentario del código ni texto visible desarrolla la sigla como «Hoja de Corrección de Acción».
      Quedan solo las migraciones ya aplicadas, que no se editan.
- [ ] Cumple la lista de verificación de cierre de la sección 4.5 del plan original. **Por revisar** en la
      revisión cruzada.

## 15. Riesgos

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| Sustituir la causa raíz por una lista | Cambia una condición de avance que ya funciona | Migración de datos probada; conservar la columna hasta verificar |
| Definición de «llena» sin confirmar | La tarea se cierra demasiado pronto o no puede cerrarse | Confirmar la pregunta 1 antes de conectar con las tareas |
| La puerta de cierre de la HCA viene del plan original, no de la operación | Se mantiene un control que Plastifar no usa, o se retira uno que sí necesita | Confirmar la pregunta 10 antes de tocar las condiciones de cierre; hasta entonces el código no cambia |
| La plantilla es heredada de otra organización | Se copian conceptos que Plastifar no usa | Validar los campos nuevos con Calidad antes de construir |
| El formulario en papel es más simple que el sistema | La impresión no tiene dónde mostrar estados ni verificación de eficacia | La impresión reproduce el formulario; lo demás queda solo en pantalla |

## 16. Preguntas abiertas para Plastifar

La última columna es siempre un supuesto provisional de trabajo de este plan, nunca una regla de Plastifar ni
del plan original (README, sección 2).

| # | Pregunta | Opciones | Se asume mientras tanto |
|---|---|---|---|
| 1 | Para cerrar la tarea, ¿qué debe tener la HCA: el contenido mínimo del formulario o la hoja cerrada con la puerta que el sistema aplica hoy? | (a) el mínimo del formulario: hecho, causas y plan de acción; (b) además, las acciones cumplidas; (c) la hoja cerrada con la puerta actual, es decir, con eficacia verificada | Ninguna opción se da por requisito. Supuesto provisional de trabajo: (a) |
| 2 | ¿La evidencia de implementación es obligatoria para dar una acción por cumplida? | (a) opcional; (b) obligatoria | (a) |
| 3 | La hoja `SLA` incluye «APROBACION DE CASOS DE CALIDAD», 1 día, Producción. ¿Qué se aprueba y en qué momento? El formulario y el sistema no tienen ninguna aprobación de HCA | (a) aprobar la apertura; (b) aprobar el plan; (c) aprobar el cierre | No se construye ninguna aprobación; se crea solo el tipo de tarea |
| 4 | ¿Las causas son varias, cada una por separado, o un solo texto? El formulario tiene cuatro renglones | (a) varias; (b) un solo texto | (a) |
| 5 | El nombre oficial ya está resuelto por la fuente: «Hecho, Causa y Acción». Queda por confirmar si las etiquetas de los campos deben usar las palabras del formulario: «Hecho» en lugar de «Qué ocurrió» y «Causas» en lugar de «Causa raíz» | (a) se usan las etiquetas del formulario; (b) se conservan las actuales | Las etiquetas de los campos no se tocan hasta tener la respuesta; el nombre sí se cambia |
| 6 | ¿`Producto:` es un artículo concreto o una línea de producto? | (a) artículo; (b) línea | Ambos, con el artículo opcional |
| 7 | ¿Los participantes deben firmar en el sistema? | (a) confirmación en el sistema; (b) firma en papel; (c) ambas | (c) |
| 8 | «REVISION DE ACCIONES IMPLEMENTADAS», 30 días, ¿corresponde a la verificación de eficacia que ya existe? | (a) sí; (b) es otro paso | (a) |
| 9 | ¿Existe una versión vigente del PF-FOR-109 con la identidad de Plastifar? El archivo entregado es la versión 0 de 2015 | — | Se usa la estructura del archivo entregado |
| 10 | ¿Qué condiciones debe cumplir una HCA para darse por cerrada? El formulario no define cierre, estados ni verificación. El sistema exige hoy causa raíz, acciones resueltas y eficacia verificada; esas reglas vienen del plan original. Aparte: ¿puede eliminarse una HCA? Hoy el sistema no tiene esa acción, y la matriz de permisos solo concede «Eliminar» sobre tickets y tareas | Cierre: (a) se conserva la puerta actual; (b) basta el contenido del formulario; (c) otra combinación que Plastifar indique. Eliminación: (d) no se elimina; (e) baja lógica auditada, con el rol que Plastifar indique | Ninguna opción se da por requisito. El código queda como está, porque es lo construido, hasta tener la respuesta: puerta de cierre actual y sin acción de eliminar |
| 11 | ¿Qué archivos se adjuntan como evidencia de una acción y de qué tamaño? El sistema admite hoy PDF, imágenes, documentos de oficina y comprimidos, hasta 10 MB por archivo; no admite video | (a) bastan los tipos y límites actuales; (b) hacen falta otros tipos o tamaños, que Plastifar indique | Supuesto provisional de trabajo: (a) |
