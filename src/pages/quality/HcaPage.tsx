import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clientsApi } from "../../api/clients";
import { productLinesApi } from "../../api/productLines";
import {
  qualityApi,
  type SheetCounts,
  type SheetListResponse,
  type SheetQuery,
} from "../../api/quality";
import { staffApi } from "../../api/staff";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import { ControlInput } from "../../components/ui/ControlInput";
import { CriteriaField, CriteriaSelect } from "../../components/ui/CriteriaField";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { describeDue, formatDay, isSheetOverdue } from "../../lib/quality";
import type { Client } from "../../types/clients";
import type { ProductLine } from "../../types/settings";
import type { QualityStaff } from "../../types/quality";
import { HcaModal } from "./HcaModal";
import { HcaStatusBadge } from "./StatusBadges";
import { TicketLink } from "./TicketLink";

type ChipKey = "todas" | "abiertas" | "vencidas" | "cerradas";
/** Solo lo que el servidor sabe ordenar (SheetQuery.sort). */
type SortKey = "compromiso" | "cliente";

const CHIPS: { key: ChipKey; label: string; status?: string; countKey: "all" | "open" | "overdue" | "closed" }[] = [
  { key: "todas", label: "Todas", countKey: "all" },
  { key: "abiertas", label: "Abiertas", status: "abiertas", countKey: "open" },
  { key: "vencidas", label: "Vencidas", status: "vencidas", countKey: "overdue" },
  { key: "cerradas", label: "Cerradas", status: "cerradas", countKey: "closed" },
];

/**
 * Lo que el listado debe, antes de lo que contiene. La ficha ya abria diciendo
 * que bloqueaba el cierre; el listado abria con una tabla muda. Solo se dice lo
 * que el servidor cuenta: vencidas y abiertas, nada inventado.
 */
function listDebt(counts: SheetCounts): string {
  if (counts.overdue === 0) {
    return counts.open === 1
      ? "Queda 1 HCA abierta y ninguna vencida."
      : `Quedan ${counts.open} HCA abiertas y ninguna vencida.`;
  }

  const head =
    counts.overdue === 1 ? "1 HCA pasó su fecha comprometida" : `${counts.overdue} HCA pasaron su fecha comprometida`;
  return `${head}, sobre ${counts.open} ${counts.open === 1 ? "abierta" : "abiertas"}. Ninguna se cierra hasta resolver su plan y verificar la eficacia.`;
}

/** RF-Q1: listado paginado de HCA con pastillas por estado y filtros por linea
 *  de producto, responsable, cliente y rango de fechas. */
export function HcaPage() {
  const { can } = usePermissions();
  const canWrite = can("quality.write");

  const [clients, setClients] = useState<Client[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [staff, setStaff] = useState<QualityStaff[]>([]);

  const [search, setSearch] = useState("");
  const [productLineId, setProductLineId] = useState("todas");
  const [responsibleId, setResponsibleId] = useState("todos");
  const [clientId, setClientId] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chip, setChip] = useState<ChipKey>("todas");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "compromiso", dir: "asc" });
  const [pageSize, setPageSize] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search).trim();

  useEffect(() => {
    clientsApi
      .list({ page: 1, pageSize: 100 })
      .then((data) => setClients(data.items))
      .catch(() => setClients([]));

    productLinesApi
      .list()
      .then((data) => setProductLines(data.items))
      .catch(() => setProductLines([]));

    staffApi
      .list({ page: 1, pageSize: 100, status: "activos" })
      .then((data) => setStaff(data.items.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))))
      .catch(() => setStaff([]));
  }, []);

  function clientName(id: number) {
    return clients.find((client) => client.id === id)?.name ?? "—";
  }

  function lineName(id: number) {
    return productLines.find((line) => line.id === id)?.name ?? "—";
  }

  function staffName(id: number | null) {
    if (id === null) return "—";
    return staff.find((person) => person.id === id)?.name ?? "—";
  }

  const criteria: Omit<SheetQuery, "page"> = {
    pageSize,
    search: debouncedSearch || undefined,
    productLineId: productLineId === "todas" ? undefined : Number(productLineId),
    responsibleId: responsibleId === "todos" ? undefined : Number(responsibleId),
    clientId: clientId === "todos" ? undefined : Number(clientId),
    from: from || undefined,
    to: to || undefined,
    status: CHIPS.find((c) => c.key === chip)?.status,
    sort: sort.key,
    dir: sort.dir,
  };

  const { data, isStale, error, setPage, refresh } = usePagedList<SheetQuery, SheetListResponse>({
    fetch: qualityApi.sheets.list,
    criteria,
    fallbackError: "No se pudieron cargar las HCA. Vuelve a intentarlo.",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const unfiltered =
    chip === "todas" &&
    productLineId === "todas" &&
    responsibleId === "todos" &&
    clientId === "todos" &&
    from === "" &&
    to === "" &&
    !debouncedSearch;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div>
      <ModuleHeader
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva HCA
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <CriteriaField label="Buscar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Número, cliente o descripción…"
            className="w-[230px]"
          />
        </CriteriaField>

        <CriteriaSelect
          label="Línea"
          ariaLabel="Filtrar por línea de producto"
          value={productLineId}
          onChange={setProductLineId}
          width="w-[160px]"
          options={[
            { value: "todas", label: "Todas las líneas" },
            ...productLines.map((line) => ({ value: String(line.id), label: line.name })),
          ]}
        />

        <CriteriaSelect
          label="Responsable"
          ariaLabel="Filtrar por responsable"
          value={responsibleId}
          onChange={setResponsibleId}
          width="w-[170px]"
          options={[
            { value: "todos", label: "Todos los responsables" },
            ...staff.map((person) => ({ value: String(person.id), label: person.name })),
          ]}
        />

        <CriteriaSelect
          label="Cliente"
          ariaLabel="Filtrar por cliente"
          value={clientId}
          onChange={setClientId}
          options={[
            { value: "todos", label: "Todos los clientes" },
            ...clients.map((client) => ({ value: String(client.id), label: client.name })),
          ]}
          width="w-[200px]"
        />

        <div className="flex items-end gap-2">
          <CriteriaField label="Detectada desde" htmlFor="hca-desde">
            <ControlInput
              id="hca-desde"
              type="date"
              className="w-[140px]"
              value={from}
              max={to === "" ? undefined : to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </CriteriaField>

          <CriteriaField label="Hasta" htmlFor="hca-hasta">
            <ControlInput
              id="hca-hasta"
              type="date"
              className="w-[140px]"
              value={to}
              min={from === "" ? undefined : from}
              onChange={(event) => setTo(event.target.value)}
            />
          </CriteriaField>
        </div>

        {/* Antes de la primera respuesta no hay contadores: un «0» al lado de
            «Vencidas» es un dato, y seria falso. Se reserva el sitio y nada mas. */}
        <div className="flex flex-wrap items-center gap-2">
          {counts
            ? CHIPS.map(({ key, label, countKey }) => (
                <FilterChip
                  key={key}
                  label={label}
                  count={counts[countKey]}
                  active={chip === key}
                  onClick={() => setChip(key)}
                />
              ))
            : CHIPS.map(({ key }) => (
                <span
                  key={key}
                  aria-hidden
                  className="h-8 w-[104px] animate-pulse rounded-full bg-fill"
                />
              ))}
        </div>
      </div>

      {error && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Alert variant="error">{error}</Alert>
          </div>
          <Button size="sm" variant="secondary" onClick={refresh}>
            Reintentar
          </Button>
        </div>
      )}

      {counts && (counts.overdue > 0 || counts.open > 0) && (
        <p className="mb-3 text-[12.5px] text-brand-gray">{listDebt(counts)}</p>
      )}

      {data === null ? (
        // Con un error de carga no hay nada que esperar: el aviso ya trae el
        // reintento, y una rueda eterna debajo del aviso mentia.
        error === null && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )
      ) : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {unfiltered
            ? "Todavía no hay HCA registradas."
            : "Ninguna HCA coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
          <DataTable>
            <thead>
              <HeadRow>
                {/* Sin flecha: el servidor no ordena por número (SheetQuery.sort
                    solo admite compromiso y cliente), y un control que gira el
                    cursor sin cambiar el orden es peor que no tenerlo. */}
                <Th>Número</Th>
                <Th sort={{ dir: sort.key === "cliente" ? sort.dir : null, onToggle: () => toggleSort("cliente") }}>
                  Cliente
                </Th>
                <Th>Línea</Th>
                <Th>Responsable</Th>
                <Th
                  sort={{ dir: sort.key === "compromiso" ? sort.dir : null, onToggle: () => toggleSort("compromiso") }}
                >
                  Vence
                </Th>
                <Th>Estado</Th>
                <Th>Ticket</Th>
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((sheet) => {
                const overdue = isSheetOverdue(sheet);

                return (
                  <Row key={sheet.id}>
                    <Td>
                      <Link
                        to={`/calidad/hca/${sheet.id}`}
                        className="rounded-edge whitespace-nowrap font-mono text-[12px] font-medium text-ink underline-offset-4
                          outline-none hover:underline focus-visible:ring-3 focus-visible:ring-brand-red/20"
                      >
                        {sheet.number}
                      </Link>
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">{clientName(sheet.clientId)}</Td>
                    <Td className="text-[12.5px] text-brand-gray">{lineName(sheet.productLineId)}</Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-brand-gray">
                      {staffName(sheet.responsibleStaffId)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="block text-[12.5px] tabular-nums text-brand-gray">
                        {formatDay(sheet.dueDate)}
                      </span>
                      {sheet.status !== "Cerrada" && (
                        <span
                          className={`block text-[11.5px] ${
                            overdue ? "font-medium text-brand-red-dark" : "text-faint"
                          }`}
                        >
                          {describeDue(sheet.dueDate)}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <HcaStatusBadge status={sheet.status} overdue={overdue} />
                    </Td>
                    <Td>
                      <TicketLink number={sheet.ticketNumber} />
                    </Td>
                  </Row>
                );
              })}
            </tbody>
          </DataTable>

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="HCA"
          />
        </div>
      )}

      {modalOpen && (
        <HcaModal
          clients={clients}
          productLines={productLines}
          staff={staff}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
