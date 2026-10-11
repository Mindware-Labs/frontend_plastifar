# 01 · Módulo: Organización y permisos

Panel interno Plastifar · Plan de construcción · Ampliación v0.1 · 11 de octubre de 2026

**Responsable:** Por asignar  ·  **Prioridad:** primera entrega, bloquea a 02  ·  **Tablas nuevas:** ninguna; amplía `Department` y `Staff`, y añade la baja lógica a `Ticket` y `TicketTask`

Marcas usadas: **[Fuente]**, **[Propuesta]**, **[Abierta]**. Ver [README](README.md), sección 2.

> **Módulos de otros responsables.** Este documento amplía el catálogo de permisos (sección 6 del plan original,
> Yordy Acosta) y exige que la Bandeja de tickets y sus tareas (sección 9, Richard De León) comprueben las claves
> nuevas. La división de la clave `tickets.write` cambia el contrato de autorización de la Bandeja y debe
> acordarse con su responsable antes de escribirla.

## 1. Situación y objetivo

El libro `PLAN-SLA-PERMISOS-PLASTIFAR.xlsx` describe la organización del sistema anterior: 38 departamentos, 5
roles, 101 agentes y una matriz de 20 permisos. Por los encabezados, los nombres de rol y la redacción de los
permisos, el libro parece una exportación de osTicket; esto es una inferencia, la fuente no lo declara.

El sistema ya tiene las piezas para representar casi todo: departamentos con jerarquía de dos niveles, roles como
filas de base de datos y acceso por persona, departamento y rol. Lo que falta es más estrecho de lo que parece:
dos atributos del departamento, un identificador de usuario heredado y, sobre todo, las claves de permiso. De los
20 permisos del libro, solo 3 corresponden limpiamente a una clave existente.

El objetivo es dejar el sistema capaz de representar la matriz completa y cargar la organización real, sin
inventar las respuestas que la fuente no da.

## 2. Alcance

**Incluye**

- Dos atributos nuevos en el departamento: tipo y rol del departamento; y la relación con el buzón.
- Carga de los 38 departamentos y de los 5 roles.
- Especificación de la carga de los 101 agentes, de lo que la bloquea y de las alternativas para desbloquearla.
- Claves de permiso nuevas para tickets y tareas, y la matriz rol × permiso.
- La eliminación de tickets y de tareas que la matriz concede, como baja lógica auditada.

**No incluye**

- Construir las funciones que hoy no existen (fusionar, vincular, transferir o referir tickets). Aquí solo se
  reservan sus claves; cada función se especifica cuando se decida construirla (sección 16, pregunta 5).
- Los permisos de los formularios nuevos; cada documento (03, 04 y 06) añade los suyos.
- El SLA y las reglas de formularios, que van en el documento 02.

## 3. Dependencias

Ninguna para la estructura. La carga de agentes depende de dos respuestas de Plastifar: cómo se resuelve la
falta de correos electrónicos (sección 8.1 y sección 16, pregunta 1) y qué rol prevalece entre el del agente y
el del departamento (sección 16, pregunta 3).

## 4. Fuente y trazabilidad

| Requisito | Hoja | Celdas |
|---|---|---|
| Departamentos: nombre, tipo, correo, administrador y rol | `DEPARTAMENTOS` | A1:E39 (38 filas de datos; la fila 40 es una fila de tabla vacía) |
| Roles | `ROLES` | A2:A6 |
| Agentes: nombre, usuario, estado, rol y departamento principal | `AGENTES` | A1:E102 (101 filas de datos) |
| Matriz de permisos por rol | `PERMISOS` | A1:E21 (20 filas de datos) |

El libro no tiene hojas, filas ni columnas ocultas, validaciones, comentarios ni macros.

## 5. Lo que ya existe

| Pieza | Dónde | Estado |
|---|---|---|
| Departamento con jerarquía de dos niveles | Backend `api/Models/Department.cs:3-32` (`ParentId` :21); herencia del alcance en `src/lib/departments.ts:204-217` (`ancestorsOf`) y :227 en adelante (`descendantsOf`); pantallas `src/pages/departments/DepartmentsPage.tsx`, `DepartmentModal.tsx` | Construido. La jerarquía de la fuente encaja |
| Nombre de departamento | `api/Data/Configurations/DepartmentConfiguration.cs:16-17`: máximo 60 caracteres y **único en toda la tabla**, sin distinguir mayúsculas; `DepartmentsController.cs:86` rechaza el repetido con 409 | Construido. **Choca con la fuente:** ALMACEN, CALIDAD y PRODUCCION existen en el primer nivel y también como hijos de PLASTIFAR CENTROAMERICA (ver sección 6.1) |
| Responsable del departamento | `api/Models/Department.cs:25` (`ManagerStaffId`) | El campo existe en el modelo, pero ningún endpoint lo lee ni lo escribe: `DepartmentResponse` y `SaveDepartmentRequest` no lo incluyen (`api/Dtos/DepartmentDtos.cs:11`, :21). Solo se limpia al eliminar a la persona (`StaffController.cs:528-529`). Hay que exponerlo para cargar la columna ADMINISTRADOR |
| Roles como filas de base de datos | `api/Models/Rol.cs:3-14` (`Name`, lista de permisos, `IsSystem`, `IsActive`); pantallas `src/pages/roles/RolesPage.tsx`, `RoleModal.tsx` | Construido. Los cinco roles se cargan como datos |
| Rol por persona y departamento | `api/Models/StaffDepartmentAccess.cs:3-17` (`StaffId`, `DepartmentId`, `RoleId`, `IsPrimary`) | Construido |
| Catálogo de 16 claves de permiso | `api/Security/PermissionCatalog.cs:16-44`, etiquetas en :46-82; espejo en `src/types/permissions.ts:25-41`; comprobación en `src/lib/permissions.ts:71-97`. El atributo `[RequiresPermission]` rechaza al arrancar toda clave que no esté en el catálogo (`api/Security/PermissionAuthorization.cs:74-77`) | Construido |
| Matriz de permisos | `src/pages/permissions/PermissionMatrix.tsx` y `PermissionsPage.tsx` | Construido; pinta lo que devuelve `GET /api/permissions/matrix` (`src/api/permissions.ts:9`; `PermissionsController.cs:37`) y guarda con `POST /api/permissions/matrix` (:111). `GET /api/permissions` (:30) devuelve solo el catálogo |
| Buzón con departamento destino | `api/Models/Settings.cs:129-145` (`DepartmentId` :137, obligatorio); dirección única (`api/Data/Configurations/SettingsConfiguration.cs:130`) | Construido; un buzón apunta a un solo departamento |
| Personal | `api/Models/Staff.cs`: nombre y apellido separados (:6-7), correo obligatorio (:8) y único (`api/Data/Configurations/StaffConfiguration.cs:18`), `PasswordHash` obligatorio (:9), `PrimaryDepartmentId` obligatorio (:11), `IsAdmin` (:16), `IsActive` (:17) y `LegacyStaffId` (:25) | Construido. **No tiene nombre de usuario** |
| Alta de personal | `api/Controllers/StaffController.cs:165-239`: protegida con `AdminOnly` (:166), no con `staff.write`; genera una contraseña aleatoria (:188), crea el acceso principal con su rol (:194-201) y envía un correo de invitación con un código válido 24 horas (:204-226) | Construido. Edición, baja, revocación de sesiones y accesos por departamento también son `AdminOnly` (:242, :330, :354, :369, :414, :468) |
| Roles sembrados | Solo «Operación (demostración)», en `api/Data/DevelopmentSeeder.cs:401-423`, exclusivo de desarrollo | Ninguno de los cinco roles de la fuente existe |
| Departamentos sembrados | Ninguno; el sembrador usa los que haya y falla si no hay ninguno (`DevelopmentSeeder.cs:105-112`) | Ninguno de los 38 existe en código |
| Comprobación de permisos en tickets | `api/Controllers/TicketsController.cs`: asignación (:1418-1419), asignación masiva (:1560-1561), prioridad masiva (:1700-1701) y cambio de estado (:1798-1799) están protegidos con `AdminOnly`; los de :1419 y :1799 llevan un TODO. Crear (:375), editar (:701) y responder (:1081) solo exigen sesión (`[Authorize]`, :14) y alcance por departamento | Ninguna clave del catálogo se consulta en ese controlador; `tickets.write`, `tickets.assign` y `tickets.close` tampoco se consultan en el frontend, donde solo figuran en el tipo `PermissionKey` |
| Comprobación de permisos en tareas | `api/Controllers/TicketTasksController.cs:14` usa solo `[Authorize]`; el acceso se decide por el departamento del ticket, con paso libre al administrador (:38-57), y eliminar exige ser el creador o administrador (:549) | No existen claves `tasks.*` |

## 6. Modelo de datos

### 6.1 Cambios en `Department` **[Propuesta]**

| Campo | Tipo | Regla |
|---|---|---|
| `Type` | enum | `Publico` · `Privado`; se guarda como texto. Por defecto `Publico` |
| `DefaultRoleId` | int? | Rol que la fuente asigna al departamento (columna `PERMISOS` de la hoja `DEPARTAMENTOS`). Referencia a `Rol`. Se guarda tal como viene; qué efecto tiene frente al rol del agente está abierto (pregunta 3) |
| `MailboxId` | int? | Buzón por el que entra y sale el correo del departamento. Referencia a `Mailbox` |

La fuente asigna el mismo correo a 31 departamentos. El modelo actual de `Mailbox` apunta a un solo departamento
(`Settings.cs:137`) y su dirección es única (`SettingsConfiguration.cs:130`), de modo que no puede representarlo
ni con un buzón por departamento; por eso la relación se propone desde el departamento hacia el buzón: los 31
departamentos apuntan a la misma fila de `Mailbox`. El departamento destino del buzón (`Mailbox.DepartmentId`),
que es obligatorio, se conserva sin cambios como cola por defecto de lo que entra.

**Responsable.** `ManagerStaffId` ya existe en el modelo (`Department.cs:25`); lo que falta es exponerlo. Se
añade `managerStaffId` a `SaveDepartmentRequest` y a `DepartmentResponse` (`api/Dtos/DepartmentDtos.cs`) y al
diálogo de departamento. No requiere migración.

**Unicidad del nombre.** El índice actual hace único el nombre en toda la tabla (`DepartmentConfiguration.cs:17`),
y la fuente repite ALMACEN, CALIDAD y PRODUCCION como hijos de PLASTIFAR CENTROAMERICA (filas 13, 14 y 18). Con
el índice actual esos tres hijos no pueden guardarse con su nombre corto. Se propone, en una migración nueva,
sustituir la unicidad global por la unicidad dentro del mismo padre (`ParentId`, nombre sin distinguir
mayúsculas) y ajustar la comprobación de `DepartmentsController.cs:86`. La alternativa, que no toca el índice,
es guardar el nombre completo `PADRE / HIJO`: cabe en los 60 caracteres (el más largo de la fuente tiene 41),
pero repite el nombre del padre en cada pantalla. Se cierra en la revisión cruzada.

### 6.2 Cambios en `Staff` **[Propuesta]**

| Campo | Tipo | Regla |
|---|---|---|
| `LegacyUsername` | string(40)? | Usuario en el sistema anterior. Único cuando viene. Sirve para emparejar la carga; no se usa para iniciar sesión |

`LegacyStaffId` ya existe para el arrastre del sistema anterior (`api/Models/Staff.cs:25`; sección 2.2 del plan
original). El libro no trae identificadores numéricos, solo el nombre de usuario; de ahí el campo adicional.

### 6.3 Roles

No cambia el modelo. Los cinco roles se crean como filas de `Rol`.

### 6.4 Baja lógica de tickets y de tareas **[Propuesta]**

La fuente concede «Eliminar» sobre tickets (fila 5) y sobre tareas (fila 18).

**Lo que hay hoy en el código** (comprobado el 11 de octubre de 2026):

- `Ticket` (`api/Models/Ticket.cs:4-91`) y `TicketTask` (`api/Models/TicketTask.cs:13-55`) no tienen ningún campo
  de baja lógica ni equivalente. En todo el backend no existe ninguna propiedad `DeletedAt` o `IsDeleted`, ni
  ningún filtro global de consulta (`HasQueryFilter`).
- El ticket no tiene endpoint de eliminación ni se borra en ningún punto del código. Lo que existe es la
  cancelación, que es un estado (`TicketStatus.Cancelado`) con motivo obligatorio (`TicketsController.cs:2077`)
  y deja el ticket visible; no sirve como eliminación.
- La tarea se borra físicamente (`TicketTasksController.cs:569`) y antes deja un evento en el historial del
  ticket (:558-565).

**Qué se reutiliza y qué falta.** Se reutilizan el historial del ticket (`TicketEvent`), donde la eliminación de
una tarea ya deja evento, y la bitácora. Lo que falta son los campos: para que los permisos existan sin borrar
filas, `Ticket` y `TicketTask` reciben los mismos tres:

| Campo | Tipo | Regla |
|---|---|---|
| `DeletedAt` | timestamptz? | Sello de la eliminación. Nulo mientras el registro está vigente |
| `DeletedByStaffId` | int? | Quién lo eliminó |
| `DeleteReason` | text? | Motivo escrito; obligatorio al eliminar |

Un registro con `DeletedAt` deja de aparecer en listados, contadores, búsquedas y reportes, y su detalle
responde 404; sigue en la base y en la bitácora. Como el proyecto no tiene ningún filtro global de consulta, esa
exclusión no ocurre sola: o se añade la condición en cada consulta de tickets y de tareas (bandeja, contadores,
tablero, reportes y proceso de vencimientos), o se introduce un filtro global, que sería el primero del
proyecto. Cuál de las dos se cierra en la revisión cruzada con el responsable de la Bandeja. Los cambios sobre
`TicketTask` se coordinan con el documento 02, que amplía el mismo modelo.

**Condición de salida [Propuesta].** Los endpoints de eliminación no se habilitan hasta que la exclusión esté
aplicada y probada en todos los consumidores; entregar la eliminación antes deja registros «eliminados» que
siguen activos. La lista mínima de consumidores, que se completa en la revisión cruzada, es: la bandeja y su
detalle, los contadores, la búsqueda, el tablero, los reportes, el proceso de vencimientos
(`SlaBreachWorker`), que hoy revisa cada minuto y notifica al asignado, el seguimiento de plazos de tareas
del documento 02 y las notificaciones. Si se opta por añadir la condición consulta a consulta, cada
consumidor lleva su propia prueba; si se opta por el filtro global, la prueba cubre además las consultas
que deban saltárselo, como la bitácora.

**Índices obligatorios:** `Department.Type`; `Department.DefaultRoleId`; `Department.MailboxId`;
`Staff.LegacyUsername` único parcial; `Ticket.DeletedAt` y `TicketTask.DeletedAt`, para excluir lo eliminado sin
recorrer la tabla; y, si se aprueba el cambio de unicidad, `(Department.ParentId, nombre)` único en lugar del
índice único actual sobre `Department.Name`.

## 7. Catálogos y datos semilla

### 7.1 Roles **[Fuente]**

Hoja `ROLES`, A2:A6.

| # | Rol en la fuente | Observación | Valor propuesto |
|---|---|---|---|
| 1 | `ALL ACCESS` | | Sin cambio |
| 2 | `EXPANDED ACCESS` | | Sin cambio |
| 3 | `LIMITE ACCESS` | Probable errata de «LIMITED» | `LIMITED ACCESS` |
| 4 | `SUPPORT ` | Lleva un espacio final. No tiene columna en `PERMISOS`, ni agentes, ni departamentos | `SUPPORT`, inactivo y sin permisos |
| 5 | `VIEW ONLY` | No tiene columna en `PERMISOS`, ni agentes, ni departamentos | Sin cambio, inactivo y sin permisos |

La fuente no describe ningún rol.

### 7.2 Departamentos **[Fuente]**

Hoja `DEPARTAMENTOS`, columnas A, B, C y E. La jerarquía está codificada en el nombre como `PADRE / HIJO`. Hay 14
departamentos de primer nivel; tres de ellos tienen hijos (6, 8 y 9 respectivamente).

| Fila | NOMBRE | TIPO | CORREO | PERMISOS |
|---|---|---|---|---|
| 2 | ADMINISTRACION | PRIVADO | info@plastifar.com | LIMITE ACCESS |
| 3 | ALMACEN | PUBLICO | info@plastifar.com | LIMITE ACCESS |
| 4 | AUDITORIA | PRIVADO | info@plastifar.com | LIMITE ACCESS |
| 5 | BACKOFFICE | PUBLICO | info@plastifar.com | ALL ACCESS |
| 6 | CALIDAD | PRIVADO | info@plastifar.com | LIMITE ACCESS |
| 7 | COSTOS | PRIVADO | info@plastifar.com | LIMITE ACCESS |
| 8 | CREDITOS Y COBROS | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 9 | INFORMATICA | PRIVADO | info@plastifar.com | LIMITE ACCESS |
| 10 | MEJORA CONTINUA | PRIVADO | info@plastifar.com | LIMITE ACCESS |
| 11 | MONITOREO | PUBLICO | info@plastifar.com | LIMITE ACCESS |
| 12 | PLASTIFAR CENTROAMERICA | PUBLICO | infogt@plastifar.com | LIMITE ACCESS |
| 13 | PLASTIFAR CENTROAMERICA / ALMACEN | PUBLICO | infogt@plastifar.com | LIMITE ACCESS |
| 14 | PLASTIFAR CENTROAMERICA / CALIDAD | PUBLICO | infogt@plastifar.com | LIMITE ACCESS |
| 15 | PLASTIFAR CENTROAMERICA / COMERCIAL | PUBLICO | infogt@plastifar.com | EXPANDED ACCESS |
| 16 | PLASTIFAR CENTROAMERICA / COMPRAS | PUBLICO | infogt@plastifar.com | LIMITE ACCESS |
| 17 | PLASTIFAR CENTROAMERICA / FINANZAS | PUBLICO | infogt@plastifar.com | LIMITE ACCESS |
| 18 | PLASTIFAR CENTROAMERICA / PRODUCCION | PUBLICO | infogt@plastifar.com | LIMITE ACCESS |
| 19 | PRODUCCION | PUBLICO | info@plastifar.com | LIMITE ACCESS |
| 20 | SOPORTE | PRIVASO | info@plastifar.com | ALL ACCESS |
| 21 | VENTAS INTERNACIONALES | PUBLICO | info@plastifar.com | LIMITE ACCESS |
| 22 | VENTAS INTERNACIONALES / CARIBE | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 23 | VENTAS INTERNACIONALES / CENTROAMERICA | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 24 | VENTAS INTERNACIONALES / CUBA | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 25 | VENTAS INTERNACIONALES / FLORIDA | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 26 | VENTAS INTERNACIONALES / LAS ISLAS | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 27 | VENTAS INTERNACIONALES / PUERTO RICO | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 28 | VENTAS INTERNACIONALES / ZONA NORESTE USA | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 29 | VENTAS INTERNACIONALES / ZONA OESTE USA | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 30 | VENTAS LOCALES | PUBLICO | info@plastifar.com | LIMITE ACCESS |
| 31 | VENTAS LOCALES / HAITI | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 32 | VENTAS LOCALES / INSTITUCIONALES | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 33 | VENTAS LOCALES / KEY ACCONTS | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 34 | VENTAS LOCALES / REGION NORTE O CIBAO | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 35 | VENTAS LOCALES / ZONA ESTE | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 36 | VENTAS LOCALES / ZONA METROPOLITANA | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 37 | VENTAS LOCALES / ZONA SANTO DOMINGO ESTE | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 38 | VENTAS LOCALES / ZONA SANTO DOMINGO NORTE | PUBLICO | info@plastifar.com | EXPANDED ACCESS |
| 39 | VENTAS LOCALES / ZONA SUR | PUBLICO | info@plastifar.com | EXPANDED ACCESS |

Totales: tipo PUBLICO 31, PRIVADO 6, «PRIVASO» 1; rol EXPANDED ACCESS 19, LIMITE ACCESS 17, ALL ACCESS 2;
buzón `info@plastifar.com` en 31 filas e `infogt@plastifar.com` en las 7 de PLASTIFAR CENTROAMERICA.

Erratas de la fuente y valor propuesto:

| Fila | En la fuente | Valor propuesto |
|---|---|---|
| 20 | Tipo `PRIVASO` | `PRIVADO` |
| 33 | `VENTAS LOCALES / KEY ACCONTS` | `VENTAS LOCALES / KEY ACCOUNTS` (la hoja `AGENTES` escribe «KEY ACCOUNTS») |

**Administrador (columna D).** Tiene valor en 35 filas y está vacío en tres: AUDITORIA, SOPORTE y VENTAS
INTERNACIONALES. Los nombres no se copian aquí; al cargar se emparejan con `Staff`. Cuatro no coinciden con la
grafía de la hoja `AGENTES` y hay que confirmarlos:

| Fila(s) | En `DEPARTAMENTOS` | En `AGENTES` |
|---|---|---|
| 23, 24 | CATALONA MORA DE CIFRE | CATALINA MORA DE CIFRE |
| 25 | KIRSIS RUBIO | KIRSYS RUBIO |
| 32, 33 | LUIS GREGORI | LUIS GREGORIO CRUZ |
| 17 | ARNOLDO DE LEON | ARNOLDO DE LEÓN |

### 7.3 Agentes

La lista de 101 agentes es dato semilla real, pero no se transcribe en este documento: se carga directamente
desde la hoja `AGENTES` (A2:E102).

**[Fuente]** Totales:

| Corte | Cantidad |
|---|---|
| Agentes | 101 |
| Estado `ACTIVO` | 88 |
| Estado `BLOQUEADO` | 13 |
| Rol `LIMITE ACCESS` | 48 (47 activos, 1 bloqueado) |
| Rol `EXPANDED ACCESS` | 35 |
| Rol `ALL ACCESS` | 5 |
| Sin rol | 13 (12 bloqueados, 1 activo) |

No hay nombres ni usuarios duplicados. `BLOQUEADO` corresponde a `IsActive = false`.

**Problemas que bloquean o condicionan la carga:**

| # | Problema | Efecto |
|---|---|---|
| 1 | Ningún agente trae correo electrónico. `Staff.Email` es obligatorio y único | **Bloquea toda la carga.** Las alternativas para desbloquearla están en la sección 8.1 |
| 2 | La consulta que generó la hoja descartó 38 columnas, una por departamento. Con toda probabilidad contenían el acceso de cada agente a departamentos adicionales (inferencia). El archivo de origen no está en el libro | Solo puede cargarse el departamento principal; los accesos secundarios se pierden |
| 3 | El departamento principal no coincide con los nombres de `DEPARTAMENTOS`: variantes con tilde («ADMINISTRACIÓN», «PRODUCCIÓN», «CENTROAMÉRICA»), «CREDITO Y COBROS» frente a «CREDITOS Y COBROS», y los hijos escritos solo con el nombre final («FLORIDA», «HAITI», «ZONA SUR») | Requiere una tabla de equivalencias antes de cargar |
| 4 | Nombres finales ambiguos: ALMACEN, CALIDAD y PRODUCCION existen en el primer nivel y también bajo PLASTIFAR CENTROAMERICA. COMERCIAL, COMPRAS y FINANZAS existen solo bajo PLASTIFAR CENTROAMERICA | No puede resolverse sin confirmación de Plastifar para cada agente afectado |
| 5 | Un agente activo no tiene rol (fila 26) | No puede otorgársele acceso |
| 6 | Un agente bloqueado conserva su rol (fila 30); los otros 12 bloqueados no | Inconsistencia menor; se carga inactivo |
| 7 | Cinco usuarios no siguen el patrón inicial más apellido (filas 3, 80, 83, 84 y 98) | Se conservan tal cual en `LegacyUsername` |
| 8 | Nombres con doble espacio o con espacio de no separación (23 filas), y «ZONA ESTE » con espacio final | Se normalizan los espacios al cargar |
| 9 | La hoja trae el nombre completo en una sola columna; `Staff` separa nombre y apellido | Requiere una regla de separación o revisión manual |
| 10 | Ningún agente tiene SOPORTE, CUBA, LAS ISLAS ni ZONA SANTO DOMINGO ESTE como departamento principal | Esos departamentos quedan sin personal |

### 7.4 Claves de permiso y matriz

**[Fuente]** Hoja `PERMISOS`. Cada celda concedida es una fórmula que apunta al rol en `ROLES`; una celda vacía
significa no concedido. La columna `ROL4` está vacía en todas las filas. La agrupación en «tickets» y «tareas» no
existe en la hoja: se deduce del texto de cada fila.

**[Propuesta]** La columna «Clave» asigna a cada fila una clave con la convención `modulo.accion` del plan
original (sección 6.2).

| Fila | Permiso en la fuente (literal) | ALL | EXPANDED | LIMITE | Clave | Estado de la clave |
|---|---|:-:|:-:|:-:|---|---|
| 2 | Asignar — Capacidad de asignar tareas a agentes o equipos | ✔ | ✔ | ✔ | `tickets.assign` | Existe |
| 3 | Cerrar — Capacidad de cerrar tickets | ✔ | ✔ | ✔ | `tickets.close` | Existe |
| 4 | Crear — Capacidad de abrir Tickets en nombre de los usuarios | ✔ | ✔ | ✔ | `tickets.create` | Nueva; hoy dentro de `tickets.write` |
| 5 | Eliminar — Capacidad de borrar tickets | ✔ | | | `tickets.delete` | Nueva; función inexistente. Se implementa como baja lógica auditada (sección 8, regla 9) |
| 6 | Editar — Posibilidad de editar Tickets | ✔ | ✔ | | `tickets.edit` | Nueva; hoy dentro de `tickets.write` |
| 7 | Editar hilo — Capacidad de editar los elementos del hilo de otros agentes | ✔ | | | `tickets.edit_thread` | Nueva; función inexistente |
| 8 | Link — Ability to link tickets | ✔ | | | `tickets.link` | Nueva; función inexistente |
| 9 | Marcar como contestados — Ability to mark a ticket as Answered/Unanswered | ✔ | | | `tickets.mark_answered` | Nueva; función inexistente |
| 10 | Merge — Ability to merge tickets | ✔ | ✔ | | `tickets.merge` | Nueva; función inexistente |
| 11 | Responder al cliente — Capacidad de publicar una respuesta del Ticket | ✔ | ✔ | | `tickets.reply` | Nueva; hoy dentro de `tickets.write` |
| 12 | Referido — Habilidad para administrar tickets referidos | ✔ | ✔ | | `tickets.refer` | Nueva; función inexistente |
| 13 | Publicado — Habilidad para realizar una asignación de ticket | ✔ | ✔ | ✔ | `tickets.release` | Nueva; significado por confirmar |
| 14 | Transferir — Capacidad de transferir tickets entre departament | ✔ | | | `tickets.transfer` | Nueva |
| 15 | Asignar — Capacidad de asignar tickets a agentes o equipos | ✔ | ✔ | ✔ | `tasks.assign` | Nueva |
| 16 | Cerrar — Capacidad de cerrar tareas | ✔ | ✔ | ✔ | `tasks.close` | Nueva |
| 17 | Crear — Capacidad de crear tareas | ✔ | ✔ | | `tasks.create` | Nueva |
| 18 | Eliminar — Capacidad de borrar tareas | ✔ | | | `tasks.delete` | Nueva. Hoy el borrado de tareas es físico; se propone baja lógica auditada (sección 8, regla 9) |
| 19 | Editar — Capacidad de editar tareas | ✔ | ✔ | | `tasks.edit` | Nueva |
| 20 | Responder al cliente — Capacidad de publicar actualizaciones de tareas | ✔ | ✔ | ✔ | `tasks.comment` | Nueva |
| 21 | Transferir — Capacidad de transferencia de Tickets entre departamentos | ✔ | ✔ | | `tasks.transfer` | Nueva; texto contradictorio |

Totales por rol: ALL ACCESS 20 de 20; EXPANDED ACCESS 14; LIMITE ACCESS 7 (filas 2, 3, 4, 13, 15, 16 y 20).
SUPPORT y VIEW ONLY no tienen columna ni concesiones.

Problemas de la fuente:

- **Filas 2 y 15 parecen intercambiadas.** La fila 2 está entre los permisos de ticket pero dice «tareas»; la
  fila 15 está entre los de tarea pero dice «tickets». Tienen las mismas concesiones, de modo que el intercambio
  no cambia el resultado. Se asignan por posición: fila 2 a tickets, fila 15 a tareas.
- **Filas 14 y 21 describen lo mismo con concesiones distintas.** Las dos hablan de transferir tickets entre
  departamentos; la 14 la concede solo a ALL ACCESS y la 21 también a EXPANDED ACCESS. Por su posición, la 21 es
  probablemente «transferir tareas».
- **Fila 14 truncada:** termina en «departament».
- **Filas 8, 9 y 10** están en inglés.
- **Fila 13** es ambigua. Probablemente traduce «Release — release ticket assignment» (liberar una asignación);
  esto es una inferencia.
- **LIMITE ACCESS puede crear tickets (fila 4) pero no responder al cliente (fila 11);** puede asignar y cerrar
  tareas (filas 15 y 16) pero no crearlas (fila 17).
- **No hay ningún permiso fuera de tickets y tareas:** nada sobre clientes, personal, roles, reportes,
  configuración, calidad ni aprobación de créditos.

**[Propuesta]** Claves adicionales que la fuente no menciona pero el sistema necesita:

| Clave | Permite | Razón |
|---|---|---|
| `tasks.read` | Ver las tareas de sus departamentos | Prerrequisito de todas las claves `tasks.*`, igual que `tickets.read` lo es de las de tickets |

## 8. Lógica de negocio

1. **[Propuesta]** `tickets.write` se divide en `tickets.create`, `tickets.edit` y `tickets.reply`. Una
   migración de datos sustituye `tickets.write` por las tres en cada rol que la tenga, de modo que ningún rol
   existente pierde capacidad. Después de la migración, `tickets.write` deja de existir en el catálogo, lo que
   obliga a actualizar en el mismo cambio sus tres apariciones: la constante y su definición
   (`PermissionCatalog.cs:27`, :63), el tipo espejo del frontend (`src/types/permissions.ts:33`) y el rol de
   demostración (`DevelopmentSeeder.cs:410`). Conviene tener presente que hoy ningún endpoint consulta
   `tickets.write` (sección 5): la división no retira nada por sí sola; lo que cambia el comportamiento es que
   los endpoints empiecen a exigir las claves (sección 10).
2. **[Propuesta]** Toda clave `tasks.*` exige `tasks.read`, y toda clave nueva de tickets exige `tickets.read`,
   con el mismo mecanismo de prerrequisitos que ya valida el catálogo (`PermissionCatalog.cs:106-115`; se
   aplica al guardar un rol o la matriz, `api/Security/PermissionValidation.cs:26-44`).
   **[Propuesta]** Las claves `tasks.*` son todas nuevas, de modo que ningún rol existente las tiene. Hoy
   cualquier persona con sesión y alcance sobre el departamento del ticket puede listar, crear, editar,
   completar, reabrir y comentar tareas (sección 5). Para que nadie pierda esas acciones, la misma migración
   de datos de la regla 1 concede `tasks.read`, `tasks.create`, `tasks.edit`, `tasks.close` y `tasks.comment`
   a todo rol existente que tenga `tickets.read`. `tasks.delete` no se concede por migración: hoy eliminar
   una tarea exige ser su creador o administrador (`TicketTasksController.cs:549`), y al pasar a depender de
   la clave el creador que no la tenga deja de poder eliminar su propia tarea; ese cambio es deliberado, es
   lo que la matriz de la fuente dispone (fila 18, solo ALL ACCESS), y se avisa al responsable de la Bandeja.
   **Orden obligatorio:** la migración que concede las claves se aplica en el mismo despliegue que la
   comprobación en los endpoints, o antes; nunca después.
3. **[Abierta]** Precedencia entre el rol del agente y el rol del departamento. La fuente asigna un rol en dos
   sitios —la columna `PERMISOS` de `AGENTES` y la columna `PERMISOS` de `DEPARTAMENTOS`— y no dice cuál manda
   cuando difieren, que es lo habitual (ejemplos en la pregunta 3). Este plan no toma partido. Lo único que se
   construye sin esperar la respuesta es guardar los dos datos tal como vienen: el rol del departamento en
   `Department.DefaultRoleId` y el rol del agente en el archivo de carga. Qué hace el sistema con
   `DefaultRoleId` —si concede permisos, si limita los del agente, si los amplía o si solo informa— se define
   cuando Plastifar responda. Conviene tener presente una restricción del modelo actual: el permiso efectivo
   sale del rol guardado en el acceso por persona y departamento (`StaffDepartmentAccess.RoleId`), de modo que
   elegir con qué rol se crea ese acceso ya es aplicar una de las opciones.
4. **[Propuesta]** Al cargar un agente se crea un único acceso: su departamento principal, marcado como
   principal; el mismo departamento va en `Staff.PrimaryDepartmentId`, que es obligatorio. **[Abierta]** El rol
   de ese acceso depende de la regla 3: mientras la pregunta 3 esté abierta, la carga no otorga accesos reales.
   Cómo se crea la cuenta —con invitación por correo, con nombre de usuario o inactiva— depende de la
   alternativa que se elija en la sección 8.1. A los agentes `BLOQUEADO` se les crea inactivos y no se les envía
   invitación en ningún caso.
5. **[Propuesta]** Un departamento `Privado` se guarda y se muestra como tal, pero no cambia ninguna regla de
   visibilidad hasta que Plastifar defina qué significa (pregunta 6).
6. **[Propuesta]** Los cinco roles se crean como roles normales, no del sistema, para que Plastifar pueda
   ajustarlos desde la matriz. SUPPORT y VIEW ONLY se crean inactivos y sin permisos.
7. **[Propuesta]** Las claves de funciones inexistentes (`tickets.edit_thread`, `tickets.link`,
   `tickets.mark_answered`, `tickets.merge`, `tickets.refer`, `tickets.release`) se registran en el catálogo
   para poder cargar la matriz, y la matriz las muestra con la indicación «función no disponible todavía».
8. **Reglas de la sección 6.3 del plan original.** Ya no se mantienen en bloque: son reglas de la maqueta y
   cada una se contrasta con la fuente. Las que el código aplica se describen como comportamiento construido;
   este documento no las modifica, pero tampoco las da por requisito de Plastifar.

   | Regla del plan original (6.3) | Qué dice la fuente | Tratamiento |
   |---|---|---|
   | 1. Permiso efectivo: el administrador tiene todos; los demás, la unión de los permisos de sus roles en `StaffDepartmentAccess` | **Calla en parte y abre una duda.** La fuente no tiene la figura de administrador: su nivel más alto es el rol ALL ACCESS, que tienen 5 agentes. Y asigna rol en dos sitios, el agente y el departamento, sin decir cómo se combinan | **[Abierta]** Cómo se combinan los roles es la pregunta 3; quiénes son administradores del sistema, la pregunta 15 |
   | 2. Alcance por departamento: el permiso solo vale en los departamentos donde la persona tiene el rol que lo otorga | **No lo confirma.** La hoja `AGENTES` da un rol y un departamento principal por agente; las 38 columnas por departamento que la consulta descartó sugieren acceso por departamento, pero es una inferencia. El tipo PUBLICO de 31 departamentos puede significar visibilidad entre departamentos | **[Abierta]** Preguntas 6 y 16 |
   | 3. `tickets.read_all` como excepción de supervisión, que amplía la lectura sin conceder escritura | **Calla.** La matriz no tiene ningún permiso de lectura ni de supervisión | **[Abierta]** Pregunta 16 |
   | 4. Los roles del sistema no se editan ni se eliminan | Calla. Es una protección técnica ya implementada (`Rol.IsSystem`), no una regla de proceso | Sigue vigente como salvaguarda técnica. Los cinco roles de la fuente se crean como roles normales (regla 6) |
   | 5. El cambio de permisos de un rol tarda hasta 15 minutos en reflejarse, por la vida del token; lo sensible se comprueba contra la base | Calla. Es un criterio de ingeniería | Sigue vigente como estándar técnico |
   | 6. El último administrador no puede degradarse ni desactivarse | Calla. Es una protección técnica | Sigue vigente como salvaguarda técnica |

   **Supuesto provisional de trabajo** para las reglas 1 a 3: el código queda como está —permiso por rol y
   departamento, con herencia hacia los hijos—, porque es lo construido, no porque Plastifar lo haya pedido.
9. **Eliminación de tickets y de tareas.** **[Fuente]** La matriz concede «Eliminar — Capacidad de borrar
   tickets» (fila 5) y «Eliminar — Capacidad de borrar tareas» (fila 18), las dos solo a ALL ACCESS. El plan
   original decía que un ticket no se elimina, se cancela (sección 9.4, regla 9); es una regla de negocio de la
   maqueta y, por la regla de precedencia (README, sección 5), no puede negar un permiso que la operación real
   tiene. **[Propuesta]** Las dos claves se crean, `tickets.delete` y `tasks.delete`, y la eliminación se
   implementa como **baja lógica auditada**: el registro se marca con `DeletedAt`, `DeletedByStaffId` y
   `DeleteReason` (sección 6.4), desaparece de listados, contadores, búsquedas y reportes, y queda en la base y
   en la bitácora con actor, fecha y motivo. Así se cumple a la vez el permiso que pide la fuente y el estándar
   de ingeniería de baja lógica por defecto (sección 4 del plan original), que sigue vigente. Eliminar es
   distinto de cancelar: un ticket cancelado sigue visible con su estado; uno eliminado deja de verse.
   Para las tareas esto cambia el comportamiento actual: hoy el borrado es físico (`Remove`,
   `TicketTasksController.cs:569`) y lo puede hacer el creador o un administrador (:549); se propone que pase a
   ser lógico y que lo gobierne `tasks.delete`. **[Abierta]** Si Plastifar necesita además la eliminación física
   —por ejemplo, para retirar datos cargados por error— se pregunta (pregunta 4); no se construye mientras
   tanto.

### 8.1 Alternativas para los agentes sin correo electrónico **[Abierta]**

La hoja `AGENTES` no trae correo de ninguno de los 101 agentes; trae un nombre de usuario. En el sistema actual
el correo es obligatorio y único (`Staff.cs:8`; `StaffConfiguration.cs:18`) y el alta envía por correo una
invitación con un código válido 24 horas (`StaffController.cs:204-226`). Sin correo, por tanto, hoy no puede
crearse ninguna cuenta. Hay tres salidas y este plan no elige ninguna.

**Cómo depende hoy la autenticación del correo** (comprobado contra el código el 11 de octubre de 2026):

| Pieza | Dónde | Qué hace con el correo |
|---|---|---|
| Inicio de sesión | `api/Controllers/AuthController.cs:28-55`; cuerpo `LoginRequest(Email, Password)` en `api/Dtos/AuthDtos.cs:3` | Normaliza el correo y busca a la persona por `Email` y `IsActive` (:33-37). No hay otro identificador de entrada |
| Token de acceso | `api/Services/TokenService.cs:60-67` | El sujeto es el identificador numérico (:60), no el correo; pero el correo viaja como dato del token (:61), junto con nombre, marca de administrador y accesos por departamento |
| Recuperación de contraseña | `AuthController.cs:207-227` (solicitar), :229-242 (verificar código) y :244-274 (restablecer) | Los tres pasos identifican a la persona por su correo, y el código se envía a esa dirección (:330-354). Sin correo no hay ningún canal de recuperación |
| Primera contraseña | `StaffController.cs:204-226` | La invitación con el código viaja por correo |
| Cambio de contraseña con sesión abierta | `AuthController.cs:159-205` | No usa el correo: identifica por la sesión |
| Edición de personal | `StaffController.cs:252-255`, :302 | El correo es obligatorio y se valida único también al editar |
| Pantalla de inicio de sesión | `src/pages/auth/LoginPage.tsx:14`, :173-174 | El esquema exige un correo con formato válido y el campo es de tipo correo. Existen además `ForgotPasswordPage.tsx` y `ResetPasswordPage.tsx`, que parten del correo |

Con eso, lo que cada alternativa exige es:

| Alternativa | Qué implica | Qué deja sin resolver |
|---|---|---|
| (a) Plastifar entrega los correos | No cambia el modelo ni el alta. La carga sigue el flujo existente: contraseña aleatoria, nunca una fija, e invitación por correo. Es la única que no toca el módulo de Autenticación | Depende de un tercero y puede que parte del personal no tenga correo corporativo |
| (b) Inicio de sesión por nombre de usuario, con correo opcional | Seis cambios, todos en el módulo de Autenticación y Personal, que es la implementación de referencia del plan original: (1) `Staff.Email` pasa a opcional y su índice único a parcial, en una migración nueva; (2) hace falta un nombre de usuario único para iniciar sesión: el `LegacyUsername` propuesto en la sección 6.2 dejaría de ser solo un dato heredado; (3) `LoginRequest` y la búsqueda de `AuthController.cs:33-37` aceptan usuario o correo; (4) el dato de correo del token (`TokenService.cs:61`) pasa a ser opcional, y hay que revisar qué lo consume en el frontend, cosa que no se revisó aquí; (5) la primera contraseña y la recuperación necesitan un canal nuevo, porque hoy los tres pasos de recuperación y la invitación dependen del correo: por ejemplo, una contraseña temporal que fija un administrador, con cambio obligatorio al entrar, lo que exige un endpoint que hoy no existe; (6) `LoginPage.tsx` deja de exigir formato de correo (:14, :173-174) y las pantallas de recuperación necesitan una salida para quien no tiene correo | Quien no tiene correo tampoco recibe los avisos de vencimiento ni de asignación, y depende de un administrador para recuperar el acceso |
| (c) Cargar a los agentes inactivos hasta que se informe su correo | Aun así `Staff.Email` es obligatorio: o se vuelve opcional solo para personal inactivo, con la regla de que nadie se activa sin correo, o se guarda un valor provisional, lo que este plan desaconseja porque introduce direcciones falsas. La carga no envía invitaciones; al completar el correo de una persona se la activa y se le invita con el flujo existente. No toca el inicio de sesión ni la recuperación, que ya ignoran al personal inactivo (`AuthController.cs:37`, :213) | Mientras estén inactivos no pueden recibir asignaciones: los documentos 00 y 02 proponen que solo el personal activo sea responsable, de modo que tipos de tarea, plantas y equipos siguen sin responsables |

Las alternativas (b) y (c) pueden combinarse con (a) para una parte del personal. Elegir es decisión de
Plastifar y del equipo (pregunta 1); hasta entonces la carga de agentes está bloqueada.

## 9. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-O1 | El departamento admite tipo (público o privado), rol del departamento, buzón y responsable, editables desde su diálogo |
| RF-O2 | El listado de departamentos filtra por tipo y muestra el rol del departamento y el buzón |
| RF-O3 | **[Abierta]** El efecto del rol del departamento al otorgar un acceso se especifica cuando se resuelva la pregunta 3; hasta entonces el dato solo se guarda y se muestra |
| RF-O4 | El catálogo de permisos incluye el grupo «Tareas» y las claves nuevas de «Tickets», con nombre legible en español |
| RF-O5 | La matriz de permisos señala las claves cuya función aún no está disponible |
| RF-O6 | Todo endpoint de tickets y de tareas declara la clave que exige y responde 403 con mensaje explicativo cuando falta |
| RF-O7 | Carga única de los 38 departamentos y los 5 roles con su matriz, repetible sin duplicar |
| RF-O8 | Carga de agentes desde archivo, con informe de filas creadas y rechazadas y el motivo de cada rechazo |
| RF-O9 | La ficha del colaborador muestra el usuario del sistema anterior cuando existe |
| RF-O10 | Quien tiene `tickets.delete` puede eliminar un ticket, y quien tiene `tasks.delete` una tarea, con motivo obligatorio y confirmación; el registro deja de verse y queda en la bitácora |

## 10. Endpoints

| Método y ruta | Descripción | Permiso |
|---|---|---|
| `GET /api/permissions` y `GET /api/permissions/matrix` | Ya existen (`PermissionsController.cs:30`, :37); devuelven además el grupo «Tareas» y la marca de función no disponible | Autenticado · `roles.read` |
| `GET /api/departments` | Ya existe (`DepartmentsController.cs:53`); no está paginado a propósito, porque alimenta desplegables (:43-46). Añade `type`, `defaultRoleId`, `mailboxId` y `managerStaffId` a la respuesta, y el filtro `type` | Autenticado |
| `POST · PUT /api/departments` | Ya existen (:78, :126); alta y edición con los campos nuevos y con `managerStaffId` | `settings.write` |
| `POST /api/staff/import` | Carga de agentes por archivo, con informe. Su comportamiento ante las filas sin correo depende de la alternativa de la sección 8.1 | Administrador (`AdminOnly`), igual que el alta existente (`StaffController.cs:166`) |
| `DELETE /api/tickets/{id}` (nuevo) | Baja lógica auditada del ticket, con motivo en el cuerpo. No borra la fila | `tickets.delete` |
| Endpoints de `TicketsController` | Sustituir `AdminOnly` por la clave correspondiente: asignar (:1419) y asignación masiva (:1561) → `tickets.assign`; prioridad masiva (:1701) → `tickets.edit`; cambio de estado (:1799) → `tickets.close`. Añadir comprobación de clave donde hoy solo se exige sesión: crear (:375) → `tickets.create`; editar (:701) → `tickets.edit`; responder (:1081) → `tickets.reply` | Según la tabla 7.4 |
| Endpoints de `TicketTasksController` | Añadir comprobación de clave: listar (:86) y enlace de adjunto (:490), crear (:109), editar (:178), completar (:263) y reabrir (:377), comentar (:433), eliminar (:535). El de eliminar pasa de borrado físico (:569) a baja lógica auditada con motivo, y deja de depender de ser el creador o administrador (:549) para depender de la clave | `tasks.read`, `tasks.create`, `tasks.edit`, `tasks.close`, `tasks.comment`, `tasks.delete` |

Los departamentos y roles iniciales entran por una migración de datos o un comando de carga, no por la
interfaz; debe poder ejecutarse dos veces sin duplicar.

## 11. Pantallas

- **Departamentos** (`src/pages/departments/DepartmentsPage.tsx`, `DepartmentModal.tsx`): se añaden cuatro campos
  al diálogo existente (tipo, rol del departamento, buzón y responsable) y dos columnas al listado. Filtro por
  tipo con `FilterChip`.
- **Tickets y tareas:** acción «Eliminar» visible solo con la clave correspondiente, con `ConfirmDialog` y motivo
  obligatorio. Nunca `confirm` del navegador.
- **Permisos:** la matriz existente (`PermissionMatrix.tsx`) no cambia de estructura; recibe un grupo más y una
  indicación por clave. La indicación usa `Badge` y `Tooltip`, sin variantes nuevas.
- **Personal:** acción «Cargar agentes» en el listado, con un diálogo que muestra el resultado; el usuario
  heredado aparece en la ficha.
- Componentes: `Modal`, `Field`, `Select`, `FilterChip`, `DataTable`, `Badge`, `Tooltip`, `Alert`,
  `ConfirmDialog`.

## 12. Permisos

Este módulo no crea claves para sí mismo. Usa `settings.write` para departamentos (`DepartmentsController.cs:79`,
:127) y `roles.write` para roles y para la matriz (`RolesController.cs:90`, :116; `PermissionsController.cs:112`).
La carga de agentes exige administrador, porque así está protegida hoy toda escritura de personal
(`StaffController.cs:166`); `staff.write` existe en el catálogo, pero ningún endpoint del servidor lo consulta:
solo lo usa el frontend para mostrar acciones (`src/pages/staff/StaffDetailPage.tsx:47`). Las claves que
este documento define son las de la tabla 7.4, que consumen la Bandeja y sus tareas.

## 13. Validación

Reglas espejo entre Zod y el servidor.

| Campo | Regla |
|---|---|
| `Department.Type` | Obligatorio; `Publico` o `Privado` |
| `Department.DefaultRoleId` | Opcional; debe ser un rol activo |
| `Department.MailboxId` | Opcional; debe ser un buzón activo |
| Permisos de un rol | Cada clave debe pertenecer al catálogo y cumplir sus prerrequisitos; las desconocidas se rechazan con 400 |
| Archivo de agentes | CSV en UTF-8; departamento principal existente; rol existente. El correo, cuando viene, con formato válido y único; si es obligatorio en cada fila depende de la alternativa de la sección 8.1 |
| `Staff.LegacyUsername` | Opcional; hasta 40 caracteres; único |
| Eliminar ticket o tarea | Motivo obligatorio, de 10 a 500 caracteres; un registro ya eliminado responde 404 |

## 14. Criterios de aceptación

- [ ] Los 38 departamentos quedan cargados con su jerarquía de dos niveles, tipo, rol del departamento y buzón.
- [ ] Los 5 roles existen; ALL ACCESS, EXPANDED ACCESS y LIMITED ACCESS con las concesiones de la tabla 7.4.
- [ ] Ejecutar la carga dos veces no duplica departamentos ni roles.
- [ ] Un rol que tenía `tickets.write` conserva exactamente las mismas capacidades después de la migración.
- [ ] Un usuario con rol LIMITED ACCESS puede crear un ticket y recibe 403 al intentar responder al cliente.
- [ ] Un usuario sin `tasks.create` recibe 403 al crear una tarea por API directa y no ve el botón.
- [ ] Un rol que antes de la migración tenía `tickets.read` conserva, después de activar las claves, las
      acciones sobre tareas que hoy tiene: listar, crear, editar, completar, reabrir y comentar.
- [ ] Un ticket o una tarea eliminados no generan avisos de vencimiento ni de asignación, y no aparecen en la
      búsqueda, el tablero ni los reportes; cada consumidor de la lista de la sección 6.4 tiene su prueba.
- [ ] La carga de agentes trata las filas sin correo según la alternativa elegida en la sección 8.1 y lo informa
      fila por fila; este criterio se concreta al resolver la pregunta 1.
- [ ] Ningún acceso real de agente se otorga mientras la pregunta 3 siga abierta.
- [ ] Un usuario con rol ALL ACCESS elimina un ticket indicando el motivo: el ticket deja de aparecer en
      listados y contadores, su fila sigue en la base y la bitácora registra actor, fecha y motivo.
- [ ] Un usuario con rol EXPANDED ACCESS recibe 403 al intentar eliminar un ticket o una tarea y no ve la acción.
- [ ] Eliminar una tarea ya no borra su fila.
- [ ] Ningún endpoint de tickets ni de tareas queda protegido solo por la marca de administrador.
- [ ] Cumple la lista de verificación de cierre de la sección 4.5 del plan original.

## 15. Riesgos

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| Dividir `tickets.write` y empezar a exigir las claves | Hoy crear, editar y responder tickets solo exigen sesión y alcance por departamento; al exigir claves, quien no las tenga en su rol pierde acciones que hoy puede hacer | Migración de datos probada sobre una base con roles reales; revisar los roles antes de activar la comprobación; acuerdo previo con el responsable de la Bandeja |
| Exigir las claves `tasks.*`, que ningún rol tiene | Al activar la comprobación, todo usuario no administrador recibe 403 en las tareas | Migración de datos que las concede a los roles con `tickets.read`, aplicada antes o junto con la comprobación (sección 8, regla 2) |
| Eliminación habilitada antes de excluir lo eliminado en todos los consumidores | Un registro eliminado sigue visible o sigue generando avisos de vencimiento | Condición de salida de la sección 6.4: no se habilita el endpoint hasta probar cada consumidor |
| Cargar la matriz tal cual | LIMITED ACCESS crea tickets que no puede responder | Confirmar con Plastifar antes de aplicar (pregunta 7) |
| Claves sin función | La matriz promete acciones que no existen | Indicación visible en la matriz; no ocultarlas |
| Agentes sin correo | No se puede asignar ninguna tarea ni SLA a personas reales | Plantear a Plastifar las tres alternativas de la sección 8.1 como primera gestión |
| Precedencia de roles sin definir | Se otorgan permisos de más o de menos a 101 personas | No otorgar accesos reales hasta resolver la pregunta 3; los dos datos se guardan para poder aplicar cualquier respuesta |
| La eliminación pasa a existir | Un ticket o una tarea desaparece de la vista por error | Baja lógica con motivo obligatorio y confirmación; el registro se conserva y puede recuperarse desde la base |
| El borrado de tareas cambia de físico a lógico | Cambia un comportamiento ya entregado en el módulo de otro responsable | Acordarlo con el responsable de la Bandeja antes de escribirlo |
| Accesos secundarios perdidos | Personas que hoy ven varios departamentos verán solo uno | Pedir el archivo original de agentes |
| El libro describe el sistema anterior | Se replica una configuración que quizá ya no refleja la operación | Validar la organización con Plastifar antes de la carga definitiva |

## 16. Preguntas abiertas para Plastifar

La última columna es siempre un supuesto provisional de trabajo de este plan, nunca una regla de Plastifar ni
del plan original (README, sección 2).

| # | Pregunta | Opciones | Se asume mientras tanto |
|---|---|---|---|
| 1 | Los 101 agentes no traen correo electrónico y el sistema lo exige para crear la cuenta e iniciar sesión. ¿Cómo se resuelve? En cualquier caso, ¿puede entregarse la lista con nombre y apellido separados? | (a) Plastifar entrega los correos; (b) inicio de sesión por nombre de usuario, con correo opcional; (c) cargar a los agentes inactivos hasta que se informe su correo. Lo que implica cada una está en la sección 8.1 | **Ninguno.** Es un bloqueo: no se carga ningún agente hasta elegir una alternativa |
| 2 | ¿Puede entregarse el archivo de agentes original, con las 38 columnas de acceso por departamento? | — | Solo se carga el departamento principal |
| 3 | El rol figura en el agente y en el departamento, y se contradicen. Hay un agente con rol limitado que administra cinco departamentos marcados como ampliados, y un departamento limitado con cuatro agentes de acceso total. ¿Cuál prevalece? | (a) el del agente, en todos los departamentos a los que accede; (b) el del departamento, para todo el que accede a él; (c) el más amplio de los dos; (d) el más restrictivo de los dos; (e) el del agente en su departamento principal y el del departamento en los demás | **Ninguno.** Se guardan los dos datos tal como vienen y no se otorga ningún acceso real hasta tener la respuesta |
| 4 | La matriz concede «Eliminar» sobre tickets y sobre tareas a ALL ACCESS. El plan las implementa como baja lógica auditada: el registro deja de verse, pero se conserva con actor, fecha y motivo. ¿Basta con eso, o Plastifar necesita que el registro se borre físicamente de la base? Si hace falta el borrado físico, ¿en qué casos y quién lo autoriza? | (a) basta la baja lógica; (b) hace falta además el borrado físico, en los casos que Plastifar indique | Las claves `tickets.delete` y `tasks.delete` se crean, porque la fuente las concede. Supuesto provisional de trabajo: (a), baja lógica; el borrado físico no se construye |
| 5 | ¿Deben construirse las funciones de fusionar, vincular, transferir, referir, liberar asignación, editar el hilo de otro y marcar como contestado? | Por función: sí o no | Solo se reservan las claves |
| 6 | ¿Qué significa que un departamento sea PUBLICO o PRIVADO? | (a) visible o no para el cliente al escribir; (b) visible o no para otros departamentos; (c) solo informativo | (c) |
| 7 | ¿Es intencional que LIMITE ACCESS pueda crear tickets pero no responder al cliente, y cerrar tareas pero no crearlas? | (a) sí; (b) es herencia del sistema anterior y debe revisarse | (a): se carga tal cual |
| 8 | SUPPORT y VIEW ONLY no tienen permisos ni usuarios. ¿Se usan? | (a) se eliminan; (b) Plastifar define sus permisos | Se crean inactivos y sin permisos |
| 9 | Las filas 14 y 21 hablan de transferir tickets con concesiones distintas. ¿La fila 21 es «transferir tareas»? | (a) sí; (b) no, es un duplicado y vale la fila 14 | (a) |
| 10 | La fila 13, «Publicado — Habilidad para realizar una asignación de ticket», ¿qué acción es? | (a) liberar una asignación; (b) otra | (a) |
| 11 | ¿Qué permisos tienen estos roles fuera de tickets y tareas (clientes, personal, calidad, reportes, configuración)? | Por rol y por módulo | Ninguno; solo las claves de la tabla 7.4 más sus prerrequisitos de lectura |
| 12 | ¿El correo del departamento es el buzón por el que entra el correo, la dirección con la que responde, o ambas? | (a) entrada; (b) salida; (c) ambas | (c) |
| 13 | AUDITORIA, SOPORTE y VENTAS INTERNACIONALES no tienen administrador. ¿Quién lo es? | — | Se cargan sin responsable |
| 14 | ¿A qué departamento pertenecen los agentes cuyo departamento principal es ALMACEN, CALIDAD o PRODUCCION: al de primer nivel o al de PLASTIFAR CENTROAMERICA? | Por agente | Al de primer nivel, salvo quien administra el departamento de Centroamérica |
| 15 | El sistema tiene una marca de administrador que da todos los permisos y la administración de personal, roles y configuración. La fuente no tiene esa figura: su nivel más alto es el rol ALL ACCESS, con 5 agentes. ¿Quiénes son administradores del sistema? | (a) los agentes con ALL ACCESS; (b) personas que Plastifar designe aparte; (c) solo el equipo técnico | **Ninguno.** La carga no marca a nadie como administrador |
| 16 | ¿El permiso de una persona vale solo en los departamentos donde tiene rol, o alcanza a otros? ¿Existe una figura de supervisión que vea todos los departamentos sin poder escribir? El plan original responde las dos cosas (sección 6.3, reglas 2 y 3) y la fuente no las confirma | Alcance: (a) solo sus departamentos y los hijos de estos; (b) además, los departamentos PUBLICO; (c) todos. Supervisión: (d) existe, con lectura total; (e) no existe | Supuesto provisional de trabajo: (a) y (d), que es como está construido el código |
