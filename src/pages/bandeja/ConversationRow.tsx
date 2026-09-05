import { CornerUpLeft, MessagesSquare, Paperclip } from "lucide-react";
import { Avatar, AvatarFallback } from "../../components/shadcn/avatar";
import { Badge } from "../../components/shadcn/badge";
import { formatEmailListDate, formatTicketCode } from "../../lib/format";
import type { EmailSummaryResponse } from "../../types/api";
import { ticketBadgeClass } from "./badgeStyles";
import { SelectBox } from "./SelectionBar";

interface ConversationRowProps {
  email: EmailSummaryResponse;
  selected: boolean;
  checked: boolean;
  /** Hay alguna fila marcada: las casillas se quedan a la vista en todas. */
  selecting: boolean;
  /** Enviados lista envios sueltos: ahi no hay seleccion. */
  selectable: boolean;
  onOpen: () => void;
  onToggle: (shiftKey: boolean) => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Fila de la lista. La casilla vive sobre el avatar, como en cualquier cliente de
 * correo: aparece al pasar por encima y se queda mientras haya algo seleccionado.
 */
export function ConversationRow({
  email,
  selected,
  checked,
  selecting,
  selectable,
  onOpen,
  onToggle,
}: ConversationRowProps) {
  const name = email.fromName ?? email.fromEmail;

  return (
    <div
      data-selected={selected}
      data-unread={email.unread}
      data-checked={checked}
      data-selecting={selecting}
      className="group relative rounded-edge border border-line bg-white
        transition-[background-color,border-color,box-shadow] duration-200 ease-out
        data-[unread=false]:bg-canvas/60
        data-[unread=false]:hover:border-line-strong data-[unread=false]:hover:bg-canvas
        data-[unread=true]:data-[selected=false]:border-brand-red/40
        data-[unread=true]:data-[selected=false]:bg-brand-red/[0.03]
        data-[unread=true]:data-[selected=false]:shadow-[0_0_0_1px_rgba(228,0,43,0.22),0_2px_6px_-1px_rgba(228,0,43,0.28),0_10px_26px_-6px_rgba(228,0,43,0.45)]
        data-[unread=true]:data-[selected=false]:hover:border-brand-red/60
        data-[unread=true]:data-[selected=false]:hover:bg-brand-red/[0.06]
        data-[unread=true]:data-[selected=false]:hover:shadow-[0_0_0_1px_rgba(228,0,43,0.35),0_3px_8px_-1px_rgba(228,0,43,0.38),0_14px_32px_-6px_rgba(228,0,43,0.6)]
        data-[selected=true]:border-brand-red/45 data-[selected=true]:bg-brand-red/[0.05]
        data-[selected=true]:hover:border-brand-red data-[selected=true]:hover:bg-brand-red/[0.085]
        data-[selected=true]:hover:shadow-[0_6px_16px_-10px_rgba(228,0,43,0.5)]
        data-[checked=true]:border-brand-red/45 data-[checked=true]:bg-brand-red/[0.06]
        data-[checked=true]:shadow-[0_0_0_1px_rgba(228,0,43,0.18),0_2px_8px_-2px_rgba(228,0,43,0.2)]
        has-[button[role=checkbox]:focus-visible]:border-brand-red/40"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col items-start gap-0.5 rounded-edge px-2.5 py-2 text-left outline-none
          focus-visible:ring-3 focus-visible:ring-brand-red/12"
      >
        <div className="flex w-full items-center gap-1.5">
          {/* El avatar cede su sitio a la casilla; el hueco se conserva para que nada salte. */}
          <span className="relative size-5 shrink-0">
            <Avatar
              className={`size-5 transition-opacity duration-200 ease-out ${
                selectable
                  ? "group-hover:opacity-0 group-data-[selecting=true]:opacity-0 group-has-[button[role=checkbox]:focus-visible]:opacity-0"
                  : ""
              }`}
            >
              <AvatarFallback
                className="bg-fill text-[9px] font-semibold text-brand-gray
                  group-data-[selected=true]:bg-brand-red/12
                  group-data-[selected=true]:text-brand-red-dark"
              >
                {initials(name)}
              </AvatarFallback>
            </Avatar>
          </span>
          <span
            className="min-w-0 flex-1 truncate text-[12.5px] text-ink transition-colors
              group-data-[unread=true]:font-bold group-data-[unread=false]:font-medium
              group-data-[selected=true]:text-brand-red-dark"
          >
            {name}
          </span>
          <span className="ml-auto shrink-0 text-[10.5px] font-medium text-faint">
            {formatEmailListDate(email.createdAt)}
          </span>
        </div>

        {/* Distintivos al final del asunto: se ahorra una fila entera por tarjeta. */}
        <div className="flex w-full items-center gap-1.5">
          {email.answered && (
            <CornerUpLeft className="h-3 w-3 shrink-0 text-brand-green" aria-label="Respondido" />
          )}
          <span
            className="min-w-0 flex-1 truncate text-[12px] text-brand-gray
              group-data-[unread=true]:font-semibold group-data-[unread=false]:font-medium"
          >
            {email.subject || "(sin asunto)"}
          </span>
          {(email.messageCount > 1 || email.attachmentCount > 0 || email.ticketId) && (
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {email.messageCount > 1 && (
                <span
                  title={`${email.messageCount} correos en la conversación`}
                  className="flex items-center gap-0.5 text-[10.5px] font-medium text-faint"
                >
                  <MessagesSquare className="h-3 w-3" />
                  {email.messageCount}
                </span>
              )}
              {email.attachmentCount > 0 && (
                <span className="flex items-center gap-0.5 text-[10.5px] font-medium text-faint">
                  <Paperclip className="h-3 w-3" />
                  {email.attachmentCount}
                </span>
              )}
              {email.ticketId && (
                <Badge variant="secondary" className={`${ticketBadgeClass} h-4 px-1.5`}>
                  {formatTicketCode(email.ticketId)}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="line-clamp-1 w-full text-[11.5px] text-subtle">{email.preview}</div>
      </button>

      {selectable && (
        <SelectBox
          checked={checked}
          label={checked ? `Quitar de la selección: ${name}` : `Seleccionar: ${name}`}
          onToggle={onToggle}
          className="absolute left-2.5 top-2 opacity-0 transition-opacity duration-200 ease-out
            group-hover:opacity-100 group-data-[selecting=true]:opacity-100 focus-visible:opacity-100"
        />
      )}
    </div>
  );
}
