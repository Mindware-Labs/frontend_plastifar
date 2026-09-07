import {
  Archive,
  ArchiveRestore,
  Check,
  Mail,
  MailOpen,
  Minus,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/shadcn/tooltip";
import type { EmailBulkAction } from "../../types/api";
import type { FolderKey } from "./BandejaPage";

interface SelectBoxProps {
  checked: boolean | "mixed";
  label: string;
  onToggle: (shiftKey: boolean) => void;
  className?: string;
}

/** Casilla propia: cuadrada, de 2 px, y con el rojo 185 C solo cuando esta marcada. */
export function SelectBox({ checked, label, onToggle, className = "" }: SelectBoxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(event.shiftKey);
      }}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border outline-none
        transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-90
        focus-visible:ring-3 focus-visible:ring-brand-red/20 ${
          checked
            ? "border-brand-red bg-brand-red text-white shadow-[0_1px_3px_rgba(228,0,43,0.3)]"
            : "border-line-strong bg-white text-transparent hover:border-zinc-400"
        } ${className}`}
    >
      {checked === "mixed" ? (
        <Minus className="h-3 w-3 strokeWidth={3} transition-transform duration-150 scale-100" />
      ) : (
        <Check
          className={`h-3 w-3 strokeWidth={3} transition-all duration-150 ${
            checked ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        />
      )}
    </button>
  );
}

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
  "flex h-7 w-7 items-center justify-center rounded-edge outline-none transition-all duration-150 " +
  "hover:scale-105 active:scale-95 focus-visible:ring-3 focus-visible:ring-brand-red/20 disabled:cursor-not-allowed disabled:opacity-40";

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
      } flex h-9 w-full items-center gap-1.5 rounded-edge border border-brand-red/30
        bg-gradient-to-r from-brand-red/[0.07] via-brand-red/[0.04] to-brand-red/[0.07]
        shadow-[0_1px_4px_-1px_rgba(228,0,43,0.18)] pl-2.5 pr-1`}
    >
      <SelectBox
        checked={pageState}
        label={pageState === true ? "Quitar la selección de esta página" : "Seleccionar toda la página"}
        onToggle={onTogglePage}
      />

      <span aria-live="polite" className="ml-1 min-w-0 truncate text-[12px] font-semibold tabular-nums text-ink">
        {count} {count === 1 ? "seleccionada" : "seleccionadas"}
      </span>

      <div className="ml-auto flex items-center gap-0.5">
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
                    ? "text-brand-red hover:bg-brand-red/10 hover:text-brand-red-dark"
                    : "text-brand-gray hover:bg-white hover:text-ink"
                } ${index === READ_TOOLS.length ? "ml-1.5 border-l border-brand-red/15 pl-1.5" : ""}`}
              >
                <tool.icon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tool.label}</TooltipContent>
          </Tooltip>
        ))}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={isExiting}
              onClick={onClear}
              aria-label="Quitar la selección"
              className={`${toolClass} ml-1 text-subtle hover:bg-white hover:text-ink`}
            >
              <X className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Quitar la selección (Esc)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
