import {
  CheckCircle2,
  Clock,
  FileText,
  Lightbulb,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui/Button";
import { useDialogMotion } from "../../hooks/useDialogMotion";

interface RespuestasHelpSheetProps {
  onClose: () => void;
  onNewResponse?: () => void;
}

export function RespuestasHelpSheet({ onClose, onNewResponse }: RespuestasHelpSheetProps) {
  const { isExiting, requestClose, scrimRef, panelRef } = useDialogMotion(onClose, { variant: "drawer" });
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus en el botón de cerrar y escucha de tecla Escape
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
        {/* Cabecera del Sheet con nueva jerarquía */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <p className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              Correo · Respuestas predefinidas
            </p>
            <h2 id={titleId} className="mt-1 font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
              ¿Para qué sirven las respuestas rápidas?
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
              Guía de uso y mejores prácticas para el equipo de atención y soporte.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            aria-label="Cerrar guía (Esc)"
            title="Cerrar (Esc)"
            className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/25"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido formativo */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 text-ink">
          {/* Introducción / Propósito */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red"
              >
                <Sparkles className="size-4" strokeWidth={2.25} />
              </span>
              <div>
                <h3 className="font-heading text-[13.5px] font-bold text-ink">
                  Estandariza la comunicación con tus clientes
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
                  Las respuestas rápidas son <strong>estructuras de correo predefinidas</strong> que guardas una sola vez para utilizarlas cuantas veces sea necesario. En lugar de redactar repetidamente las mismas instrucciones sobre cuentas bancarias, políticas de envío, garantías o confirmaciones de órdenes, las insertas en tu correo con dos clics.
                </p>
              </div>
            </div>
          </div>

          {/* Bloque: Ejemplo visual concreto */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
              >
                <FileText className="size-3" strokeWidth={2.25} />
              </span>
              <h3 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">
                Anatomía de una plantilla efectiva
              </h3>
            </div>

            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 text-[11.5px]">
                <span className="font-heading font-semibold text-ink">Ejemplo: Confirmación de Pedido</span>
                <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-heading text-[9.5px] font-bold uppercase tracking-[0.06em] text-zinc-500">
                  Plantilla
                </span>
              </div>

              <div className="p-4 font-sans text-[12.5px] leading-relaxed text-ink">
                <p className="font-medium">
                  Estimado/a{" "}
                  <span className="rounded-md border border-brand-red/20 bg-brand-red/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-red">
                    [Nombre del Cliente]
                  </span>
                  ,
                </p>
                <p className="mt-2.5">
                  Confirmamos la recepción de su solicitud para el pedido{" "}
                  <span className="rounded-md border border-brand-red/20 bg-brand-red/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-red">
                    [N° Pedido]
                  </span>
                  . Su orden ha ingresado a nuestra línea de preparación en planta.
                </p>
                <p className="mt-2.5">
                  El tiempo estimado de entrega en su dirección es de{" "}
                  <span className="rounded-md border border-brand-red/20 bg-brand-red/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-red">
                    [Días hábiles]
                  </span>
                  .
                </p>
                <p className="mt-2.5 text-subtle">
                  Quedamos a su entera disposición ante cualquier requerimiento.
                </p>
              </div>

              <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5 text-[11.5px] text-zinc-500">
                <span className="font-semibold text-zinc-700">Tip de personalización:</span> Los corchetes{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono font-medium text-brand-red">[...]</code> le indican
                al colaborador qué partes del texto debe completar con los datos particulares del caso antes de enviar.
              </div>
            </div>
          </section>

          {/* Bloque: 4 Beneficios Operativos */}
          <section className="space-y-3">
            <h3 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">
              Beneficios para el equipo de atención
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
                  >
                    <Clock className="size-3.5" strokeWidth={2.25} />
                  </span>
                  <span className="font-heading text-[12.5px] font-bold text-ink">Ahorro de tiempo</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-subtle">
                  Reduce el tiempo promedio de redacción de 5 minutos a menos de 30 segundos por correo.
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
                  >
                    <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
                  </span>
                  <span className="font-heading text-[12.5px] font-bold text-ink">Cero errores críticos</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-subtle">
                  Asegura que números de RNC, cuentas bancarias, direcciones y políticas se envíen siempre exactos.
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
                  >
                    <Users className="size-3.5" strokeWidth={2.25} />
                  </span>
                  <span className="font-heading text-[12.5px] font-bold text-ink">Consistencia institucional</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-subtle">
                  Todo el equipo responde con el mismo estándar de cortesía, tono profesional y ortografía impecable.
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
                  >
                    <ShieldCheck className="size-3.5" strokeWidth={2.25} />
                  </span>
                  <span className="font-heading text-[12.5px] font-bold text-ink">Rápida incorporación</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-subtle">
                  Los nuevos colaboradores pueden responder consultas complejas con seguridad desde su primer día.
                </p>
              </div>
            </div>
          </section>

          {/* Bloque: Paso a Paso en Bandeja */}
          <section className="space-y-3">
            <h3 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">
              ¿Cómo utilizarlas en la bandeja de entrada?
            </h3>

            <div className="space-y-3.5 rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-md bg-zinc-900 font-heading text-[10.5px] font-bold text-white shadow-2xs"
                >
                  1
                </span>
                <div>
                  <h4 className="font-heading text-[12.5px] font-semibold text-ink">
                    Abre una conversación o inicia un correo nuevo
                  </h4>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
                    Accede a cualquier hilo en tu bandeja o pulsa "Redactar" para abrir el compositor de correo.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-md bg-zinc-900 font-heading text-[10.5px] font-bold text-white shadow-2xs"
                >
                  2
                </span>
                <div>
                  <h4 className="flex flex-wrap items-center gap-1.5 font-heading text-[12.5px] font-semibold text-ink">
                    <span>Haz clic en el botón</span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-700">
                      <MessageSquareText className="size-3 text-brand-red" />
                      <span>Respuestas rápidas</span>
                    </span>
                  </h4>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
                    Ubicado en la barra de herramientas inferior del editor, junto a las opciones de adjuntos.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-md bg-zinc-900 font-heading text-[10.5px] font-bold text-white shadow-2xs"
                >
                  3
                </span>
                <div>
                  <h4 className="font-heading text-[12.5px] font-semibold text-ink">
                    Elige la plantilla que necesitas
                  </h4>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
                    Usa el buscador integrado en el menú para encontrar la respuesta por título o palabras clave.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-md bg-zinc-900 font-heading text-[10.5px] font-bold text-white shadow-2xs"
                >
                  4
                </span>
                <div>
                  <h4 className="font-heading text-[12.5px] font-semibold text-ink">
                    El texto se añade directamente al mensaje
                  </h4>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
                    La plantilla se inserta respetando los párrafos sin borrar lo que ya tenías redactado.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-md bg-zinc-900 font-heading text-[10.5px] font-bold text-white shadow-2xs"
                >
                  5
                </span>
                <div>
                  <h4 className="font-heading text-[12.5px] font-semibold text-ink">
                    Ajusta los datos puntuales y envía
                  </h4>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
                    Personaliza los campos entre corchetes con los datos concretos del cliente y envía el correo con confianza.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Bloque: Consejos de redacción */}
          <section className="space-y-3">
            <h3 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">
              Recomendaciones para crear excelentes plantillas
            </h3>

            <div className="space-y-2.5 rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-4 text-[12px] leading-relaxed text-subtle">
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  <strong className="text-ink">Usa títulos claros y descriptivos:</strong> En lugar de <em>"Plantilla 1"</em>, usa <em>"Instrucciones de pago por transferencia"</em> o <em>"Recepción de cotización de empaques"</em>.
                </p>
              </div>

              <div className="my-2 h-px bg-zinc-200/60" />

              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  <strong className="text-ink">Separa los párrafos con una línea en blanco:</strong> Al redactar en el estudio, dar un salto de línea doble ayuda a que el editor de correo monte bloques de texto limpios y agradables a la vista.
                </p>
              </div>

              <div className="my-2 h-px bg-zinc-200/60" />

              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  <strong className="text-ink">Mantén modularidad:</strong> Es preferible tener respuestas concisas y específicas que se puedan combinar en un mismo correo si el cliente hace varias preguntas.
                </p>
              </div>
            </div>
          </section>

          {/* Bloque: Permisos y Gobernanza */}
          <section className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs">
            <h3 className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">
              Permisos y Gobernanza
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-subtle">
              Cualquier agente puede utilizar las respuestas predefinidas para responder correos. Para preservar la integridad del catálogo institucional, <strong>solo la persona que creó la plantilla o un administrador del sistema</strong> pueden editarla o eliminarla.
            </p>
          </section>
        </div>

        {/* Pie del Sheet */}
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
                <Sparkles className="size-3.5" />
                <span>Crear respuesta</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
