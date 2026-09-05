import {
  Archive,
  ArchiveRestore,
  Check,
  Mail,
  MailOpen,
  Minus,
  ShieldAlert,
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
        transition-[background-color,border-color,box-shadow]
        focus-visible:ring-3 focus-visible:ring-brand-red/20 ${
          checked
            ? "border-brand-red bg-brand-red text-white"
            : "border-line-strong bg-white text-transparent hover:border-zinc-400"
        } ${className}`}
    >
      {checked === "mixed" ? (
        <Minus className="h-3 w-3" strokeWidth={3} />
      ) : (
        <Check className="h-3 w-3" strokeWidth={3} />
      )}
    </button>
  );
}

interface Tool {
  action: EmailBulkAction;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Solo el borrado definitivo va en rojo: es el unico sin vuelta atras. */
  destructive?: boolean;
}

const READ_TOOLS: Tool[] = [
  { action: "read", label: "Marcar como leído", icon: MailOpen },
  { action: "unread", label: "Marcar como no leído", icon: Mail },
];

/** Lo que tiene sentido en cada carpeta; restaurar no aparece donde ya se esta. */
const MOVE_TOOLS: Record<Exclude<FolderKey, "sent">, Tool[]> = {
  inbox: [
    { action: "archive", label: "Archivar", icon: Archive },
    { action: "junk", label: "Marcar como no deseado", icon: ShieldAlert },
    { action: "trash", label: "Mover a la papelera", icon: Trash2 },
  ],
  archived: [
    { action: "restore", label: "Devolver a la bandeja", icon: ArchiveRestore },
    { action: "trash", label: "Mover a la papelera", icon: Trash2 },
  ],
  junk: [
    { action: "restore", label: "Devolver a la bandeja", icon: ArchiveRestore },
    { action: "trash", label: "Mover a la papelera", icon: Trash2 },
  ],
  trash: [
    { action: "restore", label: "Devolver a la bandeja", icon: ArchiveRestore },
    { action: "delete", label: "Eliminar definitivamente", icon: Trash2, destructive: true },
  ],
};

interface SelectionBarProps {
  folder: Exclude<FolderKey, "sent">;
  count: number;
  /** Marcadas de las que hay en pantalla: entera, parcial o ninguna. */
  pageState: boolean | "mixed";
  busy: boolean;
  onTogglePage: () => void;
  onClear: () => void;
  onAction: (action: EmailBulkAction) => void;
}

const toolClass =
  "flex h-7 w-7 items-center justify-center rounded-edge outline-none transition-colors " +
  "focus-visible:ring-3 focus-visible:ring-brand-red/20 disabled:cursor-not-allowed disabled:opacity-40";

/** Sustituye a las pestanas mientras hay seleccion: las acciones de fila pasan a ser de grupo. */
export function SelectionBar({
  folder,
  count,
  pageState,
  busy,
  onTogglePage,
  onClear,
  onAction,
}: SelectionBarProps) {
  const tools = [...READ_TOOLS, ...MOVE_TOOLS[folder]];

  return (
    <div
      role="toolbar"
      aria-label="Acciones sobre la selección"
      className="animate-plf-toast-in flex h-9 items-center gap-1.5 rounded-edge border border-brand-red/25
        bg-brand-red/[0.04] pl-2.5 pr-1"
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
                disabled={busy}
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
