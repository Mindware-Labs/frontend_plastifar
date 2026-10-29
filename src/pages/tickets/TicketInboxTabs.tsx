import type { TicketInboxTabResponse } from "../../types/api";

interface TicketInboxTabsProps {
  tabs: TicketInboxTabResponse[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
}

/** Pestañas de departamento en la bandeja: alcance primario (acción completa) vs observado (solo lectura). */
export function TicketInboxTabs({ tabs, activeTabId, onSelect }: TicketInboxTabsProps) {
  if (tabs.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Departamentos de la bandeja"
      className="mb-3 flex flex-wrap items-center gap-1.5"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const readOnly = tab.mode === "readOnly";
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.id)}
            className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-colors outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
              active
                ? "border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                : "border-transparent bg-zinc-50 font-medium text-zinc-600 hover:border-zinc-200/80 hover:bg-white hover:text-zinc-900"
            }`}
          >
            <span className="truncate">{tab.label}</span>
            {readOnly && (
              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                Solo lectura
              </span>
            )}
            {tab.ticketCount != null && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  active ? "bg-zinc-200 text-zinc-800" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {tab.ticketCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
