import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ticketsApi } from "../../api/tickets";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import type { TicketDetailResponse } from "../../types/api";
import { TicketExecutiveSummary, TicketExecutiveSummarySkeleton } from "./TicketExecutiveSummary";

interface TicketSummaryDrawerProps {
  ticketId: number;
  onClose: () => void;
}

export function TicketSummaryDrawer({ ticketId, onClose }: TicketSummaryDrawerProps) {
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [tasksCount, setTasksCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    return Promise.all([
      ticketsApi.getById(ticketId),
      ticketsApi.getTasks(ticketId).then((items) => items.length).catch(() => 0),
    ])
      .then(([detail, tasks]) => {
        setTicket(detail);
        setTasksCount(tasks);
      })
      .catch(() => {
        setError("No se pudo cargar el resumen del ticket.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      ticketsApi.getById(ticketId),
      ticketsApi.getTasks(ticketId).then((items) => items.length).catch(() => 0),
    ])
      .then(([detail, tasks]) => {
        if (!active) return;
        setTicket(detail);
        setTasksCount(tasks);
      })
      .catch(() => {
        if (!active) return;
        setError("No se pudo cargar el resumen del ticket.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ticketId]);

  return (
    <Drawer
      title={ticket ? `Ticket · ${ticket.number}` : "Resumen del ticket"}
      eyebrow="Bandeja de tickets"
      description={
        loading
          ? undefined
          : ticket
            ? `${ticket.clientName ?? "Sin cliente"} · ${ticket.status}`
            : undefined
      }
      maxWidth="max-w-[760px]"
      onClose={onClose}
      footer={({ requestClose }) => (
        <div className="flex w-full items-center justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={requestClose}>
            Cerrar
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!ticket}
            onClick={() => {
              onClose();
              navigate(`/tickets/${ticketId}`);
            }}
          >
            <span>Ver ficha completa</span>
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    >
      {loading ? (
        <TicketExecutiveSummarySkeleton />
      ) : error ? (
        <ErrorRetry onRetry={() => void load()}>{error}</ErrorRetry>
      ) : ticket ? (
        <div className="pb-2">
          <TicketExecutiveSummary ticket={ticket} tasksCount={tasksCount} />
        </div>
      ) : null}
    </Drawer>
  );
}
