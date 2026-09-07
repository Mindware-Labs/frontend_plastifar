import { Eye, ListFilter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clientsApi } from "../../api/clients";
import { RowAction } from "../../components/ui/RowAction";
import { Select } from "../../components/ui/Select";
import type { Client } from "../../types/clients";
import { DashboardCard } from "./DashboardCard";

/**
 * Tabla de clientes recientes, con la anatomia completa de la referencia:
 * casilla por fila, buscar, filtro, orden, pastilla de estado y acciones.
 *
 * Cada control hace algo real y llega al servidor: `search`, `status`, `sort` y
 * `dir` son parametros de GET /api/clients, no un filtrado en memoria. La
 * casilla no es decorativa —selecciona filas y el pie dice cuantas van—, y la
 * accion de la fila abre la ficha del cliente, que existe en /clientes/:id.
 *
 * Es la unica pieza del tablero que consulta un tercer endpoint. Se paga esa
 * llamada porque una tabla de agregados no deja hacer nada: aqui se ve un
 * cliente concreto y se entra a el.
 */

type SortKey = "recientes" | "nombre" | "tickets";

const sortParams: Record<SortKey, { sort: string; dir: "asc" | "desc" }> = {
  recientes: { sort: "id", dir: "desc" },
  nombre: { sort: "name", dir: "asc" },
  tickets: { sort: "ticketCount", dir: "desc" },
};

export function ClientsTable() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [sort, setSort] = useState<SortKey>("recientes");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // La busqueda no dispara una consulta por tecla: 350 ms de espera convierten
  // "Supermercados" en una llamada, no en trece.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setFailed(false);
    clientsApi
      .list({
        page: 1,
        pageSize: 8,
        search: debounced.trim() || undefined,
        status,
        ...sortParams[sort],
      })
      .then((response) => {
        if (!alive) return;
        setRows(response.items);
        setTotal(response.total);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
  }, [debounced, status, sort]);

  const allChecked = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const someChecked = rows.some((row) => selected.has(row.id));

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rows.map((row) => row.id)));
  }

  function toggleOne(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const heads = useMemo(
    () => ["Código", "Cliente", "Tipo", "Tickets", "Estado", "Acciones"],
    [],
  );

  return (
    <DashboardCard padding="chart" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div>
          <h2 className="font-heading text-[13px] font-bold tracking-[-0.01em] text-ink">
            Clientes recientes
          </h2>
          <p className="mt-0.5 text-[11.5px] text-faint">
            {isLoading ? "Cargando…" : `${total.toLocaleString("es-DO")} en la cartera`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex items-center">
            <span className="sr-only">Buscar cliente</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-faint"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar"
              className="h-8 w-[184px] rounded-edge border border-line-strong bg-white pl-8 pr-3
                text-[12.5px] text-ink outline-none transition-colors placeholder:text-faint
                hover:border-hairline-hover focus:border-brand-red focus:ring-3
                focus:ring-brand-red/15"
            />
          </label>

          <span className="flex items-center gap-1.5 text-faint">
            <ListFilter className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <Select
              size="sm"
              aria-label="Filtrar por estado"
              value={status}
              onChange={setStatus}
              options={[
                { value: "todos", label: "Todos" },
                { value: "activos", label: "Activos" },
                { value: "inactivos", label: "Inactivos" },
                { value: "sinvendedor", label: "Sin vendedor" },
              ]}
              className="w-[136px]"
            />
          </span>

          <Select
            size="sm"
            aria-label="Ordenar"
            value={sort}
            onChange={(value) => setSort(value as SortKey)}
            options={[
              { value: "recientes", label: "Más recientes" },
              { value: "nombre", label: "Nombre (A–Z)" },
              { value: "tickets", label: "Más tickets" },
            ]}
            className="w-[144px]"
          />
        </div>
      </div>

      {failed ? (
        <p className="mt-6 text-center text-[13.5px] text-faint">
          No se pudo cargar la lista de clientes.
        </p>
      ) : rows.length === 0 && !isLoading ? (
        <p className="mt-6 text-center text-[13.5px] text-faint">
          Ningún cliente coincide con estos criterios.
        </p>
      ) : (
        <div className={`mt-3 -mx-1 overflow-x-auto ${isLoading ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-8 px-1 py-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(node) => {
                      // Indeterminado cuando hay algunas: la casilla de
                      // cabecera dice el estado real, no "ninguna".
                      if (node) node.indeterminate = someChecked && !allChecked;
                    }}
                    onChange={toggleAll}
                    aria-label="Seleccionar todas las filas"
                    className="h-3.5 w-3.5 cursor-pointer accent-brand-red"
                  />
                </th>
                {heads.map((head, index) => (
                  <th
                    key={head}
                    scope="col"
                    className={`px-1 py-2 font-heading text-[10px] font-semibold uppercase
                      tracking-[0.08em] text-faint ${index >= 3 ? "text-right" : "text-left"}`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line-soft last:border-0 hover:bg-canvas"
                >
                  <td className="px-1 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Seleccionar ${row.name}`}
                      className="h-3.5 w-3.5 cursor-pointer accent-brand-red"
                    />
                  </td>
                  <td className="px-1 py-2.5 font-mono text-[10.5px] text-faint">{row.code}</td>
                  <th
                    scope="row"
                    className="px-1 py-2.5 text-left text-[12.5px] font-normal text-ink"
                  >
                    <span className="block max-w-[240px] truncate">{row.name}</span>
                  </th>
                  <td className="px-1 py-2.5 text-[12.5px] text-brand-gray">{row.type}</td>
                  <td className="px-1 py-2.5 text-right text-[12.5px] tabular-nums text-brand-gray">
                    {row.ticketCount}
                  </td>
                  <td className="px-1 py-2.5 text-right">
                    <span
                      className={`inline-flex h-[22px] items-center rounded-full px-2.5
                        text-[11.5px] font-semibold ${
                          row.isActive
                            ? "bg-brand-green/8 text-brand-green"
                            : "bg-fill text-faint"
                        }`}
                    >
                      {row.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-1 py-2.5">
                    <div className="flex justify-end">
                      <RowAction
                        label={`Ver ${row.name}`}
                        icon={Eye}
                        onClick={() => navigate(`/clientes/${row.id}`)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <p className="mt-3 border-t border-line-soft pt-3 text-[12px] text-subtle">
          <span className="font-semibold text-ink">{selected.size}</span>{" "}
          {selected.size === 1 ? "cliente seleccionado" : "clientes seleccionados"} ·{" "}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="cursor-pointer font-medium text-brand-red-dark underline underline-offset-4"
          >
            Quitar selección
          </button>
        </p>
      )}
    </DashboardCard>
  );
}
