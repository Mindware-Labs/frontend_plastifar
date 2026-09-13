# Pendientes abiertos

Defectos y avisos verificados que todavía no están resueltos. Cada entrada dice
cómo se comprobó, para que nadie tenga que volver a descubrirlo.

Lo que se arregla sale de aquí. Lo que se decide no arreglar también sale, pero
con una línea que diga quién lo decidió y por qué.

---

## 1. Mover un departamento amplía la bandeja de tickets

**Estado:** abierto · **Toca:** módulo de Richard (Bandeja de tickets) ·
**Aviso pendiente:** sí

`TicketsController` acota lo que se ve con `User.GetAccessibleDepartmentIds()`,
que sale de los claims del token. Desde el commit `c8afb32` el token **expande
cada acceso a los departamentos que cuelgan de él**, porque un rol concedido en
un departamento se ejerce también sobre sus hijos (sección 6.3, regla 2, leída
sobre un árbol y no sobre una lista).

**Hoy no cambia nada.** Todas las filas tienen `ParentId` nulo: la migración
`20260913210120_AddDepartmentHierarchy` crea la columna sin backfill, y el único
camino de escritura es el `POST`/`PUT` de `DepartmentsController`, que no existía
antes. Con el organigrama plano, la expansión devuelve el mismo departamento y
los claims salen idénticos. Está clavado en el test
`A_department_without_children_expands_to_only_itself`.

**El día que se asigne el primer padre, sí cambia:** la bandeja empezará a
mostrar los tickets de los departamentos hijos a quien tenga un rol en el padre.

Es la regla de negocio que se pidió, no una avería. Pero es un cambio visible
dentro de un módulo que no es nuestro, y la regla del plan es que nadie edita el
módulo de otro. **Hay que avisarle a Richard antes de crear la primera
jerarquía en producción, no después.**

Dónde mirar si algo se ve raro:
- `api/Services/DepartmentHierarchy.cs` — la única respuesta a «qué alcanza este»
- `api/Services/TokenService.cs` — dónde se expande el claim
- `api/Security/PermissionChecker.cs` — la comprobación contra la base
- `/departamentos` — la columna «Alcance de un rol» dice a cuánta gente llega

---

## 2. El detalle de un ticket devuelve 500

**Estado:** abierto · **Toca:** módulo de Richard · **Alcance:** el 100 % de los
tickets

```
GET /api/tickets/1  ->  500
Cannot convert string value 'TaskCreated' from the database
to any value in the mapped 'TicketEventType' enum.
```

El listado (`GET /api/tickets`) responde 200; sólo el detalle muere. En la base
de desarrollo hay un ticket y es el que falla, así que la pantalla de detalle no
se puede abrir en local.

Son **dos defectos distintos**, y conviene no confundirlos:

1. **Dato sucio.** `TicketEventType` (`api/Models/TicketEnums.cs:39`) tiene nueve
   valores y `TaskCreated` no está entre ellos. Buscado en todo el backend: no
   hay una sola línea que escriba ese valor. La fila entró a mano, o la escribió
   código que ya no existe.
2. **Fragilidad de lectura.** Una sola fila de historial con un valor
   desconocido tumba el ticket entero. Un evento que el código no sabe leer
   debería ignorarse y registrarse, no impedir abrir la ficha.

El (1) se arregla con una sentencia. El (2) es el que importa, porque vuelve a
pasar con el próximo valor que alguien agregue por un lado y no por el otro.

---

## 3. El dashboard corre sobre datos inventados

**Estado:** abierto y documentado en `PRODUCT.md`

`src/features/cx-dashboard` son nueve archivos alimentados por `mockData.ts`.
No hay cliente de API ni endpoint detrás.

Mientras siga así, **ninguna cifra de esa pantalla puede citarse** en un reporte,
una decisión o una conversación con el cliente. No es una pantalla incompleta:
es una maqueta con aspecto de pantalla terminada, que es peor, porque nada en
ella lo advierte.
