import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AGENTS, TICKETS, type Ticket, type TicketPriority, type TicketStatus } from "../mockData";
import { useApplyFilter } from "../filters";
import { C, FONT, NUM, T, hueFor } from "../styles";
import { Avatar, Card, CardHead } from "./primitives";
import { useFlip } from "./useFlip";

/** El estado es la única columna con semáforo: un segundo código de color en la
 *  misma fila obliga a leer dos leyendas a la vez. */
const STATUS_TONE: Record<TicketStatus, { fg: string; bg: string }> = {
  Abierto: { fg: C.body, bg: C.chip },
  "Por vencer": { fg: hueFor("porVencer").color, bg: hueFor("porVencer").tint },
  "En espera": { fg: C.body, bg: C.chip },
  Vencido: { fg: hueFor("vencido").color, bg: hueFor("vencido").tint },
  Cerrado: { fg: hueFor("cumplido").color, bg: hueFor("cumplido").tint },
};

/** La prioridad va por PESO tipográfico, no por color. */
const PRIORITY_STYLE: Record<TicketPriority, { color: string; fontWeight: number }> = {
  Alta: { color: C.ink, fontWeight: 700 },
  Media: { color: C.body, fontWeight: 500 },
  Baja: { color: C.soft, fontWeight: 500 },
};

type SortKey = "id" | "customer" | "channel" | "priority" | "status" | "mins";

const VISIBLE = 5;

function InlineSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div
      className="cx-search"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        width: 230,
        maxWidth: "100%",
        height: 30,
        padding: "0 9px",
        background: C.card,
        border: `1px solid ${C.hair}`,
        borderRadius: 8,
      }}
    >
      <Search size={13} color={C.soft} aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar ticket o cliente…"
        aria-label="Buscar en la bandeja"
        style={{
          border: "none",
          outline: "none",
          flex: 1,
          minWidth: 0,
          ...T.label,
          fontFamily: FONT,
          color: C.ink,
          background: "transparent",
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            padding: 0,
            color: C.soft,
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/**
 * Bandeja reciente.
 *
 * Cinco filas: el tablero no es la bandeja, es un vistazo, y la bandeja
 * completa vive en `/tickets`. El corte va DESPUÉS de ordenar — aplicado antes,
 * cambiar de columna reordenaría siempre las mismas cinco.
 *
 * Los identificadores van en tinta, no en rojo. Son enlaces, y un enlace rojo
 * en cada fila de una tabla convierte el color de alarma en decoración.
 */
export function RecentTickets({ query }: { query?: string }) {
  const applyFilter = useApplyFilter();
  const [tab, setTab] = useState<"Todos" | TicketStatus>("Todos");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "mins", dir: "asc" });
  const [ownQuery, setOwnQuery] = useState("");

  const controlled = query !== undefined;
  const effectiveQuery = controlled ? query : ownQuery;

  const tabs: ("Todos" | TicketStatus)[] = [
    "Todos",
    "Vencido",
    "Por vencer",
    "Abierto",
    "En espera",
    "Cerrado",
  ];

  const matches = useMemo(() => {
    const needle = effectiveQuery.trim().toLowerCase();
    const filtered = TICKETS.filter((t) => {
      if (tab !== "Todos" && t.status !== tab) return false;
      if (!needle) return true;
      const agent = AGENTS.find((a) => a.id === t.agentId)?.name ?? "";
      return [t.id, t.customer, t.subject, agent].some((f) => f.toLowerCase().includes(needle));
    });
    return [...filtered].sort((a, b) => {
      const A = a[sort.key];
      const B = b[sort.key];
      const cmp =
        typeof A === "number" && typeof B === "number"
          ? A - B
          : String(A).localeCompare(String(B), "es-DO");
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [tab, effectiveQuery, sort]);

  const rows = matches.slice(0, VISIBLE);
  /* Las filas viajan a su nuevo sitio en vez de teletransportarse. */
  const flipRef = useFlip(rows.map((t) => t.id));

  const th = (label: string, key: SortKey, align: "left" | "right" = "left") => {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        style={{ textAlign: align, padding: "0 10px 8px", whiteSpace: "nowrap" }}
      >
        <button
          type="button"
          onClick={() =>
            setSort((s) =>
              s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
            )
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: 0,
            border: "none",
            background: "transparent",
            fontFamily: FONT,
            ...T.caption,
            fontWeight: 700,
            color: active ? C.ink : C.soft,
            cursor: "pointer",
          }}
        >
          {label}
          {active && (sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
        </button>
      </th>
    );
  };

  const fmt = (m: number) =>
    m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h ${m % 60} min`;

  const td: React.CSSProperties = {
    padding: "9px 10px",
    borderTop: `1px solid ${C.hair2}`,
  };

  return (
    <Card className="cx-hover">
      <CardHead
        title="Bandeja reciente"
        hint="Los últimos movimientos de tu equipo. Click en una fila para abrir el ticket."
        right={!controlled ? <InlineSearch value={ownQuery} onChange={setOwnQuery} /> : undefined}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
          margin: "12px 0",
          background: C.chip,
          borderRadius: 8,
          padding: 3,
          width: "fit-content",
          maxWidth: "100%",
        }}
      >
        {tabs.map((t) => {
          const active = tab === t;
          return (
            <button
              type="button"
              key={t}
              aria-pressed={active}
              onClick={() => setTab(t)}
              style={{
                border: "none",
                borderRadius: 6,
                padding: "5px 10px",
                ...T.caption,
                fontFamily: FONT,
                cursor: "pointer",
                background: active ? C.card : "transparent",
                color: active ? C.ink : C.body,
                boxShadow: active ? "none" : "none",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, ...NUM }}>
          <thead>
            <tr>
              {th("Ticket", "id")}
              {th("Cliente", "customer")}
              {th("Canal", "channel")}
              {th("Prioridad", "priority")}
              {th("Estado", "status")}
              <th scope="col" style={{ textAlign: "left", padding: "0 10px 8px", ...T.caption, fontWeight: 700, color: C.soft }}>
                Responsable
              </th>
              {th("Actividad", "mins", "right")}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <TicketRow key={t.id} ticket={t} td={td} fmt={fmt} flipRef={flipRef(t.id)} />
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div style={{ padding: "26px 10px", textAlign: "center" }}>
            <p style={{ ...T.cardTitle, color: C.ink }}>Ningún ticket coincide</p>
            <p style={{ marginTop: 3, ...T.label, color: C.body }}>
              Limpia la búsqueda o elige otro estado.
            </p>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 10,
          paddingTop: 9,
          borderTop: `1px solid ${C.hair}`,
        }}
      >
        <span style={{ ...T.caption, ...NUM, color: C.soft }}>
          {matches.length > VISIBLE
            ? `${VISIBLE} de ${matches.length}`
            : `${matches.length} ${matches.length === 1 ? "ticket" : "tickets"}`}
        </span>
        <button
          type="button"
          onClick={() => applyFilter({ kind: "estado", value: "todos", label: "la bandeja completa" })}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            ...T.caption,
            fontFamily: FONT,
            color: C.body,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          Ver la bandeja completa
        </button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function TicketRow({
  ticket,
  td,
  fmt,
  flipRef,
}: {
  ticket: Ticket;
  td: React.CSSProperties;
  fmt: (m: number) => string;
  flipRef: (node: HTMLElement | null) => void;
}) {
  const applyFilter = useApplyFilter();
  const agent = AGENTS.find((a) => a.id === ticket.agentId);
  const status = STATUS_TONE[ticket.status];

  return (
    <tr ref={flipRef} className="cx-tr">
      <td style={td}>
        <button
          type="button"
          className="cx-id"
          title={`Abrir ${ticket.id}`}
          onClick={() =>
            applyFilter({ kind: "estado", value: ticket.id, label: `el ticket ${ticket.id}` })
          }
          style={{
            display: "block",
            padding: 0,
            border: "none",
            background: "transparent",
            textAlign: "left",
            fontFamily: FONT,
            ...T.label,
            fontWeight: 700,
            color: C.ink,
            cursor: "pointer",
          }}
        >
          {ticket.id}
        </button>
        <span
          style={{
            display: "block",
            ...T.caption,
            fontWeight: 500,
            color: C.soft,
            maxWidth: 210,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {ticket.subject}
        </span>
      </td>
      <td style={{ ...td, ...T.label, color: C.body, whiteSpace: "nowrap" }}>{ticket.customer}</td>
      <td style={{ ...td, ...T.label, color: C.body, whiteSpace: "nowrap" }}>{ticket.channel}</td>
      <td style={{ ...td, whiteSpace: "nowrap" }}>
        <span style={{ ...T.label, ...PRIORITY_STYLE[ticket.priority] }}>{ticket.priority}</span>
      </td>
      <td style={td}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            ...T.caption,
            color: status.fg,
            background: status.bg,
            borderRadius: 99,
            padding: "3px 9px",
            whiteSpace: "nowrap",
          }}
        >
          {ticket.status}
        </span>
      </td>
      <td style={td}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
          <Avatar name={agent?.name ?? "—"} index={ticket.agentId - 1} size={22} />
          <span style={{ ...T.label, color: C.body }}>{agent?.name.split(" ")[0] ?? "Sin asignar"}</span>
        </span>
      </td>
      <td style={{ ...td, ...T.caption, fontWeight: 500, color: C.soft, textAlign: "right", whiteSpace: "nowrap" }}>
        {fmt(ticket.mins)}
      </td>
    </tr>
  );
}
