import { AlertTriangle, FileSpreadsheet, Plus, Truck, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { discrepanciesApi } from "../../api/discrepancies";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import { qualityApi } from "../../api/quality";
import { withdrawalsApi } from "../../api/withdrawals";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { usePermissions } from "../../hooks/usePermissions";
import type { TicketDetailResponse } from "../../types/api";
import type { CustomerClaim } from "../../types/claims";
import type { DiscrepancyDetail, LoadDiscrepancy } from "../../types/discrepancies";
import type { CorrectiveActionSheet } from "../../types/quality";
import type { ProductLine } from "../../types/settings";
import type { MerchandiseWithdrawal } from "../../types/withdrawals";
import { ClaimFormModal } from "../claims/ClaimFormModal";
import { DiscrepancyFormModal } from "../discrepancies/DiscrepancyFormModal";
import { HcaModal } from "../quality/HcaModal";
import { WithdrawalFormModal } from "../withdrawals/WithdrawalFormModal";
import { ActiveFormHeader } from "./forms/ActiveFormHeader";
import { ClaimFormSummary } from "./forms/ClaimFormSummary";
import { DiscrepancyFormSummary } from "./forms/DiscrepancyFormSummary";
import { HcaFormSummary } from "./forms/HcaFormSummary";
import { MigrateFormModal } from "./forms/MigrateFormModal";
import { NewFormPickerModal } from "./forms/NewFormPickerModal";
import type { CommonExtractedData, EnterpriseFormType, MigrationSource, RegisteredForm } from "./forms/ticketForms";
import { WithdrawalFormSummary } from "./forms/WithdrawalFormSummary";

export type { EnterpriseFormType } from "./forms/ticketForms";

interface TicketFormsTabProps {
  ticket: TicketDetailResponse;
  onHasFormsChanged?: (hasForms: boolean) => void;
  onTicketStatusChanged?: () => void;
}

export function TicketFormsTab({ ticket, onHasFormsChanged, onTicketStatusChanged }: TicketFormsTabProps) {
  const { can } = usePermissions();

  const canReadClaims = can("claims.read", ticket.departmentId ?? undefined);
  const canWriteClaims = can("claims.write", ticket.departmentId ?? undefined);
  const canReadWithdrawals = can("withdrawals.read");
  const canWriteWithdrawals = can("withdrawals.write");
  const canReadDiscrepancies = can("discrepancies.read");
  const canWriteDiscrepancies = can("discrepancies.write");
  const canReadQuality = can("quality.read");
  const canWriteQuality = can("quality.write");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [claim, setClaim] = useState<CustomerClaim | null>(null);
  const [withdrawals, setWithdrawals] = useState<MerchandiseWithdrawal[]>([]);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyDetail[]>([]);
  const [sheets, setSheets] = useState<CorrectiveActionSheet[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);

  // Selected sub-tab when forms exist
  const [selectedSubTabKey, setSelectedSubTabKey] = useState<string | null>(null);
  const [newFormModalOpen, setNewFormModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Modal open states
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<CustomerClaim | undefined>(undefined);
  const [claimInitialData, setClaimInitialData] = useState<{
    invoiceRef?: string;
    description?: string;
    lines?: Array<{
      productId: string;
      defectiveQuantity?: string;
      invoicedQuantity?: string;
      unitPrice?: string;
    }>;
  } | undefined>(undefined);

  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [editingWithdrawal, setEditingWithdrawal] = useState<MerchandiseWithdrawal | undefined>(undefined);
  const [withdrawalInitialLines, setWithdrawalInitialLines] = useState<
    Array<{ productId: string; quantity: string; quantityUnit: string; packDetail: string; unitPrice: string }> | undefined
  >(undefined);

  const [discrepancyModalOpen, setDiscrepancyModalOpen] = useState(false);
  const [editingDiscrepancy, setEditingDiscrepancy] = useState<LoadDiscrepancy | undefined>(undefined);
  const [discrepancyInitialData, setDiscrepancyInitialData] = useState<{
    note?: string;
    lines?: Array<{
      productId: string;
      invoiceRef?: string;
      clientId?: string;
      surplusQuantity?: string;
      shortageQuantity?: string;
    }>;
  } | undefined>(undefined);

  const [hcaModalOpen, setHcaModalOpen] = useState(false);
  const [editingHca, setEditingHca] = useState<CorrectiveActionSheet | undefined>(undefined);
  const [hcaInitialDefaults, setHcaInitialDefaults] = useState<{ clientId: number; ticketId: number | null; description?: string } | undefined>(undefined);

  // Migration modal state
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);
  const [migratingFromSource, setMigratingFromSource] = useState<MigrationSource | null>(null);
  const [migrationTargetType, setMigrationTargetType] = useState<EnterpriseFormType>("reclamacion");
  const [migrateCommonFields, setMigrateCommonFields] = useState(true);

  // Helpers to start new forms
  const handleOpenNewClaim = useCallback((initData?: typeof claimInitialData) => {
    setEditingClaim(undefined);
    setClaimInitialData(initData);
    setClaimModalOpen(true);
  }, []);

  const handleOpenNewWithdrawal = useCallback((initLines?: typeof withdrawalInitialLines) => {
    setEditingWithdrawal(undefined);
    setWithdrawalInitialLines(initLines);
    setWithdrawalModalOpen(true);
  }, []);

  const handleOpenNewDiscrepancy = useCallback((initData?: typeof discrepancyInitialData) => {
    setEditingDiscrepancy(undefined);
    setDiscrepancyInitialData(initData);
    setDiscrepancyModalOpen(true);
  }, []);

  const handleOpenNewHca = useCallback(
    (initDefaults?: typeof hcaInitialDefaults) => {
      setEditingHca(undefined);
      setHcaInitialDefaults(initDefaults ?? {
        clientId: ticket.clientId ?? 0,
        ticketId: ticket.id,
        description: ticket.subject,
      });
      setHcaModalOpen(true);
    },
    [ticket.clientId, ticket.id, ticket.subject],
  );

  // ?openForm= abre el formulario pedido (ajuste durante el render, una vez por URL)...
  const [openFormParams, setOpenFormParams] = useState<URLSearchParams | null>(null);
  if (openFormParams !== searchParams) {
    setOpenFormParams(searchParams);
    const formToOpen = searchParams.get("openForm");
    if (formToOpen === "Reclamacion" || formToOpen?.toLowerCase() === "reclamacion") {
      handleOpenNewClaim();
    } else if (formToOpen === "RetiroMercancia" || formToOpen?.toLowerCase().includes("retiro")) {
      handleOpenNewWithdrawal();
    } else if (formToOpen === "DiscrepanciaCarga" || formToOpen?.toLowerCase().includes("discrepancia")) {
      handleOpenNewDiscrepancy();
    } else if (formToOpen === "Hca" || formToOpen?.toLowerCase() === "hca") {
      handleOpenNewHca();
    }
  }

  // ...y se retira de la URL para no reabrirlo.
  useEffect(() => {
    if (!searchParams.has("openForm")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("openForm");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Load product lines for HCA
  useEffect(() => {
    fetchAllPages<ProductLine>((page, pageSize) => productLinesApi.list({ page, pageSize }))
      .then(setProductLines)
      .catch(() => setProductLines([]));
  }, []);

  /*
   * Carga de formularios. Se relanza al cambiar de ticket (o de permisos) y cuando
   * `reloadForms` sube el contador tras guardar. El spinner y el error se reinician
   * desde quien pide la carga, no desde el efecto.
   */
  const [reloadTick, setReloadTick] = useState(0);
  const reloadForms = () => {
    setLoading(true);
    setError(null);
    setReloadTick((tick) => tick + 1);
  };

  const formsKey = `${ticket.id}|${canReadClaims}|${canReadWithdrawals}|${canReadDiscrepancies}|${canReadQuality}`;
  const [loadedFormsKey, setLoadedFormsKey] = useState(formsKey);
  if (loadedFormsKey !== formsKey) {
    setLoadedFormsKey(formsKey);
    setLoading(true);
    setError(null);
  }

  // El padre pasa una flecha nueva en cada render: se lee por ref para no relanzar la carga.
  const onHasFormsChangedRef = useRef(onHasFormsChanged);
  useEffect(() => {
    onHasFormsChangedRef.current = onHasFormsChanged;
  }, [onHasFormsChanged]);

  useEffect(() => {
    let ignore = false;
    const fetchAllForms = async () => {
      try {
        const [claimRes, withRes, discRes, sheetRes] = await Promise.allSettled([
          canReadClaims ? claimsApi.getByTicket(ticket.id) : Promise.reject("no-permission"),
          canReadWithdrawals ? withdrawalsApi.listByTicket(ticket.id) : Promise.reject("no-permission"),
          canReadDiscrepancies ? discrepanciesApi.listByTicket(ticket.id) : Promise.reject("no-permission"),
          canReadQuality ? qualityApi.sheets.listByTicket(ticket.id) : Promise.reject("no-permission"),
        ]);

        const foundClaim = claimRes.status === "fulfilled" ? claimRes.value.claim : null;
        const foundWith = withRes.status === "fulfilled" ? withRes.value.map((d) => d.withdrawal) : [];
        const foundDisc = discRes.status === "fulfilled" ? discRes.value : [];
        const foundSheets = sheetRes.status === "fulfilled" ? sheetRes.value : [];
        if (ignore) return;

        setClaim(foundClaim);
        setWithdrawals(foundWith);
        setDiscrepancies(foundDisc);
        setSheets(foundSheets);

        const hasAny = Boolean(foundClaim || foundWith.length > 0 || foundDisc.length > 0 || foundSheets.length > 0);
        onHasFormsChangedRef.current?.(hasAny);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof ApiError ? err.message : "Error al cargar los formularios del ticket");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    void fetchAllForms();
    return () => {
      ignore = true;
    };
  }, [ticket.id, canReadClaims, canReadWithdrawals, canReadDiscrepancies, canReadQuality, reloadTick]);

  // Build the list of active forms for navigation
  const registeredForms = useMemo(() => {
    const list: RegisteredForm[] = [];

    if (claim) {
      list.push({
        key: `claim-${claim.id}`,
        type: "reclamacion",
        code: "PF-FOR-034",
        title: "Reclamación de Clientes",
        badgeText: claim.status,
        data: claim,
      });
    }

    withdrawals.forEach((w) => {
      list.push({
        key: `withdrawal-${w.id}`,
        type: "retiro",
        code: "PF-FOR-068",
        title: `Retiro ${w.number}`,
        badgeText: w.status,
        data: w,
      });
    });

    discrepancies.forEach((d) => {
      list.push({
        key: `discrepancy-${d.discrepancy.id}`,
        type: "discrepancia",
        code: "PF-FOR-291",
        title: `Discrepancia ${d.discrepancy.number}`,
        badgeText: d.discrepancy.status,
        data: d,
      });
    });

    sheets.forEach((s) => {
      list.push({
        key: `sheet-${s.id}`,
        type: "hca",
        code: "PF-FOR-109",
        title: `HCA ${s.number}`,
        badgeText: s.status,
        data: s,
      });
    });

    return list;
  }, [claim, withdrawals, discrepancies, sheets]);

  // Set default selected sub-tab (ajuste durante el render: converge en una pasada)
  if (registeredForms.length > 0) {
    if (!selectedSubTabKey || !registeredForms.some((f) => f.key === selectedSubTabKey)) {
      setSelectedSubTabKey(registeredForms[0].key);
    }
  } else if (selectedSubTabKey !== null) {
    setSelectedSubTabKey(null);
  }

  const activeForm = useMemo(() => {
    if (!selectedSubTabKey) return registeredForms[0] ?? null;
    return registeredForms.find((f) => f.key === selectedSubTabKey) ?? registeredForms[0] ?? null;
  }, [selectedSubTabKey, registeredForms]);

  // Suggested form from ticket topic
  const suggestedFormRaw = ticket.topicSuggestedForm; // "Reclamacion" | "RetiroMercancia" | "DiscrepanciaCarga" | "Hca" | null

    const availableForms = useMemo(() => {
    const list = [
      {
        key: "Reclamacion",
        code: "PF-FOR-034",
        codeColor: "text-brand-red",
        title: "Reclamación de Clientes",
        description:
          "Para quejas por averías, calidad de producto, cantidades facturadas vs recibidas o discrepancias de empaque.",
        dept: "Oficial Plastifar",
        icon: Plus,
        btnLabel: "Iniciar reclamación",
        disabled: !canWriteClaims,
        action: () => handleOpenNewClaim(),
      },
      {
        key: "RetiroMercancia",
        code: "PF-FOR-068",
        codeColor: "text-blue-600",
        title: "Solicitud de Retiro de Mercancía",
        description:
          "Autorización formal para retirar mercancía física en las instalaciones del cliente por devolución o cambio.",
        dept: "Logística & Almacén",
        icon: Truck,
        btnLabel: "Iniciar retiro",
        disabled: !canWriteWithdrawals,
        action: () => handleOpenNewWithdrawal(),
      },
      {
        key: "DiscrepanciaCarga",
        code: "PF-FOR-291",
        codeColor: "text-purple-600",
        title: "Discrepancia de Cargas",
        description:
          "Investigación operativa de sobrantes o faltantes en despachos de pedidos, con chequeo de seguridad de 9 puntos.",
        dept: "Despacho & Seguridad",
        icon: AlertTriangle,
        btnLabel: "Iniciar discrepancia",
        disabled: !canWriteDiscrepancies,
        action: () => handleOpenNewDiscrepancy(),
      },
      {
        key: "Hca",
        code: "PF-FOR-109",
        codeColor: "text-emerald-600",
        title: "Hecho, Causa y Acción (HCA)",
        description:
          "Acción correctiva interna del departamento de Calidad: análisis de causas raíz, plan de acción y verificación.",
        dept: "Aseguramiento de Calidad",
        icon: Wrench,
        btnLabel: "Iniciar hoja HCA",
        disabled: !canWriteQuality,
        action: () => handleOpenNewHca(),
      },
    ];

    if (!suggestedFormRaw) return list;

    // Colocar el formulario recomendado de PRIMERO
    return [...list].sort((a, b) => {
      if (a.key === suggestedFormRaw) return -1;
      if (b.key === suggestedFormRaw) return 1;
      return 0;
    });
  }, [
    suggestedFormRaw,
    canWriteClaims,
    canWriteWithdrawals,
    canWriteDiscrepancies,
    canWriteQuality,
    handleOpenNewClaim,
    handleOpenNewWithdrawal,
    handleOpenNewDiscrepancy,
    handleOpenNewHca,
  ]);

  // Helper to trigger form migration
  const handleTriggerMigration = (currentForm: NonNullable<typeof activeForm>) => {
    let extracted: CommonExtractedData = {
      invoiceRef: "",
      description: "",
      lines: [],
    };

    if (currentForm.type === "reclamacion") {
      const c = currentForm.data as CustomerClaim;
      extracted = {
        invoiceRef: c.invoiceRef ?? "",
        description: c.description || c.reason || "",
        lines: (c.lines || []).map((l) => ({
          productId: String(l.productId),
          quantity: String(l.defectiveQuantity || l.invoicedQuantity || 1),
          unitPrice: l.unitPrice !== null ? String(l.unitPrice) : "",
          productName: l.productName,
        })),
      };
    } else if (currentForm.type === "retiro") {
      const w = currentForm.data as MerchandiseWithdrawal;
      extracted = {
        invoiceRef: "",
        description: `Retiro de mercancía: ${w.reason}`,
        lines: (w.lines || []).map((l) => ({
          productId: String(l.productId),
          quantity: String(l.quantity),
          unitPrice: l.unitPrice !== null ? String(l.unitPrice) : "",
          productName: l.productName,
        })),
      };
    } else if (currentForm.type === "discrepancia") {
      const d = currentForm.data as DiscrepancyDetail;
      const firstLine = d.discrepancy.lines[0];
      extracted = {
        invoiceRef: firstLine?.invoiceRef ?? "",
        description: d.discrepancy.note ?? "",
        lines: (d.discrepancy.lines || []).map((l) => ({
          productId: String(l.productId),
          quantity: String(l.shortageQuantity || l.surplusQuantity || 1),
          unitPrice: "",
          productName: l.productName,
        })),
      };
    } else if (currentForm.type === "hca") {
      const s = currentForm.data as CorrectiveActionSheet;
      extracted = {
        invoiceRef: "",
        description: s.description ?? "",
        lines: s.productId ? [{
          productId: String(s.productId),
          quantity: "1",
          unitPrice: "",
          productName: s.productName ?? undefined,
        }] : [],
      };
    }

    setMigratingFromSource({
      type: currentForm.type,
      label: `${currentForm.code} · ${currentForm.title}`,
      data: extracted,
    });

    // Default target: choose another form type
    const possibleTargets: EnterpriseFormType[] = ["reclamacion", "retiro", "discrepancia", "hca"];
    const otherTarget = possibleTargets.find((t) => t !== currentForm.type) || "retiro";
    setMigrationTargetType(otherTarget);
    setMigrateCommonFields(true);
    setMigrationModalOpen(true);
  };

  const handleExecuteMigration = () => {
    if (!migratingFromSource) return;
    setMigrationModalOpen(false);

    const data = migrateCommonFields ? migratingFromSource.data : { invoiceRef: "", description: "", lines: [] };

    if (migrationTargetType === "reclamacion") {
      handleOpenNewClaim({
        invoiceRef: data.invoiceRef,
        description: data.description,
        lines: data.lines.map((l) => ({
          productId: l.productId,
          defectiveQuantity: l.quantity,
          invoicedQuantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
    } else if (migrationTargetType === "retiro") {
      handleOpenNewWithdrawal(
        data.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity || "1",
          quantityUnit: "UND",
          packDetail: "",
          unitPrice: l.unitPrice,
        })),
      );
    } else if (migrationTargetType === "discrepancia") {
      handleOpenNewDiscrepancy({
        note: data.description,
        lines: data.lines.map((l) => ({
          productId: l.productId,
          invoiceRef: data.invoiceRef || "FAC-001",
          clientId: ticket.clientId ? String(ticket.clientId) : "",
          surplusQuantity: "",
          shortageQuantity: l.quantity || "1",
        })),
      });
    } else if (migrationTargetType === "hca") {
      handleOpenNewHca({
        clientId: ticket.clientId ?? 0,
        ticketId: ticket.id,
        description: data.description || ticket.subject,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Spinner size="md" />
        <p className="mt-3 text-xs text-zinc-500">Cargando formularios asociados al ticket...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  // RENDER MODO PÁGINA: Si el usuario inició o está editando la discrepancia de cargas
  if (discrepancyModalOpen) {
    return (
      <div className="mt-3.5 w-full">
        <DiscrepancyFormModal
          inline
          discrepancy={editingDiscrepancy}
          ticketId={ticket.id}
          fixedTicketLabel={`${ticket.number} · ${ticket.subject}`}
          ticketClientName={ticket.clientName ?? undefined}
          ticketClientId={ticket.clientId ?? undefined}
          ticketStatus={ticket.status}
          onTicketStatusChanged={onTicketStatusChanged}
          initialData={discrepancyInitialData}
          onClose={() => {
            setDiscrepancyModalOpen(false);
            setEditingDiscrepancy(undefined);
            setDiscrepancyInitialData(undefined);
          }}
          onSaved={() => {
            setDiscrepancyModalOpen(false);
            setEditingDiscrepancy(undefined);
            setDiscrepancyInitialData(undefined);
            reloadForms();
            onTicketStatusChanged?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-3.5 space-y-4 animate-plf-fade">
      {/* ZERO STATE: No forms registered yet */}
      {registeredForms.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-2xs">
          <div className="flex flex-col items-center text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
              <FileSpreadsheet className="size-5" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-zinc-900">
              Formularios del Ciclo de Vida del Ticket
            </h3>
            <p className="mt-1 max-w-xl text-xs text-zinc-500 leading-relaxed">
              Integra los procesos y formatos oficiales de Plastifar directamente en este ticket. Puedes iniciar el formulario correspondiente ahora o dejarlo como borrador y completarlo más adelante.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {availableForms.map((form) => {
              const isRecommended = form.key === suggestedFormRaw;
              const Icon = form.icon;

              return (
                <div
                  key={form.key}
                  className={`flex flex-col justify-between rounded-xl border p-4.5 transition-all ${
                    isRecommended
                      ? "border-brand-red/40 bg-brand-red/5 ring-1 ring-brand-red/30 shadow-xs"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`font-heading text-[10.5px] font-bold uppercase tracking-wider ${form.codeColor}`}>
                        {form.code}
                      </span>
                      {isRecommended && (
                        <span className="inline-flex items-center rounded-md border border-brand-red/20 bg-brand-red/10 px-2.5 py-0.5 text-xs font-semibold text-brand-red">
                          Recomendado según el motivo
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1.5 text-sm font-semibold text-zinc-900">{form.title}</h4>
                    <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                      {form.description}
                    </p>
                    {isRecommended && ticket.topicName && (
                      <p className="mt-2 text-[11.5px] font-medium text-brand-red/90 leading-snug">
                        Formato oficial sugerido para casos clasificados como {ticket.topicName}.
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">{form.dept}</span>
                    <Button
                      size="sm"
                      variant={isRecommended ? "primary" : "secondary"}
                      disabled={form.disabled}
                      onClick={form.action}
                      className={isRecommended ? "font-heading font-semibold" : undefined}
                    >
                      <Icon className="size-3.5" />
                      {form.btnLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* REGISTERED FORMS VIEW */
        <div className="space-y-3">
          {/* Top Sub-tabs & Add Form Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {registeredForms.map((item) => {
                const isSelected = item.key === activeForm?.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedSubTabKey(item.key)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-zinc-900 text-white shadow-xs"
                        : "bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-zinc-200"
                    }`}
                  >
                    <span
                      className={`font-mono text-[10px] font-bold uppercase ${
                        isSelected ? "text-zinc-300" : "text-zinc-400"
                      }`}
                    >
                      {item.code}
                    </span>
                    <span>{item.title}</span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] ${
                        isSelected ? "bg-zinc-800 text-zinc-200" : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {item.badgeText}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Add another form action */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => setNewFormModalOpen(true)}
                title="Llenar o agregar otro formulario vinculado a este ticket"
              >
                <Plus className="size-3.5 mr-1" />
                Llenar otro formulario
              </Button>
            </div>
          </div>

          {/* ACTIVE FORM DETAILS */}
          {activeForm && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs">
              {/* Form Card Header */}
              <ActiveFormHeader
                activeForm={activeForm}
                ticketNumber={ticket.number}
                onEdit={() => {
                  if (activeForm.type === "reclamacion") {
                    setEditingClaim(activeForm.data as CustomerClaim);
                    setClaimModalOpen(true);
                  } else if (activeForm.type === "retiro") {
                    setEditingWithdrawal(activeForm.data as MerchandiseWithdrawal);
                    setWithdrawalModalOpen(true);
                  } else if (activeForm.type === "discrepancia") {
                    setEditingDiscrepancy((activeForm.data as DiscrepancyDetail).discrepancy);
                    setDiscrepancyModalOpen(true);
                  } else if (activeForm.type === "hca") {
                    setEditingHca(activeForm.data as CorrectiveActionSheet);
                    setHcaModalOpen(true);
                  }
                }}
                onMigrate={() => handleTriggerMigration(activeForm)}
              />

              {/* Form Content Overview */}
              <div className="mt-4">
                {/* 1. RECLAMACIÓN DETAILS */}
                {activeForm.type === "reclamacion" && <ClaimFormSummary claim={activeForm.data as CustomerClaim} />}

                {/* 2. RETIRO DETAILS */}
                {activeForm.type === "retiro" && (
                  <WithdrawalFormSummary withdrawal={activeForm.data as MerchandiseWithdrawal} />
                )}

                {/* 3. DISCREPANCIA DETAILS */}
                {activeForm.type === "discrepancia" && (
                  <DiscrepancyFormSummary detail={activeForm.data as DiscrepancyDetail} />
                )}

                {/* 4. HCA DETAILS */}
                {activeForm.type === "hca" && <HcaFormSummary sheet={activeForm.data as CorrectiveActionSheet} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CAMBIAR DE FORMULARIO (MIGRACIÓN) */}
      {migrationModalOpen && migratingFromSource && (
        <MigrateFormModal
          migratingFromSource={migratingFromSource}
          migrationTargetType={migrationTargetType}
          onTargetChange={setMigrationTargetType}
          migrateCommonFields={migrateCommonFields}
          onMigrateCommonFieldsChange={setMigrateCommonFields}
          onClose={() => setMigrationModalOpen(false)}
          onContinue={handleExecuteMigration}
        />
      )}

      {/* FORM MODALS */}
      {/* 1. Reclamación Modal */}
      {claimModalOpen && (
        <ClaimFormModal
          ticketId={ticket.id}
          ticketNumber={ticket.number}
          clientName={ticket.clientName ?? "Cliente"}
          claim={editingClaim}
          initialData={claimInitialData}
          onClose={() => setClaimModalOpen(false)}
          onSaved={() => {
            setClaimModalOpen(false);
            reloadForms();
          }}
        />
      )}

      {/* 2. Retiro Modal */}
      {withdrawalModalOpen && (
        <WithdrawalFormModal
          withdrawal={editingWithdrawal}
          fixedTicketId={ticket.id}
          fixedTicketLabel={`${ticket.number} · ${ticket.subject}`}
          initialLines={withdrawalInitialLines}
          onClose={() => setWithdrawalModalOpen(false)}
          onSaved={() => {
            setWithdrawalModalOpen(false);
            reloadForms();
          }}
        />
      )}


      {/* 4. HCA Modal */}
      {hcaModalOpen && (
        <HcaModal
          sheet={editingHca}
          productLines={productLines}
          defaults={hcaInitialDefaults}
          onClose={() => setHcaModalOpen(false)}
          onSaved={() => {
            setHcaModalOpen(false);
            reloadForms();
          }}
        />
      )}

      {/* 5. Modal para elegir nuevo formulario */}
      {newFormModalOpen && (
        <NewFormPickerModal
          availableForms={availableForms}
          suggestedFormRaw={suggestedFormRaw}
          ticketNumber={ticket.number}
          onClose={() => setNewFormModalOpen(false)}
        />
      )}
    </div>
  );
}
