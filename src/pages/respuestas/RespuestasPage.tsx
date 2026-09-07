import { HelpCircle, MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cannedApi } from "../../api/canned";
import { ApiError } from "../../api/client";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/useAuth";
import { formatDateTime } from "../../lib/format";
import type { CannedResponseResponse } from "../../types/api";
import { CannedResponseStudio } from "./CannedResponseStudio";
import { RespuestasHelpSheet } from "./RespuestasHelpSheet";

/** Respuestas predefinidas: se insertan en el editor desde "Respuestas rápidas". */
export function RespuestasPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CannedResponseResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [modal, setModal] = useState<"nueva" | CannedResponseResponse | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  function load() {
    cannedApi
      .list()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudieron cargar las respuestas"));
  }

  useEffect(load, []);

  const term = search.trim().toLowerCase();
  const rows = (items ?? []).filter(
    (item) => !term || item.title.toLowerCase().includes(term) || item.body.toLowerCase().includes(term),
  );

  function canManage(item: CannedResponseResponse) {
    return Boolean(user?.isAdmin) || item.createdByStaffId === user?.staffId;
  }

  function askDelete(item: CannedResponseResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Correo · Respuestas",
      title: "Eliminar respuesta",
      description: (
        <>
          Se eliminará <strong className="font-semibold text-ink">{item.title}</strong>. Los correos ya
          enviados con ella no cambian.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        setBusyId(item.id);
        try {
          await cannedApi.remove(item.id);
          load();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Respuestas"
        summary={
          items
            ? `${items.length} ${items.length === 1 ? "respuesta predefinida" : "respuestas predefinidas"} · se insertan desde el editor con "Respuestas rápidas"`
            : "Cargando las respuestas…"
        }
        action={
          <Button size="sm" onClick={() => setModal("nueva")}>
            <Plus className="h-[15px] w-[15px]" />
            Nueva respuesta
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por título o texto…" className="w-[260px]" />

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-edge border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-brand-gray transition-[background-color,border-color,color] hover:border-line-strong hover:bg-canvas hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20 shadow-2xs"
          >
            <HelpCircle className="h-3.5 w-3.5 text-brand-red" />
            <span>¿Para qué sirve?</span>
          </button>
        </div>

        {error && (
          <div className="mb-3">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {items === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Título</Th>
                  <Th>Texto</Th>
                  <Th>Creada por</Th>
                  <Th>Actualizada</Th>
                  <Th className="w-24 text-right">Acciones</Th>
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <Row key={item.id} busy={busyId === item.id}>
                    <Td className="text-[13px] font-medium text-ink">{item.title}</Td>
                    <Td className="max-w-[420px] truncate text-[12.5px] text-subtle" title={item.body}>
                      {item.body}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-subtle">{item.createdByName}</Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-subtle">{formatDateTime(item.updatedAt)}</Td>
                    <Td>
                      {canManage(item) && (
                        <div className="flex items-center justify-end gap-1">
                          <RowAction label={`Editar ${item.title}`} icon={Pencil} onClick={() => setModal(item)} disabled={busyId === item.id} />
                          <RowAction label={`Eliminar ${item.title}`} icon={Trash2} onClick={() => askDelete(item)} disabled={busyId === item.id} danger />
                        </div>
                      )}
                    </Td>
                  </Row>
                ))}
              </tbody>
            </DataTable>

            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <MessageSquareText className="h-6 w-6 text-faint" />
                <p className="text-[13.5px] text-faint">
                  {term ? "Ninguna respuesta coincide con la búsqueda." : "Todavía no hay respuestas guardadas."}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}

      {modal !== null && (
        <CannedResponseStudio
          item={modal === "nueva" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}

      {helpOpen && (
        <RespuestasHelpSheet
          onClose={() => setHelpOpen(false)}
          onNewResponse={() => setModal("nueva")}
        />
      )}
    </div>
  );
}
