import { Check, Lock, Minus } from "lucide-react";
import { Fragment, useId, useMemo, useRef, useState } from "react";
import type { PermissionGroup, PermissionKey, RoleSummary } from "../../types/permissions";

interface PermissionMatrixProps {
  groups: PermissionGroup[];
  roles: RoleSummary[];
  /** Concesiones vigentes en pantalla, por id de rol. */
  grants: Record<number, PermissionKey[]>;
  /** Concesiones tal como llegaron del servidor, para senalar lo que cambio. */
  original: Record<number, PermissionKey[]>;
  onToggle: (roleId: number, key: PermissionKey) => void;
  readOnly?: boolean;
}

/**
 * Matriz de permisos: los permisos bajan por el eje vertical agrupados por
 * modulo, los roles cruzan por el horizontal. Se lee la politica entera de la
 * instalacion de una vez, que es lo que un listado por rol no permite.
 *
 * La primera columna y la cabecera quedan fijas: sin ellas, a la sexta columna
 * ya no se sabe que fila se esta marcando ni que rol es cada columna.
 */
export function PermissionMatrix({
  groups,
  roles,
  grants,
  original,
  onToggle,
  readOnly = false,
}: PermissionMatrixProps) {
  // Cruz de lectura: la fila y la columna del cursor se tinen a la vez.
  const [crosshair, setCrosshair] = useState<{ row: string | null; column: number | null }>({
    row: null,
    column: null,
  });

  /** Explicacion de la celda que se esta mirando; se lee bajo la rejilla. */
  const [hint, setHint] = useState<string | null>(null);
  const hintId = useId();

  // Orden plano de las filas visibles, para moverse con las flechas.
  const flat = useMemo(
    () => groups.flatMap((group) => group.permissions.map((permission) => permission.key)),
    [groups],
  );

  /**
   * Tabulador roving: la rejilla entera es una sola parada de tabulacion y por
   * dentro se navega con las flechas. Con una parada por celda, 16 permisos por
   * 6 roles obligan a 96 pulsaciones para cruzar la tabla.
   */
  const rowOf = useMemo(() => new Map(flat.map((key, index) => [key, index])), [flat]);

  const [cursor, setCursor] = useState({ row: 0, column: 0 });
  const cellRefs = useRef(new Map<string, HTMLButtonElement | null>());

  /**
   * Columnas por las que pasa el cursor de la rejilla. La del administrador
   * queda fuera —concede todo el catalogo y su celda es un candado—, pero el
   * modo consulta no quita ninguna: dejar de ser accionable no es dejar de ser
   * contenido, y sin paradas la matriz entera queda fuera del alcance del
   * teclado. Si todos los roles conceden todo, se conserva la primera columna
   * para que la rejilla siga siendo legible.
   */
  const reachable = useMemo(() => {
    const columns = roles.reduce<number[]>((acc, role, index) => {
      if (!isLocked(role)) acc.push(index);
      return acc;
    }, []);
    if (columns.length > 0) return columns;
    return roles.length > 0 ? [0] : [];
  }, [roles]);

  const activeRow = Math.min(cursor.row, Math.max(flat.length - 1, 0));
  const activeColumn = reachable.includes(cursor.column) ? cursor.column : (reachable[0] ?? 0);

  function focusCell(row: number, column: number) {
    const nextRow = Math.min(Math.max(row, 0), flat.length - 1);
    setCursor({ row: nextRow, column });
    cellRefs.current.get(`${nextRow}:${column}`)?.focus();
  }

  /** Siguiente columna alcanzable en la direccion dada; la actual si no hay. */
  function nextColumn(from: number, step: number) {
    const position = reachable.indexOf(from);
    return reachable[position + step] ?? from;
  }

  function handleKeyDown(event: React.KeyboardEvent, row: number, column: number) {
    const moves: Record<string, [number, number]> = {
      ArrowDown: [row + 1, column],
      ArrowUp: [row - 1, column],
      ArrowRight: [row, nextColumn(column, 1)],
      ArrowLeft: [row, nextColumn(column, -1)],
      Home: [row, reachable[0] ?? column],
      End: [row, reachable[reachable.length - 1] ?? column],
    };

    const next = moves[event.key];
    if (!next) return;

    event.preventDefault();
    focusCell(next[0], next[1]);
  }

  /**
   * Lo que bloquea una columna es ser rol del sistema, no cubrir el catalogo
   * entero. Son dos hechos distintos y estaban colapsados en `grantsAll`: un
   * rol del sistema con lista parcial se pintaba editable y el servidor lo
   * rechazaba con 409 al guardar.
   */
  function isLocked(role: RoleSummary) {
    return role.isSystem;
  }

  function isGranted(role: RoleSummary, key: PermissionKey) {
    return (grants[role.id] ?? []).includes(key);
  }

  function hasChanged(role: RoleSummary, key: PermissionKey) {
    if (isLocked(role)) return false;
    return (grants[role.id] ?? []).includes(key) !== (original[role.id] ?? []).includes(key);
  }

  /** Que hace —o por que no hace nada— la celda que se esta mirando. */
  function explain(role: RoleSummary, granted: boolean) {
    if (isLocked(role)) return "Es un rol del sistema: su lista de permisos no se edita";
    if (readOnly) return "Modo consulta: para cambiar esta celda necesitas el permiso roles.write";
    return granted ? "Quitar este permiso" : "Conceder este permiso";
  }

  // La columna del permiso se congela a la izquierda y la cabecera arriba; para
  // que la cabecera se pegue de verdad, el scroll vertical vive en este bloque.
  const stickyName =
    "sticky left-0 w-[210px] min-w-[210px] pr-4 sm:w-[340px] sm:min-w-[340px] sm:pr-6";

  return (
    <div>
      <div
        /* La ventana con alto tope y cabecera fija solo a partir de sm: en 390 px
           la fila de criterios ocupa cuatro lineas, el tope dejaba el borde
           inferior del bloque fuera de pantalla y obligaba a desplazar la pagina
           para llegar a una caja que a su vez se desplaza en dos ejes. Ademas ahi
           solo se ve una columna de roles, asi que congelar la cabecera no paga.

           La caja es enfocable: quien no navega con las flechas de la rejilla
           necesita poder desplazar su propio desbordamiento con el teclado. */
        role="group"
        aria-label="Matriz de permisos por rol"
        tabIndex={0}
        className="overflow-x-auto outline-none focus-visible:ring-3 focus-visible:ring-brand-red/20
          sm:max-h-[calc(100vh-250px)] sm:overflow-auto"
        onBlur={(event) => {
          // Al salir de la rejilla con el teclado, la cruz no puede quedarse encendida.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setCrosshair({ row: null, column: null });
            setHint(null);
          }
        }}
        onMouseLeave={() => setHint(null)}
      >
        {/* min-w-full con una columna de relleno al final: la tabla llega al borde
            del modulo sin que el ancho sobrante estire la columna del permiso. */}
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr>
              <th
                scope="col"
                className={`${stickyName} sticky top-0 z-30 border-b border-line bg-white py-2.5
                  text-left font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint`}
              >
                Permiso
              </th>

              {roles.map((role) => {
                const isColumnActive = crosshair.column === role.id;

                return (
                  <th
                    key={role.id}
                    scope="col"
                    onMouseEnter={() => setCrosshair((state) => ({ ...state, column: role.id }))}
                    className={`sticky top-0 z-20 w-[104px] min-w-[104px] border-b border-line px-2 py-2.5
                      align-bottom transition-colors ${isColumnActive ? "bg-canvas" : "bg-white"}`}
                  >
                    <span className="flex flex-col items-center gap-1 text-center">
                      {/* Regla de la versalita: toda cabecera de columna del panel
                          va en «faint». Un rol inactivo lo dice con su subtitulo,
                          no con un segundo color de cabecera. */}
                      <span className="font-heading text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-faint">
                        {role.name}
                      </span>
                      <span className="text-[10.5px] font-normal normal-case tracking-normal text-faint">
                        {isLocked(role)
                          ? "todo el catálogo"
                          : role.isActive
                            ? `${role.assignedStaff} ${role.assignedStaff === 1 ? "persona" : "personas"}`
                            : "inactivo"}
                      </span>
                    </span>
                  </th>
                );
              })}

              <th className="sticky top-0 z-20 w-full border-b border-line bg-white" />
            </tr>
          </thead>

          <tbody onMouseLeave={() => setCrosshair({ row: null, column: null })}>
            {groups.map((group) => (
              <Fragment key={group.module}>
                <tr>
                  {/* La celda ocupa todo el ancho y quien se congela es el rotulo
                      de dentro: una celda fija que abarca la tabla entera no fija
                      nada, y al desplazar en horizontal el nombre del modulo se
                      iba mientras sus permisos se quedaban. */}
                  <th
                    scope="colgroup"
                    colSpan={roles.length + 2}
                    className="bg-canvas px-0 py-1.5 text-left"
                  >
                    <span className="sticky left-0 inline-block font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
                      {group.module}
                    </span>
                  </th>
                </tr>

                {group.permissions.map((permission) => {
                  const row = rowOf.get(permission.key) ?? 0;
                  const isRowActive = crosshair.row === permission.key;
                  // El administrador concede todo por definicion: si contara, ningun
                  // permiso quedaria nunca «sin asignar» y el aviso no diria nada.
                  const grantedBy = roles.filter(
                    (role) => !isLocked(role) && isGranted(role, permission.key),
                  ).length;

                  return (
                    <tr
                      key={permission.key}
                      onMouseEnter={() =>
                        setCrosshair((state) => ({ ...state, row: permission.key }))
                      }
                      className="border-b border-line-soft last:border-0"
                    >
                      <th
                        scope="row"
                        className={`${stickyName} z-10 py-2 text-left align-middle font-normal transition-colors
                          ${isRowActive ? "bg-canvas" : "bg-white"}`}
                      >
                        <span className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-2">
                            <span className="text-[13px] font-medium leading-tight text-ink">
                              {permission.label}
                            </span>
                            {grantedBy === 0 && (
                              <span className="shrink-0 rounded-full bg-warn/10 px-1.5 py-px text-[10px] font-semibold text-warn">
                                sin asignar
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[10.5px] leading-tight text-faint">
                            {permission.key}
                          </span>
                        </span>
                      </th>

                      {roles.map((role, column) => {
                        const granted = isGranted(role, permission.key);
                        const changed = hasChanged(role, permission.key);
                        const locked = isLocked(role) || readOnly;
                        const isColumnActive = crosshair.column === role.id;
                        const explanation = explain(role, granted);
                        const describedBy = locked
                          ? `${hintId}-${role.id}-${permission.key}`
                          : undefined;

                        return (
                          <td
                            key={role.id}
                            onMouseEnter={() => {
                              setCrosshair({ row: permission.key, column: role.id });
                              setHint(explanation);
                            }}
                            className={`px-2 py-1 text-center transition-colors
                              ${isRowActive || isColumnActive ? "bg-canvas" : ""}`}
                          >
                            <button
                              ref={(node) => {
                                cellRefs.current.set(`${row}:${column}`, node);
                              }}
                              type="button"
                              role="switch"
                              aria-checked={granted}
                              aria-label={`${permission.label} · ${role.name}`}
                              aria-describedby={describedBy}
                              /* Sin `disabled`: un boton deshabilitado no se
                                 enfoca, y en modo consulta eso dejaba la rejilla
                                 —que es toda la pagina— fuera del teclado. */
                              aria-disabled={locked || undefined}
                              tabIndex={row === activeRow && column === activeColumn ? 0 : -1}
                              onKeyDown={(event) => handleKeyDown(event, row, column)}
                              onFocus={() => {
                                setCursor({ row, column });
                                setCrosshair({ row: permission.key, column: role.id });
                                setHint(explanation);
                              }}
                              onClick={() => {
                                if (locked) return;
                                onToggle(role.id, permission.key);
                              }}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-edge border
                                outline-none transition-[background-color,border-color,color]
                                focus-visible:ring-3 focus-visible:ring-brand-red/25
                                ${locked ? "cursor-not-allowed" : ""}
                                ${
                                  granted
                                    ? "border-brand-red/35 bg-brand-red/8 text-brand-red"
                                    : `border-line-strong bg-white text-zinc-400 ${
                                        locked ? "" : "hover:border-zinc-400 hover:text-muted"
                                      }`
                                }
                                ${changed ? "ring-2 ring-inset ring-warn/45" : ""}`}
                            >
                              {isLocked(role) ? (
                                <Lock aria-hidden className="h-3 w-3" />
                              ) : granted ? (
                                <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.75} />
                              ) : (
                                <Minus aria-hidden className="h-3 w-3" />
                              )}
                            </button>

                            {describedBy && (
                              <span id={describedBy} className="sr-only">
                                {explanation}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      <td className={isRowActive ? "bg-canvas" : ""} />
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* El motivo de cada celda vivia en un `title` nativo, que el teclado no
          alcanza. Aqui se lee al pasar el mouse y al enfocar, y quien usa lector
          de pantalla lo recibe por `aria-describedby` en las celdas bloqueadas. */}
      <p aria-hidden className="mt-2 min-h-[18px] text-[11.5px] leading-tight text-faint">
        {hint}
      </p>
    </div>
  );
}
