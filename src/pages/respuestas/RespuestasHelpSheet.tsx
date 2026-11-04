import {
  CheckCircle2,
  Clock,
  FileText,
  Lightbulb,
  MessageSquareText,
  Plus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui/Button";
import { dialogHeaderShellClass, dialogHeaderStackClass } from "../../components/ui/dialogHeaderStyles";
import { useDialogMotion } from "../../hooks/useDialogMotion";

interface RespuestasHelpSheetProps {
  onClose: () => void;
  onNewResponse?: () => void;
}

export function RespuestasHelpSheet({ onClose, onNewResponse }: RespuestasHelpSheetProps) {
  const { isExiting, requestClose, scrimRef, panelRef } = useDialogMotion(onClose, { variant: "drawer" });
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isExiting) {
        requestClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExiting, requestClose]);

  return createPortal(
    <div
      ref={scrimRef}
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] transition-opacity ${
        isExiting ? "pointer-events-none" : ""
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-full w-full flex-col bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)] transition-all duration-200 ease-out sm:w-[580px] md:w-[640px] ${
          isExiting ? "pointer-events-none" : ""
        }`}
      >
        <div className={dialogHeaderShellClass}>
          <div className={dialogHeaderStackClass}>
            <p className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              Correo
            </p>
            <h2 id={titleId} className="font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
              Plantillas de correo
            </h2>
            <p className="text-[12px] leading-relaxed text-subtle">
              Guarda un mensaje una vez y reutilízalo al redactar desde la bandeja con «Insertar plantilla».
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            aria-label="Cerrar (Esc)"
            title="Cerrar (Esc)"
            className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/25"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-ink">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
              >
                <FileText className="size-3" strokeWidth={2.25} />
              </span>
              <h3 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">
                Cómo se ve una respuesta
              </h3>
            </div>

            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xs">
              <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 text-[11.5px] font-heading font-semibold text-ink">
                Ejemplo: confirmación de pedido
              </div>

              <div className="p-4 font-sans text-[12.5px] leading-relaxed text-ink">
                <p className="font-medium leading-relaxed">
                  Estimado/a{" "}
                  <span className="inline-flex items-center rounded border border-zinc-300/90 bg-zinc-100/90 px-1.5 py-0 font-sans text-[11px] font-medium text-zinc-800">
                    Cliente
                  </span>
                  ,
                </p>
                <p className="mt-2.5 leading-relaxed">
                  Confirmamos su pedido{" "}
                  <span className="inline-flex items-center rounded border border-zinc-300/90 bg-zinc-100/90 px-1.5 py-0 font-sans text-[11px] font-medium text-zinc-800">
                    Ticket
                  </span>
                  . Nuestro equipo ya está atendiendo los detalles.
                </p>
              </div>

              <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5 text-[11.5px] text-zinc-500">
                En el editor se ven como chips (p. ej. «Cliente», «Ticket»). Al insertar la plantilla en la bandeja se
                rellenan solas cuando el dato está en el hilo; si no, las completas tú antes de enviar.
              </div>
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">
              En la práctica
            </h3>
            <ul className="grid gap-2 sm:grid-cols-3">
              <li className="rounded-lg border border-zinc-200/80 bg-white p-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-brand-red" strokeWidth={2.25} />
                  <span className="font-heading text-[12px] font-bold text-ink">Menos tiempo</span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">Respondes en segundos, no desde cero.</p>
              </li>
              <li className="rounded-lg border border-zinc-200/80 bg-white p-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-brand-red" strokeWidth={2.25} />
                  <span className="font-heading text-[12px] font-bold text-ink">Menos errores</span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">
                  Cuentas, RNC y direcciones salen siempre iguales.
                </p>
              </li>
              <li className="rounded-lg border border-zinc-200/80 bg-white p-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Users className="size-3.5 text-brand-red" strokeWidth={2.25} />
                  <span className="font-heading text-[12px] font-bold text-ink">Mismo tono</span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">Todo el equipo suena alineado con Plastifar.</p>
              </li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h3 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">
              Cómo usarlas en la bandeja
            </h3>
            <ol className="space-y-2.5 rounded-lg border border-zinc-200/80 bg-white p-4 text-[12px] leading-relaxed text-subtle shadow-2xs">
              <li className="flex gap-2.5">
                <span className="font-heading font-bold text-ink">1.</span>
                <span>Abre un hilo o redacta un correo nuevo.</span>
              </li>
              <li className="flex flex-wrap items-center gap-1.5">
                <span className="font-heading font-bold text-ink">2.</span>
                <span>Pulsa</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-700">
                  <MessageSquareText className="size-3 text-brand-red" />
                  Insertar plantilla
                </span>
                <span>en la barra del editor.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="font-heading font-bold text-ink">3.</span>
                <span>Elige una, ajusta lo que haga falta y envía. No borra lo que ya habías escrito.</span>
              </li>
            </ol>
          </section>

          <section className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-4">
            <h3 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">
              Al crear una respuesta
            </h3>
            <ul className="mt-2 space-y-2 text-[12px] leading-relaxed text-subtle">
              <li className="flex gap-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span>
                  <strong className="text-ink">Ponle un nombre que se entienda:</strong> por ejemplo &quot;Datos para
                  transferencia&quot;, no &quot;Plantilla 3&quot;.
                </span>
              </li>
              <li className="flex gap-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span>
                  <strong className="text-ink">Mejor varias cortas que una enorme:</strong> así combinas según lo que
                  pregunte el cliente.
                </span>
              </li>
            </ul>
            <p className="mt-3 border-t border-zinc-200/60 pt-3 text-[11.5px] text-subtle">
              Todos pueden usar las respuestas del equipo. Solo quien la creó o un administrador puede editarla o
              borrarla.
            </p>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-white px-6 py-3.5">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-zinc-400">
            <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600">
              Esc
            </kbd>
            <span>para cerrar</span>
          </span>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
              Entendido
            </Button>

            {onNewResponse && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  requestClose();
                  onNewResponse();
                }}
                className="gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Crear plantilla</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
