import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ticketsApi } from "../../api/tickets";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import {
  navigateToTicketFullView,
  type EnterpriseListReturnRecord,
} from "../../lib/enterpriseListReturn";
import type { TicketDetailResponse } from "../../types/api";
import { TicketExecutiveSummary, TicketExecutiveSummarySkeleton } from "./TicketExecutiveSummary";

interface TicketSummaryDrawerProps {
  ticketId: number;
  onClose: () => void;
  getReturnSnapshot?: () => Omit<EnterpriseListReturnRecord, "ticketId"> | null;
}

export function TicketSummaryDrawer({ ticketId, onClose, getReturnSnapshot }: TicketSummaryDrawerProps) {
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [tasksCount, setTasksCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    return Promise.all([
      ticketsApi.getById(ticketId).catch(() => null),
      ticketsApi.getTasks(ticketId).catch(() => []),
    ])
      .then(([t, tasks]) => {
        if (!t) {
          setError("No se pudo cargar el ticket.");
          setTicket(null);
          return;
        }
        setTicket(t);
        setTasksCount(Array.isArray(tasks) ? tasks.length : 0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error inesperado al cargar el resumen.");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      ticketsApi.getById(ticketId).catch(() => null),
      ticketsApi.getTasks(ticketId).catch(() => []),
    ]).then(([t, tasks]) => {
      if (!active) return;
      if (!t) {
        setError("No se pudo cargar el ticket.");
        setTicket(null);
        setLoading(false);
        return;
      }
      setTicket(t);
      setTasksCount(Array.isArray(tasks) ? tasks.length : 0);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [ticketId]);

  return (
    <Drawer
      title={ticket?.number || "Ticket"}
      eyebrow="Resumen Ejecutivo"
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
              const url = `/tickets/${ticketId}`;
              const snapshot = getReturnSnapshot?.() ?? null;
              onClose();
              if (snapshot) {
                navigateToTicketFullView(navigate, url, ticketId, snapshot);
              } else {
                navigate(url);
              }
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
