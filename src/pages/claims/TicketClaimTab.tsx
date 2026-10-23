import { ArrowUpRight, ClipboardList, FileText, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { formatDay } from "../../lib/dates";
import { formatAmount, formatQuantity } from "../../lib/numbers";
import type { CustomerClaim } from "../../types/claims";
import { ClaimFormModal } from "./ClaimFormModal";
import { ClaimStatusBadge } from "./ClaimStatusBadge";

interface TicketClaimTabProps {
  ticketId: number;
  ticketNumber: string;
  clientName: string | null;
  /** `claims.write` sobre el departamento del ticket. */
  canCreate: boolean;
  onClaimChanged?: (claim: CustomerClaim | null) => void;
}

/**
 * RF-R4: la pestaña «Reclamación» del detalle del ticket. Muestra el resumen
 * del PF-FOR-034 y lleva a la ficha; si el ticket no tiene reclamación, la
 * registra desde aquí (RF-R1, mientras el alta conjunta con el ticket se
 * acuerda con el responsable de la Bandeja).
 */
export function TicketClaimTab({ ticketId, ticketNumber, clientName, canCreate, onClaimChanged }: TicketClaimTabProps) {
  const [claim, setClaim] = useState<CustomerClaim | null | "cargando">("cargando");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // El aviso al padre se lee por ref: una funcion nueva en cada render del
  // ticket no debe relanzar la carga de la reclamación.
  const onClaimChangedRef = useRef(onClaimChanged);
  useEffect(() => {
    onClaimChangedRef.current = onClaimChanged;
  });

  // El vaciado ocurre en render, no en el efecto: así cambiar de ticket no
  // deja un fotograma con la reclamación del anterior.
  const [lastTicketId, setLastTicketId] = useState(ticketId);
  if (ticketId !== lastTicketId) {
    setLastTicketId(ticketId);
    setClaim("cargando");
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    claimsApi
      .getByTicket(ticketId)
      .then((detail) => {
        if (cancelled) return;
        setClaim(detail.claim);
        onClaimChangedRef.current?.(detail.claim);
      })
      .catch((err) => {
        if (cancelled) return;
        // 404 es «todavía no tiene»; cualquier otra cosa sí es un error.
        if (err instanceof ApiError && err.status === 404) {
          setClaim(null);
          onClaimChangedRef.current?.(null);
        } else {
          setClaim(null);
          setError(err instanceof ApiError ? err.message : "No se pudo cargar la reclamación.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (claim === "cargando") {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3.5">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (claim === null) {
    return (
      <div className="mt-3.5 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-8 text-center">
        <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
          <FileText className="size-4" strokeWidth={2.25} />
        </div>
        <p className="mt-2.5 font-heading text-[14px] font-semibold text-zinc-800">Sin reclamación registrada</p>
        <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-zinc-500">
          El formulario PF-FOR-034 recoge los productos, el lote, las cantidades y el monto reclamado. Se llena una vez
          por ticket.
        </p>
        {canCreate ? (
          clientName ? (
            <Button size="sm" className="mt-4" onClick={() => setCreating(true)}>
              <Plus className="h-[14px] w-[14px]" />
              Registrar reclamación
            </Button>
          ) : (
            <p className="mt-3 text-[12px] text-warn">Asigna un cliente al ticket antes de registrar la reclamación.</p>
          )
        ) : null}

        {creating && clientName && (
          <ClaimFormModal
            ticketId={ticketId}
            ticketNumber={ticketNumber}
            clientName={clientName}
            onClose={() => setCreating(false)}
            onSaved={(detail) => {
              setClaim(detail.claim);
              onClaimChanged?.(detail.claim);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mt-3.5 rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">PF-FOR-034</span>
            <ClaimStatusBadge status={claim.status} />
            {claim.hcaNumber && (
              <Link to={`/calidad/hca/${claim.hcaId}`} className="inline-flex items-center gap-1 font-mono text-[11.5px] text-zinc-600 hover:text-brand-red">
                <ClipboardList aria-hidden className="h-3.5 w-3.5" />
                {claim.hcaNumber}
              </Link>
            )}
          </div>
          <p className="mt-1.5 text-[13px] text-zinc-800">
            <span className="font-semibold">{claim.reason}</span>
            {claim.reason === "Otros" && claim.reasonOther && <span className="text-zinc-500"> · {claim.reasonOther}</span>}
            <span className="text-zinc-500"> · {formatDay(claim.claimDate)}</span>
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            {claim.plants.map((plant) => plant.name).join(", ")} · {claim.affectedAreas.join(", ")}
          </p>
        </div>
        <Link
          to={`/reclamaciones/${claim.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-[12.5px] font-medium text-zinc-700 shadow-2xs transition-colors hover:border-zinc-300 hover:bg-zinc-50"
        >
          Abrir ficha
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-zinc-100 pt-3 text-[12px] sm:grid-cols-4">
        <div>
          <dt className="font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-400">Productos</dt>
          <dd className="mt-0.5 tabular-nums text-zinc-800">{claim.lines.length}</dd>
        </div>
        <div>
          <dt className="font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-400">Total</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">
            {claim.currency ? formatAmount(claim.totalAmount, claim.currency) : formatQuantity(claim.totalAmount)}
          </dd>
        </div>
        <div>
          <dt className="font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-400">Factura</dt>
          <dd className="mt-0.5 text-zinc-800">{claim.invoiceRef ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-400">Recibida por</dt>
          <dd className="mt-0.5 text-zinc-800">{claim.receivedByName}</dd>
        </div>
      </dl>
    </div>
  );
}
