import {
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
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
import { useModalAnimation } from "../../hooks/useModalAnimation";

interface RespuestasHelpSheetProps {
  onClose: () => void;
  onNewResponse?: () => void;
}

export function RespuestasHelpSheet({ onClose, onNewResponse }: RespuestasHelpSheetProps) {
  const { isExiting, requestClose } = useModalAnimation(onClose, 220);
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
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] transition-opacity ${
        isExiting ? "animate-plf-scrim-out pointer-events-none" : "animate-plf-scrim-in"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-full w-full flex-col bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)] transition-all duration-200 ease-out sm:w-[600px] md:w-[650px] ${
          isExiting ? "animate-plf-drawer-out pointer-events-none" : "animate-plf-drawer-in"
        }`}
      >
        {/* Cabecera del Sheet */}
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-canvas/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-edge bg-brand-red/10 text-brand-red">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id={titleId} className="font-heading text-[16px] font-bold tracking-[-0.01em] text-ink">
                  Respuestas Predefinidas
                </h2>
                <span className="rounded-edge border border-line bg-white px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-brand-gray">
                  Guía de uso
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-brand-gray">
                Plantillas de correo reutilizables para el equipo de atención y soporte.
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            aria-label="Cerrar guía"
            title="Cerrar (Esc)"
            className="flex h-8 w-8 items-center justify-center rounded-edge text-brand-gray outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido formativo y detallado */}
        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6 text-ink">
          {/* Introducción / Propósito */}
          <div className="rounded-edge border border-line bg-canvas/40 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-edge bg-brand-red text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-heading text-[13.5px] font-bold text-ink">
                  ¿Qué son y para qué se utilizan?
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-brand-gray">
                  Son <strong>estructuras y textos de correo estandarizados</strong> que guardas una sola vez para utilizarlos cuantas veces sea necesario. En lugar de tipear manualmente las mismas respuestas sobre precios, cuentas bancarias, políticas de envío o confirmaciones de pedidos, las insertas en tu correo con dos clics.
                </p>
              </div>
            </div>
          </div>

          {/* Bloque: Ejemplo visual concreto */}
          <section className="space-y-3">
            <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray">
              Anatomía de una plantilla efectiva
            </h3>

            <div className="overflow-hidden rounded-edge border border-line bg-white">
              <div className="flex items-center justify-between border-b border-line bg-canvas/60 px-4 py-2 text-[11.5px]">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-brand-red" />
                  <span className="font-heading font-semibold text-ink">Ejemplo: Confirmación de Pedido</span>
                </div>
                <span className="text-[11px] text-brand-gray">Plantilla de texto</span>
              </div>

              <div className="p-4 font-sans text-[12.5px] leading-relaxed text-ink">
                <p className="font-medium">
                  Estimado/a <span className="rounded-edge border border-brand-red/30 bg-brand-red/10 px-1.5 py-0.5 font-mono text-[11.5px] text-brand-red-dark">[Nombre del Cliente]</span>,
                </p>
                <p className="mt-2.5">
                  Confirmamos la recepción de su solicitud para el pedido <span className="rounded-edge border border-brand-red/30 bg-brand-red/10 px-1.5 py-0.5 font-mono text-[11.5px] text-brand-red-dark">[N° Pedido]</span>. Su orden ha ingresado a nuestra línea de preparación en planta.
                </p>
                <p className="mt-2.5">
                  El tiempo estimado de entrega en su dirección es de <span className="rounded-edge border border-brand-red/30 bg-brand-red/10 px-1.5 py-0.5 font-mono text-[11.5px] text-brand-red-dark">[Días hábiles]</span>.
                </p>
                <p className="mt-2.5 text-brand-gray">
                  Quedamos a su entera disposición ante cualquier requerimiento.
                </p>
              </div>

              <div className="border-t border-line bg-canvas/30 px-4 py-2 text-[11px] text-brand-gray">
                <span className="font-medium text-ink">Tip:</span> Los corchetes <code className="font-mono text-brand-red-dark">[...]</code> le indican al agente de soporte qué partes del texto debe personalizar con los datos del caso antes de presionar Enviar.
              </div>
            </div>
          </section>

          {/* Bloque: 4 Beneficios Operativos */}
          <section className="space-y-3">
            <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray">
              Beneficios para el equipo de atención
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-edge border border-line bg-white p-3.5">
                <div className="flex items-center gap-2 text-brand-red">
                  <Clock className="h-4 w-4" />
                  <span className="font-heading text-[12.5px] font-bold text-ink">Ahorro de Tiempo</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-brand-gray">
                  Reduce el tiempo promedio de redacción de 5 minutos a menos de 30 segundos por correo.
                </p>
              </div>

              <div className="rounded-edge border border-line bg-white p-3.5">
                <div className="flex items-center gap-2 text-brand-red">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-heading text-[12.5px] font-bold text-ink">Cero Errores Críticos</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-brand-gray">
                  Asegura que números de RNC, cuentas bancarias, direcciones y políticas se envíen siempre exactos.
                </p>
              </div>

              <div className="rounded-edge border border-line bg-white p-3.5">
                <div className="flex items-center gap-2 text-brand-red">
                  <Users className="h-4 w-4" />
                  <span className="font-heading text-[12.5px] font-bold text-ink">Consistencia Institucional</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-brand-gray">
                  Todo el equipo responde con el mismo estándar de cortesía, tono profesional y ortografía impecable.
                </p>
              </div>

              <div className="rounded-edge border border-line bg-white p-3.5">
                <div className="flex items-center gap-2 text-brand-red">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="font-heading text-[12.5px] font-bold text-ink">Rápida Incorporación</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-brand-gray">
                  Los nuevos agentes pueden responder consultas complejas con seguridad desde su primera jornada.
                </p>
              </div>
            </div>
          </section>

          {/* Bloque: Paso a Paso en Bandeja */}
          <section className="space-y-3">
            <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray">
              ¿Cómo utilizarlas en la bandeja de entrada?
            </h3>

            <div className="space-y-3 rounded-edge border border-line bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-edge bg-brand-red text-[11px] font-bold text-white">
                  1
                </div>
                <div>
                  <h4 className="font-heading text-[12.5px] font-semibold text-ink">
                    Abre una conversación o inicia un correo nuevo
                  </h4>
                  <p className="text-[12px] leading-relaxed text-brand-gray">
                    Accede a cualquier hilo en tu bandeja o pulsa "Redactar" para abrir el compositor de correo.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-edge bg-brand-red text-[11px] font-bold text-white">
                  2
                </div>
                <div>
                  <h4 className="flex items-center gap-1.5 font-heading text-[12.5px] font-semibold text-ink">
                    Haz clic en el botón "Respuestas rápidas"
                    <span className="inline-flex items-center gap-1 rounded-edge border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink">
                      <MessageSquareText className="h-3 w-3 text-brand-red" />
                      Respuestas rápidas
                    </span>
                  </h4>
                  <p className="text-[12px] leading-relaxed text-brand-gray">
                    Ubicado en la barra de herramientas inferior del editor, junto a las opciones de adjuntar archivo.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-edge bg-brand-red text-[11px] font-bold text-white">
                  3
                </div>
                <div>
                  <h4 className="font-heading text-[12.5px] font-semibold text-ink">
                    Elige la plantilla que necesitas
                  </h4>
                  <p className="text-[12px] leading-relaxed text-brand-gray">
                    Usa el buscador integrado en el menú desplegable para encontrar la plantilla por título o palabras clave.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-edge bg-brand-red text-[11px] font-bold text-white">
                  4
                </div>
                <div>
                  <h4 className="font-heading text-[12.5px] font-semibold text-ink">
                    El texto se añade directamente al mensaje
                  </h4>
                  <p className="text-[12px] leading-relaxed text-brand-gray">
                    La plantilla se inserta respetando los párrafos sin borrar lo que ya tenías redactado.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-edge bg-brand-red text-[11px] font-bold text-white">
                  5
                </div>
                <div>
                  <h4 className="font-heading text-[12.5px] font-semibold text-ink">
                    Ajusta los datos puntuales y envía
                  </h4>
                  <p className="text-[12px] leading-relaxed text-brand-gray">
                    Personaliza los campos entre corchetes con los datos concretos del cliente y envía el correo con confianza.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Bloque: Consejos de redacción */}
          <section className="space-y-3">
            <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray">
              Recomendaciones para crear excelentes plantillas
            </h3>

            <div className="space-y-2.5 rounded-edge border border-line bg-canvas/30 p-4 text-[12px] leading-relaxed text-brand-gray">
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p>
                  <strong className="text-ink">Usa títulos claros y descriptivos:</strong> En lugar de <em>"Plantilla 1"</em>, usa <em>"Instrucciones de pago por transferencia"</em> o <em>"Recepción de cotización de empaques"</em>.
                </p>
              </div>

              <div className="border-t border-line/60 pt-2 flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p>
                  <strong className="text-ink">Separa los párrafos con una línea en blanco:</strong> Al redactar en el estudio, dar un salto de línea doble ayuda a que el editor de correo monte bloques de texto limpios y agradables a la vista.
                </p>
              </div>

              <div className="border-t border-line/60 pt-2 flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p>
                  <strong className="text-ink">Mantén modularidad:</strong> Es preferible tener respuestas concisas y específicas que se puedan combinar en un mismo correo si el cliente hace varias preguntas.
                </p>
              </div>
            </div>
          </section>

          {/* Bloque: Permisos y Gobernanza */}
          <section className="rounded-edge border border-line bg-white p-4">
            <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray">
              Permisos y Gobernanza
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-brand-gray">
              Cualquier agente puede utilizar las respuestas predefinidas para responder correos. Para preservar la integridad del catálogo, <strong>solo la persona que creó la plantilla o un administrador del sistema</strong> pueden editarla o eliminarla.
            </p>
          </section>
        </div>

        {/* Pie del Sheet */}
        <div className="flex shrink-0 items-center justify-between border-t border-line bg-canvas/90 px-6 py-3.5">
          <Button type="button" variant="secondary" onClick={requestClose}>
            Entendido
          </Button>

          {onNewResponse && (
            <Button
              type="button"
              onClick={() => {
                requestClose();
                onNewResponse();
              }}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Crear nueva respuesta
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
