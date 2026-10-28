import { AlertCircle, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldState } from "../ui/Field";
import type { Priority, SlaPolicy } from "../../types/settings";
import { filterSlaPolicies, slaPolicyPlazoLabel } from "../../lib/slaPolicyUi";

const PRIORITY_DOT: Record<Priority, string> = {
  Emergencia: "bg-brand-red",
  Alta: "bg-amber-500",
  Normal: "bg-zinc-500",
  Baja: "bg-zinc-300",
};

/** Altura aproximada de una fila SLA (dos líneas + padding). */
const POLICY_ROW_PX = 58;
const POLICY_GAP_PX = 4;
const LIST_VIEWPORT_ITEMS = 3;

const sectionDividerTitleClass =
  "shrink-0 font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 select-none";

export interface SlaPolicyFieldProps {
  label?: string;
  required?: boolean;
  policies: SlaPolicy[] | null;
  loading?: boolean;
  value: string;
  onChange: (policyId: string) => void;
  error?: string;
  state?: FieldState;
  emptyHint?: string;
  searchPlaceholder?: string;
  /** Oculta la etiqueta visible (p. ej. cuando la sección ya tiene título). */
  hideLabel?: boolean;
  /** Título tipo FormDivider + etiqueta de campo con buscador. */
  embeddedSection?: boolean;
  sectionTitle?: string;
  fieldLabel?: string;
  /** Borde superior tipo FormDivider (formulario de tareas). */
  sectionBorder?: boolean;
}

export function SlaPolicyField({
  label = "Política SLA",
  required = true,
  policies,
  loading = false,
  value,
  onChange,
  error,
  state = "idle",
  emptyHint = "Configura políticas activas en Ajustes → SLA.",
  searchPlaceholder = "Buscar política…",
  hideLabel = false,
  embeddedSection = false,
  sectionTitle = "Política SLA",
  fieldLabel = "Compromiso SLA",
  sectionBorder = false,
}: SlaPolicyFieldProps) {
  const [search, setSearch] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const ariaLabel = embeddedSection ? fieldLabel : label;
  const visibleLabel = embeddedSection ? fieldLabel : label;

  const ring =
    state === "error" || error
      ? "ring-1 ring-brand-red/25 border-brand-red"
      : "border-zinc-200";

  const visiblePolicies = useMemo(() => {
    if (!policies) return [];
    return filterSlaPolicies(policies, search, { alwaysIncludeId: value });
  }, [policies, search, value]);

  const listScrollCapHeight =
    LIST_VIEWPORT_ITEMS * POLICY_ROW_PX + Math.max(0, LIST_VIEWPORT_ITEMS - 1) * POLICY_GAP_PX;

  const listNeedsScroll = visiblePolicies.length > LIST_VIEWPORT_ITEMS;

  const showSearchControl = Boolean(policies && policies.length > 0 && !loading);
  const compactSearch = embeddedSection;

  useEffect(() => {
    if (!searchExpanded) return;
    searchInputRef.current?.focus({ preventScroll: true });
  }, [searchExpanded]);

  useEffect(() => {
    if (!searchExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [searchExpanded]);

  function closeSearch() {
    setSearchExpanded(false);
  }

  function renderSectionDivider() {
    return (
      <div className="flex items-center gap-2">
        <span className={sectionDividerTitleClass}>{sectionTitle}</span>
        <div className="h-px flex-1 bg-zinc-100" aria-hidden />
      </div>
    );
  }

  function renderSearchButton() {
    if (!showSearchControl) return null;
    return (
      <button
        type="button"
        aria-label="Buscar políticas SLA"
        aria-expanded={searchExpanded}
        onClick={() => setSearchExpanded(true)}
        className={
          compactSearch
            ? `inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 ${
                search.trim() ? "text-brand-red" : ""
              }`
            : `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white text-zinc-500 shadow-2xs transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800 ${
                search.trim()
                  ? "border-brand-red/35 text-brand-red ring-1 ring-brand-red/15"
                  : "border-zinc-200/90"
              }`
        }
      >
        <Search className={compactSearch ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.25} />
      </button>
    );
  }

  function renderSearchOverlay(expandedInputH: string, closeBtnClass: string) {
    return (
      <div
        key="sla-search-expanded"
        className="absolute inset-0 z-10 flex items-center gap-1 rounded-lg bg-white/95 pr-0.5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-sm animate-plf-side-panel-in [transform-origin:100%_50%]"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className={`w-full rounded-md border border-zinc-200 bg-white pl-7 pr-2 text-[12px] text-zinc-800 placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 [&::-webkit-search-cancel-button]:hidden ${expandedInputH}`}
          />
        </div>
        <button type="button" aria-label="Cerrar búsqueda" onClick={closeSearch} className={closeBtnClass}>
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  function renderFieldLabelRow() {
    const slotH = compactSearch ? "h-7" : "h-8";
    const expandedInputH = slotH;
    const closeBtnClass = compactSearch
      ? "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200/90 bg-white text-zinc-500 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800"
      : "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200/90 bg-white text-zinc-500 shadow-2xs transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800";

    return (
      <div className={`relative min-w-0 shrink-0 ${slotH} overflow-hidden`}>
        <div
          className={`absolute inset-0 flex min-w-0 items-center justify-between gap-2 transition-opacity duration-150 ${
            searchExpanded && showSearchControl ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          aria-hidden={searchExpanded && showSearchControl}
        >
          {!hideLabel && (
            <span className="min-w-0 truncate font-heading text-[11.5px] font-semibold text-faint">
              {visibleLabel} {required && <span className="text-brand-red">*</span>}
            </span>
          )}
          {hideLabel && !embeddedSection && <span className="min-w-0 flex-1" aria-hidden />}
          {renderSearchButton()}
        </div>
        {searchExpanded && showSearchControl && renderSearchOverlay(expandedInputH, closeBtnClass)}
      </div>
    );
  }

  function renderHeader() {
    if (embeddedSection) {
      return (
        <>
          {renderSectionDivider()}
          {renderFieldLabelRow()}
        </>
      );
    }

    return renderFieldLabelRow();
  }

  const rootClass = [
    "flex flex-col gap-1.5",
    sectionBorder ? "border-t border-zinc-100 pt-2" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (loading) {
    return (
      <div className={rootClass}>
        {embeddedSection ? (
          <>
            {renderSectionDivider()}
            <span className="font-heading text-[11.5px] font-semibold text-faint">
              {fieldLabel} {required && <span className="text-brand-red">*</span>}
            </span>
          </>
        ) : (
          !hideLabel && (
            <span className="font-heading text-[11.5px] font-semibold text-faint">
              {visibleLabel} {required && <span className="text-brand-red">*</span>}
            </span>
          )
        )}
        <div className="flex h-20 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/80">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-hidden />
          <span className="sr-only">Cargando políticas SLA</span>
        </div>
      </div>
    );
  }

  if (!policies || policies.length === 0) {
    return (
      <div className={rootClass}>
        {embeddedSection ? (
          <>
            {renderSectionDivider()}
            <span className="font-heading text-[11.5px] font-semibold text-faint">
              {fieldLabel} {required && <span className="text-brand-red">*</span>}
            </span>
          </>
        ) : (
          !hideLabel && (
            <span className="font-heading text-[11.5px] font-semibold text-faint">
              {label} {required && <span className="text-brand-red">*</span>}
            </span>
          )
        )}
        <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-2.5 text-[12px] leading-relaxed text-zinc-500">
          {emptyHint}
        </p>
      </div>
    );
  }

  const policyList = (
    <div className="grid gap-1" role="presentation">
      {visiblePolicies.map((policy) => {
        const isSelected = value === String(policy.id);
        return (
          <button
            key={policy.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(String(policy.id))}
            className={`group flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/35 ${
              isSelected
                ? "border-zinc-300 bg-white font-semibold text-zinc-900 shadow-2xs ring-1 ring-zinc-900/[0.07] hover:border-zinc-400 hover:bg-white hover:shadow-md hover:ring-2 hover:ring-zinc-900/12 active:scale-[0.998]"
                : "border-transparent font-medium text-zinc-600 hover:border-zinc-200/90 hover:bg-white hover:text-zinc-900 hover:shadow-2xs active:bg-zinc-50/80"
            }`}
          >
            <span className="flex w-full min-w-0 items-center gap-2">
              <span
                className={`size-2 shrink-0 rounded-full ${PRIORITY_DOT[policy.priority]}`}
                aria-hidden
              />
              <span className="truncate font-heading text-[12px] leading-snug">{policy.name}</span>
              {policy.isDefault && (
                <span className="ml-auto shrink-0 rounded border border-zinc-200/90 bg-zinc-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                  Predeterminada
                </span>
              )}
            </span>
            <span
              className={`pl-4 text-[10.5px] leading-snug transition-colors ${
                isSelected
                  ? "text-zinc-500 group-hover:text-zinc-600"
                  : "text-zinc-400 group-hover:text-zinc-500"
              }`}
            >
              Prioridad {policy.priority.toLowerCase()} · {slaPolicyPlazoLabel(policy)}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={rootClass}>
      {renderHeader()}

      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={`rounded-lg border bg-zinc-50/70 p-1 ${ring}`}
      >
        {visiblePolicies.length === 0 ? (
          <p className="px-2.5 py-3 text-center text-[12px] text-zinc-500">
            Ninguna política coincide con la búsqueda.
          </p>
        ) : listNeedsScroll ? (
          <div
            className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain"
            style={{ maxHeight: listScrollCapHeight }}
          >
            {policyList}
          </div>
        ) : (
          policyList
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-brand-red-dark animate-plf-shake">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
