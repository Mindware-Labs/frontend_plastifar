import {
  Archive,
  ArchiveRestore,
  Mail,
  MailOpen,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/shadcn/tooltip";
import { SelectBox } from "../../components/ui/SelectBox";
import type { EmailBulkAction } from "../../types/api";
import type { FolderKey } from "./BandejaPage";

interface Tool {
  action: EmailBulkAction;
  label: string;
  icon: ComponentType<{ className?: string }>;
  destructive?: boolean;
}

const READ_TOOLS: Tool[] = [
  { action: "read", label: "Marcar como leído", icon: MailOpen },
  { action: "unread", label: "Marcar como no leído", icon: Mail },
];

const MOVE_TOOLS: Record<Exclude<FolderKey, "sent">, Tool[]> = {
  inbox: [
    { action: "archive", label: "Archivar", icon: Archive },
    { action: "star", label: "Destacar", icon: Star },
    { action: "trash", label: "Mover a la papelera", icon: Trash2 },
  ],
  archived: [
    { action: "restore", label: "Devolver a la bandeja", icon: ArchiveRestore },
    { action: "star", label: "Destacar", icon: Star },
    { action: "trash", label: "Mover a la papelera", icon: Trash2 },
  ],
  starred: [
    { action: "unstar", label: "Quitar de destacados", icon: StarOff },
    { action: "archive", label: "Archivar", icon: Archive },
    { action: "trash", label: "Mover a la papelera", icon: Trash2 },
  ],
  trash: [
    { action: "restore", label: "Devolver a la bandeja", icon: ArchiveRestore },
    { action: "delete", label: "Eliminar definitivamente", icon: Trash2, destructive: true },
  ],
};

interface SelectionBarProps {
  folder: Exclude<FolderKey, "sent">;
  /** Eliminar definitivamente es de administradores: a los demas no se les muestra. */
  canDelete: boolean;
  count: number;
  pageState: boolean | "mixed";
  busy: boolean;
  isExiting?: boolean;
  onTogglePage: () => void;
  onClear: () => void;
  onAction: (action: EmailBulkAction) => void;
}

const toolClass =
  "flex h-6.5 w-6.5 items-center justify-center rounded-md border border-zinc-200 bg-white " +
  "text-zinc-600 shadow-2xs outline-none transition-all duration-150 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 " +
  "active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/20 disabled:cursor-not-allowed disabled:opacity-40";

export function SelectionBar({
  folder,
  canDelete,
  count,
  pageState,
  busy,
  isExiting = false,
  onTogglePage,
  onClear,
  onAction,
}: SelectionBarProps) {
  const tools = [...READ_TOOLS, ...MOVE_TOOLS[folder]].filter(
    (tool) => tool.action !== "delete" || canDelete,
  );

  return (
    <div
      role="toolbar"
      aria-label="Acciones sobre la selección"
      className={`${
        isExiting ? "animate-plf-selection-out pointer-events-none" : "animate-plf-selection-in"
      } flex h-8 w-full items-center rounded-lg border border-zinc-200 bg-zinc-50/80 shadow-2xs pl-2.5 pr-1`}
    >
      <SelectBox
        checked={pageState}
        label={pageState === true ? "Quitar la selección de esta página" : "Seleccionar toda la página"}
        onToggle={onTogglePage}
      />

      <div className="ml-2 flex items-center gap-1.5 min-w-0">
        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-red px-1.5 text-[11px] font-bold text-white tabular-nums leading-none tracking-tight">
          {count}
        </span>
        <span className="truncate font-heading text-[12px] font-semibold text-zinc-800">
          {count === 1 ? "seleccionado" : "seleccionados"}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {tools.map((tool, index) => (
          <Tooltip key={tool.action}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={busy || isExiting}
                onClick={() => onAction(tool.action)}
                aria-label={tool.label}
                className={`${toolClass} ${
                  tool.destructive
                    ? "text-brand-red hover:border-red-200 hover:bg-red-50 hover:text-brand-red"
                    : ""
                } ${index === READ_TOOLS.length ? "ml-1" : ""}`}
              >
                <tool.icon className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tool.label}</TooltipContent>
          </Tooltip>
        ))}

        <div className="mx-0.5 h-3.5 w-px bg-zinc-200" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={isExiting}
              onClick={onClear}
              aria-label="Quitar la selección (Esc)"
              title="Quitar la selección (Esc)"
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md text-zinc-400 outline-none transition-colors hover:bg-zinc-200/60 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Quitar la selección (Esc)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
