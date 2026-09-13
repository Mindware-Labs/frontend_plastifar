import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { departmentsApi } from "../../api/departments";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { ListPanel } from "../../components/ui/ListPanel";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePermissions } from "../../hooks/usePermissions";
import { buildDepartmentTree } from "../../lib/departments";
import type { DepartmentResponse } from "../../types/api";
import { ChipGroup, LoadErrorAlert } from "../settings/catalogSection";
import { useReferenceData } from "../settings/catalogState";
import { DepartmentModal } from "./DepartmentModal";

type ChipKey = "todos" | "activos" | "inactivos";

/** Sangria por nivel. Suficiente para leerse como indice, no tanto como para
 *  que el cuarto nivel empiece a media columna. */
const SANGRIA = 22;

/**
 * El organigrama de la empresa, y lo que cada unidad alcanza.
 *
 * ==================================================================
 * POR QUE ESTA PANTALLA NO ES UN CATALOGO MAS
 * ==================================================================
 * Los demas catalogos de Configuracion cambian COMO SE COMPORTA el sistema: a
 * que cola entra un ticket, cuando vence, con que texto se responde. Este
 * cambia QUIEN PUEDE SOBRE QUE, y por eso vive con Personal y no con ellos.
 *
 * Un rol concedido en un departamento se ejerce tambien sobre todo lo que
 * cuelga de el. Eso convierte «mover un departamento» en una operacion de
 * permisos disfrazada de reordenar un menu: arrastrar «Florida» bajo «Ventas
 * internacionales» le da a los supervisores de Ventas acceso a todo lo de
 * Florida, y nada en el resto del panel lo dice.
 *
 * Por eso cada renglon declara su ALCANCE —cuanta gente queda bajo un rol
 * concedido aqui— y no solo su nombre y su estado. Es la mitad del registro que
 * de verdad importa.
 *
 * ==================================================================
 * UN ARBOL NO SE PAGINA
 * ==================================================================
 * El resto de los listados del panel paginan en servidor, y este no. No es un
 * descuido ni una excepcion de comodidad: cortar un arbol en paginas deja hijos
 * cuyo padre quedo en la pagina anterior, y una sangria cuyo padre no esta a la
 * vista no es jerarquia, es una mentira con formato. Son unidades de la
 * empresa, del orden de la decena, y el servidor documenta la misma exencion.
 *
 * La busqueda, por lo mismo, filtra en memoria y CONSERVA LOS ANCESTROS de cada
 * coincidencia: si buscas «Florida» y su padre desaparece, la fila queda
 * sangrada bajo nada.
 */
export function DepartmentsPage() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [modal, setModal] = useState<"nuevo" | DepartmentResponse | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  // Inactivos incluidos: esta es la unica pantalla desde la que se reactiva
  // algo, y un registro que no se ve no se puede volver a encender.
  const {
    data: all,
    failed,
    reload,
  } = useReferenceData<DepartmentResponse[] | null>(
    () => departmentsApi.list({ includeInactive: true }),
    null,
  );

  const counts = useMemo(() => {
    if (all === null) return undefined;
    return {
      all: all.length,
      active: all.filter((d) => d.isActive).length,
      inactive: all.filter((d) => !d.isActive).length,
    };
  }, [all]);

  /**
   * Cada departamento con su sitio en el arbol y su alcance ya resuelto.
   *
   * `reach` es la suma de colaboradores de el y de todo lo que cuelga de el:
   * la respuesta a «si concedo un rol aqui, sobre cuanta gente queda».
   */
  const nodes = useMemo(() => {
    if (all === null) return [];

    const hijosDe = new Map<number, number[]>();
    for (const d of all) {
      if (d.parentId == null) continue;
      const grupo = hijosDe.get(d.parentId);
      if (grupo) grupo.push(d.id);
      else hijosDe.set(d.parentId, [d.id]);
    }
    const staffDe = new Map(all.map((d) => [d.id, d.staffCount ?? 0]));

    function subtree(id: number): { reach: number; inside: number } {
      let reach = staffDe.get(id) ?? 0;
      let inside = 0;
      const vistos = new Set<number>([id]);
      const pendientes = [...(hijosDe.get(id) ?? [])];
      while (pendientes.length > 0) {
        const actual = pendientes.pop() as number;
        // Un ciclo en los datos no puede colgar la pantalla.
        if (vistos.has(actual)) continue;
        vistos.add(actual);
        inside += 1;
        reach += staffDe.get(actual) ?? 0;
        pendientes.push(...(hijosDe.get(actual) ?? []));
      }
      return { reach, inside };
    }

    return buildDepartmentTree(all).map((d) => ({ ...d, ...subtree(d.id) }));
  }, [all]);

  /** Lo que se pinta: el arbol acotado por pastilla y busqueda, con ancestros. */
  const visible = useMemo(() => {
    const porEstado = nodes.filter((d) =>
      chip === "todos" ? true : chip === "activos" ? d.isActive : !d.isActive,
    );
    if (debouncedSearch === "") return porEstado;

    const permitidos = new Set(porEstado.map((d) => d.id));
    const porId = new Map(nodes.map((d) => [d.id, d]));
    const mostrar = new Set<number>();

    for (const d of porEstado) {
      // Se busca sobre el camino completo: «Ventas / Florida» encuentra por
      // cualquiera de los dos, que es como la gente nombra su zona.
      if (!d.path.toLowerCase().includes(debouncedSearch)) continue;
      mostrar.add(d.id);

      // Los ancestros entran aunque la pastilla los excluya: sin ellos la
      // sangria de la coincidencia no cuelga de nada.
      let padre = d.parentId;
      let saltos = 0;
      while (padre != null && !mostrar.has(padre) && saltos < 10) {
        mostrar.add(padre);
        padre = porId.get(padre)?.parentId ?? null;
        saltos += 1;
      }
    }

    return nodes.filter((d) => mostrar.has(d.id) && (permitidos.has(d.id) || mostrar.has(d.id)));
  }, [nodes, chip, debouncedSearch]);

  const isFiltering = debouncedSearch !== "" || chip !== "todos";

  function askToggle(department: DepartmentResponse & { inside: number; reach: number }) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: department.isActive ? "Desactivar departamento" : "Reactivar departamento",
      description: department.isActive ? (
        <>
          <strong className="font-semibold text-ink">{department.name}</strong> dejará de ofrecerse
          al asignar personal o encolar un ticket.{" "}
          {(department.staffCount ?? 0) > 0 ? (
            <>
              {department.staffCount}{" "}
              {department.staffCount === 1
                ? "colaborador lo conserva"
                : "colaboradores lo conservan"}{" "}
              como departamento primario.
            </>
          ) : (
            <>No hay nadie asignado a él.</>
          )}
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{department.name}</strong> vuelve a estar
          disponible al asignar personal y al encolar un ticket.
        </>
      ),
      confirmLabel: department.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(department.id);
        try {
          // Se relee antes de escribir: el API no tiene activar/desactivar por
          // separado y reenviar la copia pintada revierte lo que cambió alguien
          // más entretanto.
          const current = await departmentsApi.get(department.id);
          await departmentsApi.update(current.id, {
            name: current.name,
            parentId: current.parentId ?? null,
            isActive: !current.isActive,
          });
          reload();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function askDelete(department: DepartmentResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      title: "Eliminar departamento",
      description: (
        <>
          <strong className="font-semibold text-ink">{department.name}</strong> se borra de forma
          permanente. No tiene nada dentro ni nadie asignado, así que no queda historial que
          conservar.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        setBusyId(department.id);
        try {
          await departmentsApi.remove(department.id);
          reload();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <>
      {failed && (
        <LoadErrorAlert message="No se pudieron cargar los departamentos" onRetry={reload} />
      )}

      <ListPanel
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo departamento
            </Button>
          )
        }
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre o camino…"
              className="w-[240px]"
            />

            <span aria-hidden className="mx-1 h-5 w-px bg-line" />

            <ChipGroup label="Filtrar por estado" ready={counts !== undefined}>
              <FilterChip
                label="Todos"
                count={counts?.all ?? 0}
                active={chip === "todos"}
                onClick={() => setChip("todos")}
              />
              <FilterChip
                label="Activos"
                count={counts?.active ?? 0}
                active={chip === "activos"}
                onClick={() => setChip("activos")}
              />
              <FilterChip
                label="Inactivos"
                count={counts?.inactive ?? 0}
                active={chip === "inactivos"}
                onClick={() => setChip("inactivos")}
              />
            </ChipGroup>
          </>
        }
      >
        {all === null ? (
          !failed && <TableSkeleton rows={8} columns={5} />
        ) : visible.length === 0 ? (
          <p className="py-14 text-center text-[13.5px] text-faint">
            {isFiltering
              ? "Ningún departamento coincide con este filtro o búsqueda."
              : "Todavía no hay ningún departamento registrado."}
          </p>
        ) : (
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Departamento</Th>
                <Th className="w-40">Colaboradores</Th>
                <Th className="w-52">Alcance de un rol</Th>
                <Th className="w-28">Estado</Th>
                {canWrite && <Th className="w-28 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {visible.map((d) => {
                const propios = d.staffCount ?? 0;
                const heredadas = d.reach - propios;

                return (
                  <Row key={d.id} busy={busyId === d.id}>
                    <Td>
                      <span className="flex items-center">
                        {d.depth > 0 && (
                          <>
                            <span aria-hidden style={{ width: d.depth * SANGRIA }} />
                            {/* Codo de rama, no un filete horizontal: suelto se
                                leia como un guion pegado al nombre —«— Almacén»,
                                como si el guion fuera parte del nombre propio—.
                                Con el tramo vertical ya solo puede leerse como
                                «cuelga de lo de arriba». Alto fijo: no puede
                                depender de la altura de la fila, que cambia. */}
                            <span
                              aria-hidden
                              className="mr-2 h-3 w-2.5 shrink-0 -translate-y-1/2 rounded-bl-[3px]
                                border-b border-l border-line-strong"
                            />
                          </>
                        )}
                        <span
                          className={
                            d.depth === 0
                              ? "text-[12.5px] font-semibold text-ink"
                              : "text-[12.5px] text-ink"
                          }
                        >
                          {d.name}
                        </span>

                        {/* CUANTAS UNIDADES CUELGAN, con su unidad escrita.
                            Vivia en la columna de alcance junto a las personas,
                            y ahi «3 personas · 3 dentro» eran dos treses de
                            cosas distintas sin nada que lo dijera. Cada columna
                            habla de una sola cosa: esta, del organigrama. */}
                        {d.inside > 0 && (
                          <span className="ml-2 whitespace-nowrap text-[11.5px] tabular-nums text-faint">
                            {d.inside} {d.inside === 1 ? "unidad" : "unidades"}
                          </span>
                        )}
                      </span>
                    </Td>

                    <Td>
                      {propios > 0 ? (
                        <span className="text-[12.5px] tabular-nums text-brand-gray">
                          {propios}
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-faint">Ninguno</span>
                      )}
                    </Td>

                    {/* LA COLUMNA QUE JUSTIFICA LA PANTALLA. Un rol concedido
                        aqui no se queda aqui: baja por el arbol. Mientras el
                        departamento sea una hoja, este numero y el anterior
                        coinciden y no distrae; en cuanto tiene algo dentro, la
                        diferencia es exactamente lo que se hereda. */}
                    <Td>
                      {/* `whitespace-nowrap`: sin esto el desglose partia en dos
                          lineas y esa fila quedaba cuatro pixeles mas alta que
                          las demas. Una tabla con filas de alturas distintas se
                          lee peor aunque nadie sepa decir por que. */}
                      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                        {d.reach === 0 ? (
                          <span className="text-[12.5px] text-faint">Nadie</span>
                        ) : (
                          <>
                            <span className="text-[12.5px] font-medium tabular-nums text-ink">
                              {d.reach}
                            </span>
                            <span className="text-[12.5px] text-brand-gray">
                              {d.reach === 1 ? "persona" : "personas"}
                            </span>
                          </>
                        )}

                        {/* DE DONDE SALE ESE ALCANCE. Es la unica pista de que
                            la herencia existe: un departamento sin nadie dentro
                            que aun asi alcanza a tres personas solo tiene
                            sentido si la fila dice que las hereda. */}
                        {heredadas > 0 && (
                          <span className="text-[11.5px] tabular-nums text-faint">
                            {propios === 0 ? "· todas heredadas" : `· ${heredadas} heredadas`}
                          </span>
                        )}
                      </span>
                    </Td>

                    <Td>
                      <StatusDot active={d.isActive} />
                    </Td>

                    {canWrite && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar ${d.name}`}
                            icon={Pencil}
                            onClick={() => setModal(d)}
                            disabled={busyId === d.id}
                          />
                          <RowAction
                            label={d.isActive ? `Desactivar ${d.name}` : `Reactivar ${d.name}`}
                            icon={Power}
                            onClick={() => askToggle(d)}
                            disabled={busyId === d.id}
                          />
                          {/* El borrado solo aparece cuando de verdad se puede.
                              El servidor lo rechaza si tiene hijos o gente
                              dentro; ofrecer el boton para negarlo despues es
                              hacer pulsar en falso. */}
                          {d.inside === 0 && propios === 0 && (
                            <RowAction
                              label={`Eliminar ${d.name}`}
                              icon={Trash2}
                              danger
                              onClick={() => askDelete(d)}
                              disabled={busyId === d.id}
                            />
                          )}
                        </div>
                      </Td>
                    )}
                  </Row>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </ListPanel>

      {modal !== null && all !== null && (
        <DepartmentModal
          department={modal === "nuevo" ? undefined : modal}
          all={all}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </>
  );
}
