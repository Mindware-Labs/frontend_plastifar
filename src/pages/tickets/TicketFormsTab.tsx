import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  Truck,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { discrepanciesApi } from "../../api/discrepancies";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import { qualityApi } from "../../api/quality";
import { withdrawalsApi } from "../../api/withdrawals";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { usePermissions } from "../../hooks/usePermissions";
import { formatAmount, formatDay } from "../../lib/quality";
import type { TicketDetailResponse } from "../../types/api";
import type { CustomerClaim } from "../../types/claims";
import type { DiscrepancyDetail, LoadDiscrepancy } from "../../types/discrepancies";
import type { CorrectiveActionSheet } from "../../types/quality";
import type { ProductLine } from "../../types/settings";
import type { MerchandiseWithdrawal } from "../../types/withdrawals";
import { ClaimFormModal } from "../claims/ClaimFormModal";
import { ClaimStatusBadge } from "../claims/ClaimStatusBadge";
import { DiscrepancyFormModal } from "../discrepancies/DiscrepancyFormModal";
import { DiscrepancyStatusBadge } from "../discrepancies/DiscrepancyStatusBadge";
import { HcaModal } from "../quality/HcaModal";
import { HcaStatusBadge } from "../quality/StatusBadges";
import { WithdrawalFormModal } from "../withdrawals/WithdrawalFormModal";
import { WithdrawalStatusBadge } from "../withdrawals/WithdrawalStatusBadge";

export type EnterpriseFormType = "reclamacion" | "retiro" | "discrepancia" | "hca";

interface TicketFormsTabProps {
  ticket: TicketDetailResponse;
  onHasFormsChanged?: (hasForms: boolean) => void;
}

interface CommonExtractedData {
  invoiceRef: string;
  description: string;
  lines: Array<{
    productId: string;
    quantity: string;
    unitPrice: string;
    productName?: string;
  }>;
}

export function TicketFormsTab({ ticket, onHasFormsChanged }: TicketFormsTabProps) {
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
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const formToOpen = searchParams.get("openForm");
    if (!formToOpen) return;

    const next = new URLSearchParams(searchParams);
    next.delete("openForm");
    setSearchParams(next, { replace: true });

    if (formToOpen === "Reclamacion" || formToOpen.toLowerCase() === "reclamacion") {
      handleOpenNewClaim();
    } else if (formToOpen === "RetiroMercancia" || formToOpen.toLowerCase().includes("retiro")) {
      handleOpenNewWithdrawal();
    } else if (formToOpen === "DiscrepanciaCarga" || formToOpen.toLowerCase().includes("discrepancia")) {
      handleOpenNewDiscrepancy();
    } else if (formToOpen === "Hca" || formToOpen.toLowerCase() === "hca") {
      handleOpenNewHca();
    }
  }, [searchParams]);

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
  const [migratingFromSource, setMigratingFromSource] = useState<{
    type: EnterpriseFormType;
    label: string;
    data: CommonExtractedData;
  } | null>(null);
  const [migrationTargetType, setMigrationTargetType] = useState<EnterpriseFormType>("reclamacion");
  const [migrateCommonFields, setMigrateCommonFields] = useState(true);

  // Load product lines for HCA
  useEffect(() => {
    fetchAllPages<ProductLine>((page, pageSize) => productLinesApi.list({ page, pageSize }))
      .then(setProductLines)
      .catch(() => setProductLines([]));
  }, []);

  const fetchAllForms = async () => {
    setLoading(true);
    setError(null);
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

      setClaim(foundClaim);
      setWithdrawals(foundWith);
      setDiscrepancies(foundDisc);
      setSheets(foundSheets);

      const hasAny = Boolean(foundClaim || foundWith.length > 0 || foundDisc.length > 0 || foundSheets.length > 0);
      onHasFormsChanged?.(hasAny);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar los formularios del ticket");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllForms();
  }, [ticket.id]);

  // Build the list of active forms for navigation
  const registeredForms = useMemo(() => {
    const list: Array<{
      key: string;
      type: EnterpriseFormType;
      code: string;
      title: string;
      badgeText: string;
      data: any;
    }> = [];

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

  // Set default selected sub-tab
  useEffect(() => {
    if (registeredForms.length > 0) {
      if (!selectedSubTabKey || !registeredForms.some((f) => f.key === selectedSubTabKey)) {
        setSelectedSubTabKey(registeredForms[0].key);
      }
    } else {
      setSelectedSubTabKey(null);
    }
  }, [registeredForms, selectedSubTabKey]);

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
  }, [suggestedFormRaw, canWriteClaims, canWriteWithdrawals, canWriteDiscrepancies, canWriteQuality]);

    // Helpers to start new forms
  const handleOpenNewClaim = (initData?: typeof claimInitialData) => {
    setEditingClaim(undefined);
    setClaimInitialData(initData);
    setClaimModalOpen(true);
  };

  const handleOpenNewWithdrawal = (initLines?: typeof withdrawalInitialLines) => {
    setEditingWithdrawal(undefined);
    setWithdrawalInitialLines(initLines);
    setWithdrawalModalOpen(true);
  };

  const handleOpenNewDiscrepancy = (initData?: typeof discrepancyInitialData) => {
    setEditingDiscrepancy(undefined);
    setDiscrepancyInitialData(initData);
    setDiscrepancyModalOpen(true);
  };

  const handleOpenNewHca = (initDefaults?: typeof hcaInitialDefaults) => {
    setEditingHca(undefined);
    setHcaInitialDefaults(initDefaults ?? {
      clientId: ticket.clientId ?? 0,
      ticketId: ticket.id,
      description: ticket.subject,
    });
    setHcaModalOpen(true);
  };

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

  return (
    <div className="mt-3.5 space-y-4">
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

            {/* Add another form dropdown / action */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-400 hidden sm:inline">¿Agregar otro formulario?</span>
              <div className="inline-flex rounded-md shadow-2xs">
                {!claim && canWriteClaims && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-zinc-200 bg-white hover:bg-zinc-50"
                    title="Agregar Reclamación"
                    onClick={() => handleOpenNewClaim()}
                  >
                    <Plus className="size-3 mr-1" /> Reclamación
                  </Button>
                )}
                {canWriteWithdrawals && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-zinc-200 bg-white hover:bg-zinc-50"
                    title="Agregar Solicitud de Retiro"
                    onClick={() => handleOpenNewWithdrawal()}
                  >
                    <Plus className="size-3 mr-1" /> Retiro
                  </Button>
                )}
                {canWriteDiscrepancies && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-zinc-200 bg-white hover:bg-zinc-50"
                    title="Agregar Discrepancia"
                    onClick={() => handleOpenNewDiscrepancy()}
                  >
                    <Plus className="size-3 mr-1" /> Discrepancia
                  </Button>
                )}
                {canWriteQuality && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-zinc-200 bg-white hover:bg-zinc-50"
                    title="Agregar Hoja HCA"
                    onClick={() => handleOpenNewHca()}
                  >
                    <Plus className="size-3 mr-1" /> HCA
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ACTIVE FORM DETAILS */}
          {activeForm && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs">
              {/* Form Card Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-brand-red bg-brand-red/10 px-2 py-0.5 rounded">
                      {activeForm.code}
                    </span>
                    <h3 className="text-sm font-semibold text-zinc-900">{activeForm.title}</h3>

                    {activeForm.type === "reclamacion" && (
                      <ClaimStatusBadge status={(activeForm.data as CustomerClaim).status} />
                    )}
                    {activeForm.type === "retiro" && (
                      <WithdrawalStatusBadge status={(activeForm.data as MerchandiseWithdrawal).status} />
                    )}
                    {activeForm.type === "discrepancia" && (
                      <DiscrepancyStatusBadge
                        status={(activeForm.data as DiscrepancyDetail).discrepancy.status}
                      />
                    )}
                    {activeForm.type === "hca" && (
                      <HcaStatusBadge status={(activeForm.data as CorrectiveActionSheet).status} />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Formulario empresarial vinculado a {ticket.number} · Plastifar S.A.
                  </p>
                </div>

                {/* Form Actions (Print, Edit, Switch, Link) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Official Print Button */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      let printPath = "";
                      if (activeForm.type === "reclamacion") {
                        printPath = `/reclamaciones/${(activeForm.data as CustomerClaim).id}/imprimir`;
                      } else if (activeForm.type === "retiro") {
                        printPath = `/retiros/${(activeForm.data as MerchandiseWithdrawal).id}/imprimir`;
                      } else if (activeForm.type === "discrepancia") {
                        printPath = `/discrepancias/${(activeForm.data as DiscrepancyDetail).discrepancy.id}/imprimir`;
                      } else if (activeForm.type === "hca") {
                        printPath = `/calidad/hca/${(activeForm.data as CorrectiveActionSheet).id}/imprimir`;
                      }
                      if (printPath) window.open(printPath, "_blank");
                    }}
                    title="Exportar o imprimir con el formato y cabecera oficial de Plastifar"
                  >
                    <Printer className="size-3.5 text-zinc-500" />
                    Imprimir formato oficial
                  </Button>

                  {/* Edit Form Button */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
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
                    title="Editar datos del formulario"
                  >
                    <Pencil className="size-3.5 text-zinc-500" />
                    Editar
                  </Button>

                  {/* Switch / Migrate Form Button */}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-amber-800 border-amber-200 bg-amber-50 hover:bg-amber-100"
                    onClick={() => handleTriggerMigration(activeForm)}
                    title="Cambiar o transferir datos a otro tipo de formulario"
                  >
                    <ArrowLeftRight className="size-3.5 text-amber-600" />
                    Cambiar de formulario
                  </Button>

                  {/* View Details Link */}
                  <Link
                    to={
                      activeForm.type === "reclamacion"
                        ? `/reclamaciones/${(activeForm.data as CustomerClaim).id}`
                        : activeForm.type === "retiro"
                        ? `/retiros/${(activeForm.data as MerchandiseWithdrawal).id}`
                        : activeForm.type === "discrepancia"
                        ? `/discrepancias/${(activeForm.data as DiscrepancyDetail).discrepancy.id}`
                        : `/calidad/hca/${(activeForm.data as CorrectiveActionSheet).id}`
                    }
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50"
                  >
                    Ficha
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* Form Content Overview */}
              <div className="mt-4">
                {/* 1. RECLAMACIÓN DETAILS */}
                {activeForm.type === "reclamacion" && (() => {
                  const c = activeForm.data as CustomerClaim;
                  return (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-zinc-50 p-3.5 text-xs">
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Fecha Reclamo</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">{formatDay(c.claimDate)}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Factura</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">{c.invoiceRef || "—"}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Motivo</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">{c.reason} {c.reasonOther ? `(${c.reasonOther})` : ""}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Monto Total</dt>
                          <dd className="mt-0.5 font-semibold text-zinc-900">
                            {c.currency ? formatAmount(c.totalAmount, c.currency) : c.totalAmount}
                          </dd>
                        </div>
                      </dl>

                      {c.description && (
                        <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 text-xs">
                          <span className="font-heading text-[10px] font-bold uppercase text-zinc-400">Descripción:</span>
                          <p className="mt-1 text-zinc-700 whitespace-pre-wrap">{c.description}</p>
                        </div>
                      )}

                      {/* Lines preview */}
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-800 mb-2">Líneas de producto ({c.lines.length})</h4>
                        <div className="overflow-x-auto rounded-lg border border-zinc-200">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-50 text-[10.5px] uppercase font-bold text-zinc-500 border-b border-zinc-200">
                              <tr>
                                <th className="p-2.5">Código</th>
                                <th className="p-2.5">Producto</th>
                                <th className="p-2.5 text-right">Facturado</th>
                                <th className="p-2.5 text-right">Recibido</th>
                                <th className="p-2.5 text-right">Defectuoso</th>
                                <th className="p-2.5 text-right">P. Unitario</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-zinc-700">
                              {c.lines.map((l) => (
                                <tr key={l.id} className="hover:bg-zinc-50/50">
                                  <td className="p-2.5 font-mono text-[11px] text-zinc-500">{l.productCode}</td>
                                  <td className="p-2.5 font-medium text-zinc-800">{l.productName}</td>
                                  <td className="p-2.5 text-right">{l.invoicedQuantity ?? "—"}</td>
                                  <td className="p-2.5 text-right">{l.receivedQuantity ?? "—"}</td>
                                  <td className="p-2.5 text-right font-semibold text-brand-red">{l.defectiveQuantity ?? "—"}</td>
                                  <td className="p-2.5 text-right">{l.unitPrice !== null ? formatAmount(l.unitPrice, c.currency ?? "DOP") : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. RETIRO DETAILS */}
                {activeForm.type === "retiro" && (() => {
                  const w = activeForm.data as MerchandiseWithdrawal;
                  return (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-zinc-50 p-3.5 text-xs">
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Número</dt>
                          <dd className="mt-0.5 font-mono font-medium text-zinc-800">{w.number}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Fecha Solicitud</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">{formatDay(w.requestDate)}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Motivo</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">{w.reason}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Valor Total</dt>
                          <dd className="mt-0.5 font-semibold text-zinc-900">
                            {w.currency ? formatAmount(w.totalValue, w.currency) : w.totalValue}
                          </dd>
                        </div>
                      </dl>

                      <div>
                        <h4 className="text-xs font-semibold text-zinc-800 mb-2">Productos a retirar ({w.lines.length})</h4>
                        <div className="overflow-x-auto rounded-lg border border-zinc-200">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-50 text-[10.5px] uppercase font-bold text-zinc-500 border-b border-zinc-200">
                              <tr>
                                <th className="p-2.5">Código</th>
                                <th className="p-2.5">Producto</th>
                                <th className="p-2.5 text-right">Cant. Solicitada</th>
                                <th className="p-2.5 text-right">Cant. Retirada</th>
                                <th className="p-2.5 text-right">P. Unitario</th>
                                <th className="p-2.5 text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-zinc-700">
                              {w.lines.map((l) => (
                                <tr key={l.id} className="hover:bg-zinc-50/50">
                                  <td className="p-2.5 font-mono text-[11px] text-zinc-500">{l.productCode}</td>
                                  <td className="p-2.5 font-medium text-zinc-800">{l.productName}</td>
                                  <td className="p-2.5 text-right font-medium">{l.quantity} {l.quantityUnit}</td>
                                  <td className="p-2.5 text-right">{l.withdrawnQuantity !== null ? `${l.withdrawnQuantity} ${l.quantityUnit}` : "—"}</td>
                                  <td className="p-2.5 text-right">{l.unitPrice !== null ? formatAmount(l.unitPrice, w.currency ?? "DOP") : "—"}</td>
                                  <td className="p-2.5 text-right font-semibold">{l.lineValue !== null ? formatAmount(l.lineValue, w.currency ?? "DOP") : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. DISCREPANCIA DETAILS */}
                {activeForm.type === "discrepancia" && (() => {
                  const d = (activeForm.data as DiscrepancyDetail).discrepancy;
                  return (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-zinc-50 p-3.5 text-xs">
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Número</dt>
                          <dd className="mt-0.5 font-mono font-medium text-zinc-800">{d.number}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Fecha Creación</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">{formatDay(d.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Hallazgo de Seguridad</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">{d.hasSecurityFinding ? "Sí (Positivo)" : "No"}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Líneas analizadas</dt>
                          <dd className="mt-0.5 font-semibold text-zinc-900">{d.lines.length}</dd>
                        </div>
                      </dl>

                      {d.note && (
                        <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 text-xs">
                          <span className="font-heading text-[10px] font-bold uppercase text-zinc-400">Nota / Causa investigada:</span>
                          <p className="mt-1 text-zinc-700 whitespace-pre-wrap">{d.note}</p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-xs font-semibold text-zinc-800 mb-2">Líneas de discrepancia de carga</h4>
                        <div className="overflow-x-auto rounded-lg border border-zinc-200">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-50 text-[10.5px] uppercase font-bold text-zinc-500 border-b border-zinc-200">
                              <tr>
                                <th className="p-2.5">Factura</th>
                                <th className="p-2.5">Producto</th>
                                <th className="p-2.5 text-right">Sobrante</th>
                                <th className="p-2.5 text-right">Faltante</th>
                                <th className="p-2.5">Despachador</th>
                                <th className="p-2.5">Apta N/C</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-zinc-700">
                              {d.lines.map((l) => (
                                <tr key={l.id} className="hover:bg-zinc-50/50">
                                  <td className="p-2.5 font-mono text-[11px] text-zinc-600">{l.invoiceRef}</td>
                                  <td className="p-2.5 font-medium text-zinc-800">{l.productName}</td>
                                  <td className="p-2.5 text-right text-emerald-600 font-medium">{l.surplusQuantity > 0 ? l.surplusQuantity : "—"}</td>
                                  <td className="p-2.5 text-right text-brand-red font-medium">{l.shortageQuantity > 0 ? l.shortageQuantity : "—"}</td>
                                  <td className="p-2.5 text-zinc-600">{l.dispatcherName}</td>
                                  <td className="p-2.5">
                                    {l.qualifiesForCreditNote === true ? (
                                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Sí</span>
                                    ) : l.qualifiesForCreditNote === false ? (
                                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">No</span>
                                    ) : (
                                      <span className="text-zinc-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. HCA DETAILS */}
                {activeForm.type === "hca" && (() => {
                  const s = activeForm.data as CorrectiveActionSheet;
                  return (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-zinc-50 p-3.5 text-xs">
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Número HCA</dt>
                          <dd className="mt-0.5 font-mono font-medium text-zinc-800">{s.number}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Línea de Producto</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">{s.productLineName}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Fecha Detección</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">{formatDay(s.detectedAt)}</dd>
                        </div>
                        <div>
                          <dt className="font-heading text-[10px] font-bold uppercase text-zinc-400">Responsable</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">{s.responsibleName}</dd>
                        </div>
                      </dl>

                      <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 text-xs">
                        <span className="font-heading text-[10px] font-bold uppercase text-zinc-400">Hecho / No Conformidad:</span>
                        <p className="mt-1 text-zinc-700 whitespace-pre-wrap">{s.description}</p>
                      </div>

                      {s.causes && s.causes.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-800 mb-2">Causas identificadas (5 Porqués / Raíz)</h4>
                          <ul className="space-y-1.5 text-xs text-zinc-700">
                            {s.causes.map((c, idx) => (
                              <li key={c.id} className="flex items-start gap-2 rounded border border-zinc-100 bg-zinc-50/40 p-2">
                                <span className="font-mono font-bold text-zinc-400">#{idx + 1}</span>
                                <span>{c.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CAMBIAR DE FORMULARIO (MIGRACIÓN) */}
      {migrationModalOpen && migratingFromSource && (
        <Modal
          title="Cambiar de Formulario"
          eyebrow="Migración entre procesos de Plastifar"
          description="Selecciona el nuevo formulario empresarial al que deseas cambiar en este ticket."
          onClose={() => setMigrationModalOpen(false)}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-zinc-50 p-3 border border-zinc-200 text-xs">
              <span className="font-heading text-[10px] font-bold uppercase text-zinc-400">Formulario actual:</span>
              <p className="font-semibold text-zinc-800 mt-0.5">{migratingFromSource.label}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
                ¿A qué formulario deseas cambiar?
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { id: "reclamacion", code: "PF-FOR-034", label: "Reclamación de Clientes", desc: "Quejas, averías y diferencias" },
                  { id: "retiro", code: "PF-FOR-068", label: "Solicitud de Retiro", desc: "Recogida de mercancía física" },
                  { id: "discrepancia", code: "PF-FOR-291", label: "Discrepancia de Cargas", desc: "Sobrantes/faltantes en despacho" },
                  { id: "hca", code: "PF-FOR-109", label: "Hecho, Causa y Acción", desc: "Calidad y causa raíz interna" },
                ]
                  .filter((opt) => opt.id !== migratingFromSource.type)
                  .map((opt) => {
                    const isSelected = migrationTargetType === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setMigrationTargetType(opt.id as EnterpriseFormType)}
                        className={`cursor-pointer rounded-lg border p-3 text-xs transition-all ${
                          isSelected
                            ? "border-brand-red bg-brand-red/5 ring-1 ring-brand-red/30"
                            : "border-zinc-200 bg-white hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold uppercase text-brand-red">{opt.code}</span>
                          {isSelected && <CheckCircle2 className="size-3.5 text-brand-red" />}
                        </div>
                        <p className="mt-1 font-semibold text-zinc-900">{opt.label}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">{opt.desc}</p>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Checkbox for data migration */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={migrateCommonFields}
                  onChange={(e) => setMigrateCommonFields(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-amber-300 text-brand-red focus:ring-brand-red"
                />
                <div>
                  <span className="font-semibold text-amber-900">
                    Migrar datos comunes al nuevo formulario (Recomendado)
                  </span>
                  <p className="mt-0.5 text-[11.5px] text-amber-800 leading-relaxed">
                    Transfiere automáticamente el cliente, la referencia de factura, las líneas de producto cargadas y la descripción o nota. El formulario actual permanecerá guardado en el ticket.
                  </p>
                </div>
              </label>

              {migrateCommonFields && migratingFromSource.data.lines.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-amber-200/60 text-[11px] text-amber-900">
                  <span className="font-medium">Se transferirán:</span> {migratingFromSource.data.lines.length} producto(s)
                  {migratingFromSource.data.invoiceRef ? ` · Factura: ${migratingFromSource.data.invoiceRef}` : ""}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <Button variant="secondary" size="sm" onClick={() => setMigrationModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={handleExecuteMigration}>
                Continuar al nuevo formulario
              </Button>
            </div>
          </div>
        </Modal>
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
            fetchAllForms();
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
            fetchAllForms();
          }}
        />
      )}

      {/* 3. Discrepancia Modal */}
      {discrepancyModalOpen && (
        <DiscrepancyFormModal
          discrepancy={editingDiscrepancy}
          ticketId={ticket.id}
          fixedTicketLabel={`${ticket.number} · ${ticket.subject}`}
          ticketClientName={ticket.clientName ?? undefined}
          ticketClientId={ticket.clientId ?? undefined}
          initialData={discrepancyInitialData}
          onClose={() => setDiscrepancyModalOpen(false)}
          onSaved={() => {
            setDiscrepancyModalOpen(false);
            fetchAllForms();
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
            fetchAllForms();
          }}
        />
      )}
    </div>
  );
}
