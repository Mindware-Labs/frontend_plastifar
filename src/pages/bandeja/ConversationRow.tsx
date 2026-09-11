import { CornerUpLeft, MessagesSquare, Paperclip, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "../../components/shadcn/avatar";
import { Badge } from "../../components/shadcn/badge";
import { formatEmailListDate, formatTicketCode } from "../../lib/format";
import type { EmailSummaryResponse } from "../../types/api";
import { ticketBadgeClass } from "./badgeStyles";
import { SelectBox } from "../../components/ui/SelectBox";

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
  onToggleStar?: () => void;
}

/** Solo lo que no es normal: en cola o fallido. Lo entregado no necesita distintivo. */
const deliveryBadges: Record<string, { label: string; className: string }> = {
  Queued: { label: "En cola", className: "bg-amber-50 text-amber-800 border border-amber-200" },
  Failed: { label: "No enviado", className: "bg-red-50 text-brand-red border border-red-200" },
  Bounced: { label: "Rebotó", className: "bg-red-50 text-brand-red border border-red-200" },
};

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
  onToggleStar,
}: ConversationRowProps) {
  const name = email.fromName ?? email.fromEmail;
  const delivery = email.deliveryStatus ? deliveryBadges[email.deliveryStatus] : undefined;

  return (
    <div
      data-selected={selected}
      data-unread={email.unread}
      data-checked={checked}
      data-selecting={selecting}
      className="group relative rounded-lg border transition-all duration-150 ease-out
        data-[unread=false]:border-zinc-200/80 data-[unread=false]:bg-white/70
        data-[unread=false]:hover:border-zinc-300 data-[unread=false]:hover:bg-zinc-50/80 data-[unread=false]:hover:shadow-2xs
        data-[unread=true]:data-[selected=false]:border-zinc-200/90 data-[unread=true]:data-[selected=false]:bg-white
        data-[unread=true]:data-[selected=false]:shadow-2xs
        data-[unread=true]:data-[selected=false]:hover:border-zinc-300 data-[unread=true]:data-[selected=false]:hover:bg-zinc-50/50 data-[unread=true]:data-[selected=false]:hover:shadow-xs
        data-[selected=true]:border-zinc-300 data-[selected=true]:bg-zinc-100/70
        data-[selected=true]:shadow-xs
        data-[selected=true]:ring-1 data-[selected=true]:ring-zinc-300/60
        data-[selected=true]:hover:border-zinc-300
        data-[checked=true]:border-zinc-300 data-[checked=true]:bg-zinc-100/50
        has-[button[role=checkbox]:focus-visible]:border-zinc-400"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left outline-none
          focus-visible:ring-2 focus-visible:ring-zinc-400/30"
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
                className="bg-zinc-100 text-[9px] font-semibold text-zinc-600 transition-colors
                  group-data-[selected=true]:bg-zinc-200
                  group-data-[selected=true]:text-zinc-900"
              >
                {initials(name)}
              </AvatarFallback>
            </Avatar>
          </span>

          {/* Indicador sutil de no leído: punto rojo luminoso */}
          {email.unread && (
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red shadow-[0_0_6px_rgba(228,0,43,0.5)]"
            />
          )}

          <span
            className="min-w-0 flex-1 truncate text-[12.5px] transition-colors
              group-data-[unread=true]:font-bold group-data-[unread=true]:text-zinc-900
              group-data-[unread=false]:font-semibold group-data-[unread=false]:text-zinc-800
              group-data-[selected=true]:font-bold group-data-[selected=true]:text-zinc-900"
          >
            {name}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <span className="text-[11px] font-medium text-zinc-400">
              {formatEmailListDate(email.createdAt)}
            </span>
            {onToggleStar && (
              <button
                type="button"
                aria-label={email.starred ? "Quitar de destacados" : "Destacar"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar();
                }}
                className={`flex size-4 items-center justify-center rounded outline-none transition-all focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  email.starred
                    ? "text-amber-500 hover:text-amber-600 opacity-100"
                    : "text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-amber-500"
                }`}
              >
                <Star
                  className={`size-3.5 transition-transform active:scale-90 ${
                    email.starred ? "fill-amber-400 text-amber-500" : ""
                  }`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Distintivos al final del asunto: se ahorra una fila entera por tarjeta. */}
        <div className="flex w-full items-center gap-1.5">
          {email.answered && (
            <CornerUpLeft className="h-3 w-3 shrink-0 text-emerald-600" aria-label="Respondido" />
          )}
          <span
            className="min-w-0 flex-1 truncate text-[12px]
              group-data-[unread=true]:font-semibold group-data-[unread=true]:text-zinc-800
              group-data-[unread=false]:font-medium group-data-[unread=false]:text-zinc-600"
          >
            {email.subject || "(sin asunto)"}
          </span>
          {(email.messageCount > 1 || email.attachmentCount > 0 || email.ticketId || delivery) && (
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {delivery && (
                <span
                  className={`rounded-full px-1.5 py-px font-heading text-[9.5px] font-bold uppercase tracking-[0.06em] ${delivery.className}`}
                >
                  {delivery.label}
                </span>
              )}
              {email.messageCount > 1 && (
                <span
                  title={`${email.messageCount} correos en la conversación`}
                  className="flex items-center gap-0.5 text-[10.5px] font-medium text-zinc-400"
                >
                  <MessagesSquare className="h-3 w-3" />
                  {email.messageCount}
                </span>
              )}
              {email.attachmentCount > 0 && (
                <span className="flex items-center gap-0.5 text-[10.5px] font-medium text-zinc-400">
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

        <div className="line-clamp-1 w-full text-[11.5px] text-zinc-400">{email.preview}</div>

        {email.assignedStaffName && (
          <div className="mt-0.5 flex w-full flex-wrap items-center gap-1">
            <span
              title={
                email.assignedUnseen
                  ? `Te asignaron esta conversación · Atiende ${email.assignedStaffName}`
                  : `Atiende ${email.assignedStaffName}`
              }
              className={`ml-auto inline-flex items-center gap-1 text-[10.5px] font-medium ${
                email.assignedUnseen ? "text-brand-red font-semibold" : "text-zinc-400"
              }`}
            >
              {email.assignedUnseen && (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red shadow-[0_0_6px_rgba(228,0,43,0.5)]"
                />
              )}
              <span
                className={
                  email.assignedUnseen
                    ? "flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold bg-red-100 text-red-700"
                    : "flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold bg-zinc-100 text-zinc-600"
                }
              >
                {initials(email.assignedStaffName)}
              </span>
              {email.assignedStaffName.split(" ")[0]}
            </span>
          </div>
        )}
      </div>

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
