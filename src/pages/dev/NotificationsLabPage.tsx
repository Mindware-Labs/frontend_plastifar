import {
  BellRing,
  CheckCircle2,
  Hourglass,
  Info,
  Mail,
  Play,
  RotateCcw,
  Ticket,
  TriangleAlert,
  UserRoundCheck,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { ReceiptCard } from "../../components/app/ReceiptStack";
import { AuthAlert } from "../../components/auth/AuthAlert";
import { AuthToast, AuthToastCard } from "../../components/auth/AuthToast";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Toast, ToastCard } from "../../components/ui/Toast";
import { useReceipts } from "../../context/useReceipts";
import {
  playChime,
  requestDesktop,
  showArrival,
  showAssignment,
  showTicketAssignment,
  showTicketSlaAlert,
} from "../../lib/notifications";
import { ComposerSendSuccessLayer } from "../bandeja/ComposerSendSuccessLayer";
import type { ComposerSendCelebrationKind } from "../bandeja/useComposerSendCelebration";

export function NotificationsLabPage() {
  const receipts = useReceipts();

  // Textos editables para probar cómo se ven todas las notificaciones con cualquier contenido
  const [customSuccessTitle, setCustomSuccessTitle] = useState("Conversación archivada correctamente");
  const [customSuccessDetail, setCustomSuccessDetail] = useState("cliente@empresa.com · Cotización de envases");
  const [customErrorTitle, setCustomErrorTitle] = useState("No se pudo enviar el correo");
  const [customErrorDetail, setCustomErrorDetail] = useState("El servidor SMTP no respondió a tiempo.");
  const customInfoText =
    "En cola de salida: el proveedor no respondió y se reintentará automáticamente.";

  // Estado para disparar Toasts reales en el portal superior
  const [liveToast, setLiveToast] = useState<{
    message: string;
    variant: "success" | "error" | "info";
  } | null>(null);

  const [liveAuthToast, setLiveAuthToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  // Key y variante para reiniciar la animación de celebración de envío
  const [celebrationKey, setCelebrationKey] = useState(1);
  const [celebrationKind, setCelebrationKind] = useState<ComposerSendCelebrationKind>("reply");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-zinc-50/70">
      {/* Cabecera del Laboratorio */}
      <header className="sticky top-0 z-20 border-b border-zinc-200/90 bg-white/95 px-6 py-4 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
              <BellRing className="size-4.5" strokeWidth={2.2} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-brand-red">
                  Vista temporal de diseño
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-heading text-[9.5px] font-bold uppercase tracking-wider text-zinc-600">
                  Live Lab
                </span>
              </div>
              <h1 className="font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">
                Laboratorio de Notificaciones y Avisos
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                playChime(true);
              }}
            >
              <Volume2 className="size-3.5" />
              Probar sonido
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                receipts.done({
                  action: "lab-done",
                  title: customSuccessTitle,
                  detail: customSuccessDetail,
                  undo: {
                    label: "Deshacer",
                    run: () => {},
                  },
                });
              }}
            >
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Disparar recibo de éxito
            </Button>
            <Button
              size="sm"
              onClick={() => {
                receipts.failed({
                  action: "lab-fail",
                  title: customErrorTitle,
                  detail: customErrorDetail,
                  undo: {
                    label: "Reintentar",
                    run: () => {},
                  },
                });
              }}
            >
              <TriangleAlert className="size-3.5" />
              Disparar recibo de error
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-6">
        {/* Panel rápido de textos de prueba */}
        <section className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-500">
              Textos de prueba en vivo (edítalos para probar longitudes y mensajes)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-500">
                Título de Éxito
              </label>
              <input
                value={customSuccessTitle}
                onChange={(e) => setCustomSuccessTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-2.5 py-1.5 text-[12px] font-medium text-ink outline-none focus:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-brand-red/20"
              />
            </div>
            <div>
              <label className="block font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-500">
                Detalle de Éxito
              </label>
              <input
                value={customSuccessDetail}
                onChange={(e) => setCustomSuccessDetail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-2.5 py-1.5 text-[12px] font-medium text-ink outline-none focus:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-brand-red/20"
              />
            </div>
            <div>
              <label className="block font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-500">
                Título de Error
              </label>
              <input
                value={customErrorTitle}
                onChange={(e) => setCustomErrorTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-2.5 py-1.5 text-[12px] font-medium text-ink outline-none focus:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-brand-red/20"
              />
            </div>
            <div>
              <label className="block font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-500">
                Detalle de Error
              </label>
              <input
                value={customErrorDetail}
                onChange={(e) => setCustomErrorDetail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-2.5 py-1.5 text-[12px] font-medium text-ink outline-none focus:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-brand-red/20"
              />
            </div>
          </div>
        </section>

        {/* SECCIÓN 1: RECIBOS DE ACCIÓN (ReceiptStack - Esquina inferior derecha) */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-zinc-200/80 pb-2.5">
            <div>
              <span className="font-heading text-[10px] font-bold uppercase tracking-[0.09em] text-brand-red">
                1 · Notificaciones operativas (ReceiptStack)
              </span>
              <h2 className="font-heading text-[15px] font-bold text-ink">
                Recibos flotantes de esquina inferior derecha
              </h2>
              <p className="text-[12px] text-subtle">
                Se usan al archivar, eliminar, destacar, exportar, crear tickets/tareas o reportar fallos de red.
              </p>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              src/components/app/ReceiptStack.tsx
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* 1A: Éxito simple */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  1A · Éxito simple
                </span>
                <button
                  type="button"
                  onClick={() =>
                    receipts.done({
                      action: "lab-simple",
                      title: customSuccessTitle,
                      detail: customSuccessDetail,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                >
                  <Play className="size-3 text-brand-red" />
                  Probar en esquina
                </button>
              </div>
              <div className="flex w-full justify-center">
                <ReceiptCard
                  staticPreview
                  onDismiss={() => {}}
                  receipt={{
                    id: 101,
                    action: "archivar",
                    kind: "done",
                    title: customSuccessTitle,
                    detail: customSuccessDetail,
                    count: 1,
                  }}
                />
              </div>
            </div>

            {/* 1B: Éxito con Deshacer y barra de tiempo */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  1B · Éxito con «Deshacer»
                </span>
                <button
                  type="button"
                  onClick={() =>
                    receipts.done({
                      action: "lab-undo",
                      title: "Movido a la papelera",
                      detail: customSuccessDetail,
                      undo: {
                        label: "Deshacer",
                        run: () => {},
                      },
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                >
                  <Play className="size-3 text-brand-red" />
                  Probar en esquina
                </button>
              </div>
              <div className="flex w-full justify-center">
                <ReceiptCard
                  staticPreview
                  onDismiss={() => {}}
                  receipt={{
                    id: 102,
                    action: "papelera",
                    kind: "done",
                    title: "Movido a la papelera",
                    detail: customSuccessDetail,
                    count: 1,
                    action2: {
                      label: "Deshacer",
                      run: () => {},
                    },
                  }}
                />
              </div>
            </div>

            {/* 1C: Éxito agrupado (×3) */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  1C · Acciones agrupadas (×3)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    receipts.done({ action: "lab-batch", title: "Conversación destacada" });
                    receipts.done({ action: "lab-batch", title: "Conversación destacada" });
                    receipts.done({ action: "lab-batch", title: "Conversación destacada" });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                >
                  <Play className="size-3 text-brand-red" />
                  Probar en esquina
                </button>
              </div>
              <div className="flex w-full justify-center">
                <ReceiptCard
                  staticPreview
                  onDismiss={() => {}}
                  receipt={{
                    id: 103,
                    action: "destacar",
                    kind: "done",
                    title: "Conversación destacada",
                    count: 3,
                  }}
                />
              </div>
            </div>

            {/* 1D: Error simple */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  1D · Error / Fallo
                </span>
                <button
                  type="button"
                  onClick={() =>
                    receipts.failed({
                      action: "lab-error",
                      title: customErrorTitle,
                      detail: customErrorDetail,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                >
                  <Play className="size-3 text-brand-red" />
                  Probar en esquina
                </button>
              </div>
              <div className="flex w-full justify-center">
                <ReceiptCard
                  staticPreview
                  onDismiss={() => {}}
                  receipt={{
                    id: 104,
                    action: "enviar",
                    kind: "failed",
                    title: customErrorTitle,
                    detail: customErrorDetail,
                    count: 1,
                  }}
                />
              </div>
            </div>

            {/* 1E: Error con acción Reintentar */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-4 md:col-span-2 lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  1E · Error persistente con «Reintentar»
                </span>
                <button
                  type="button"
                  onClick={() =>
                    receipts.failed({
                      action: "lab-error-retry",
                      title: customErrorTitle,
                      detail: customErrorDetail,
                      undo: {
                        label: "Reintentar",
                        run: () => {},
                      },
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                >
                  <Play className="size-3 text-brand-red" />
                  Probar en esquina
                </button>
              </div>
              <div className="flex w-full justify-center">
                <ReceiptCard
                  staticPreview
                  onDismiss={() => {}}
                  receipt={{
                    id: 105,
                    action: "cargar",
                    kind: "failed",
                    title: customErrorTitle,
                    detail: customErrorDetail,
                    count: 1,
                    action2: {
                      label: "Reintentar",
                      run: () => {},
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: TOASTS SUPERIORES DEL SISTEMA (Toast.tsx & AuthToast.tsx) */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-zinc-200/80 pb-2.5">
            <div>
              <span className="font-heading text-[10px] font-bold uppercase tracking-[0.09em] text-brand-red">
                2 · Toasts flotantes superiores (Toast & AuthToast)
              </span>
              <h2 className="font-heading text-[15px] font-bold text-ink">
                Avisos flotantes centrados en la parte superior
              </h2>
              <p className="text-[12px] text-subtle">
                Se muestran en el borde superior central con barra de progreso inferior.
              </p>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              src/components/ui/Toast.tsx · src/components/auth/AuthToast.tsx
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* 2A: Toast Success */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  2A · Toast Éxito
                </span>
                <button
                  type="button"
                  onClick={() => setLiveToast({ message: customSuccessTitle, variant: "success" })}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                >
                  <Play className="size-3 text-brand-red" />
                  Disparar arriba
                </button>
              </div>
              <div className="flex justify-center">
                <ToastCard
                  staticPreview
                  variant="success"
                  message={customSuccessTitle}
                  onDismiss={() => {}}
                />
              </div>
            </div>

            {/* 2B: Toast Error */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  2B · Toast Error
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setLiveToast({
                      message: `${customErrorTitle}. ${customErrorDetail}`,
                      variant: "error",
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                >
                  <Play className="size-3 text-brand-red" />
                  Disparar arriba
                </button>
              </div>
              <div className="flex justify-center">
                <ToastCard
                  staticPreview
                  variant="error"
                  message={`${customErrorTitle}. ${customErrorDetail}`}
                  onDismiss={() => {}}
                />
              </div>
            </div>

            {/* 2C: Toast Info */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  2C · Toast Informativo
                </span>
                <button
                  type="button"
                  onClick={() => setLiveToast({ message: customInfoText, variant: "info" })}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                >
                  <Play className="size-3 text-brand-red" />
                  Disparar arriba
                </button>
              </div>
              <div className="flex justify-center">
                <ToastCard
                  staticPreview
                  variant="info"
                  message={customInfoText}
                  onDismiss={() => {}}
                />
              </div>
            </div>
          </div>

          {/* AuthToasts */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  2D · AuthToast (Éxito en Login / Contraseña)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setLiveAuthToast({
                      message: "Contraseña actualizada correctamente. Ya puedes iniciar sesión.",
                      variant: "success",
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                >
                  <Play className="size-3 text-brand-red" />
                  Disparar arriba
                </button>
              </div>
              <div className="flex justify-center">
                <AuthToastCard
                  staticPreview
                  variant="success"
                  message="Contraseña actualizada correctamente. Ya puedes iniciar sesión."
                  onDismiss={() => {}}
                />
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  2E · AuthToast (Error de credenciales)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setLiveAuthToast({
                      message: "Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.",
                      variant: "error",
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 cursor-pointer"
                >
                  <Play className="size-3 text-brand-red" />
                  Disparar arriba
                </button>
              </div>
              <div className="flex justify-center">
                <AuthToastCard
                  staticPreview
                  variant="error"
                  message="Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo."
                  onDismiss={() => {}}
                />
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 3: BANNERS / ALERTAS INLINE (Alert.tsx & AuthAlert.tsx) */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-zinc-200/80 pb-2.5">
            <div>
              <span className="font-heading text-[10px] font-bold uppercase tracking-[0.09em] text-brand-red">
                3 · Alertas integradas en paneles y modales (Alert)
              </span>
              <h2 className="font-heading text-[15px] font-bold text-ink">
                Banners de estado dentro de formularios, cajones y vistas
              </h2>
              <p className="text-[12px] text-subtle">
                Se utilizan para errores de validación, avisos de entrega de correo y confirmaciones dentro de modales.
              </p>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              src/components/ui/Alert.tsx · src/components/auth/AuthAlert.tsx
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200/90 bg-white p-5 shadow-2xs lg:grid-cols-3">
            <div className="space-y-2">
              <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-zinc-500">
                3A · Alert variant=&quot;success&quot;
              </span>
              <Alert variant="success">
                <strong>Cambios guardados:</strong> {customSuccessTitle} ({customSuccessDetail})
              </Alert>
            </div>

            <div className="space-y-2">
              <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-zinc-500">
                3B · Alert variant=&quot;error&quot;
              </span>
              <Alert variant="error">
                <strong>{customErrorTitle}:</strong> {customErrorDetail}
              </Alert>
            </div>

            <div className="space-y-2">
              <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-zinc-500">
                3C · Alert variant=&quot;info&quot;
              </span>
              <Alert variant="info">
                <span className="inline-flex items-center gap-1.5">
                  <span>{customInfoText}</span>
                </span>
              </Alert>
            </div>

            <div className="space-y-2 lg:col-span-3 pt-2 border-t border-zinc-100">
              <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-zinc-500">
                3D · AuthAlert (Éxito y Error en pantallas de acceso)
              </span>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <AuthAlert variant="success">
                  Te enviamos un enlace de recuperación a tu correo corporativo.
                </AuthAlert>
                <AuthAlert variant="error">
                  El enlace de restablecimiento ha expirado o ya fue utilizado.
                </AuthAlert>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 4: CAPA DE CONFIRMACIÓN DE ENVÍO DE CORREO E INDICADORES */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-zinc-200/80 pb-2.5">
            <div>
              <span className="font-heading text-[10px] font-bold uppercase tracking-[0.09em] text-brand-red">
                4 · Confirmación de envío de correo (ComposerSendSuccessLayer)
              </span>
              <h2 className="font-heading text-[15px] font-bold text-ink">
                Celebración al enviar, responder o reenviar un correo
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-zinc-200/90 bg-zinc-100/80 p-0.5">
                {(
                  [
                    { id: "compose", label: "Enviar" },
                    { id: "reply", label: "Responder" },
                    { id: "forward", label: "Reenviar" },
                    { id: "queued", label: "En cola" },
                  ] as const
                ).map((item) => {
                  const active = celebrationKind === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCelebrationKind(item.id);
                        setCelebrationKey((k) => k + 1);
                      }}
                      className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all cursor-pointer ${
                        active
                          ? "bg-white text-ink shadow-2xs"
                          : "text-subtle hover:text-ink"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCelebrationKey((k) => k + 1)}
              >
                <RotateCcw className="size-3.5" />
                Repetir animación
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs">
            <div key={celebrationKey} className="flex h-[280px] flex-col">
              <ComposerSendSuccessLayer
                kind={celebrationKind}
                title={
                  celebrationKind === "compose"
                    ? "Correo enviado correctamente"
                    : celebrationKind === "forward"
                      ? "Correo reenviado correctamente"
                      : celebrationKind === "queued"
                        ? "Guardado en la cola de salida"
                        : "Respuesta enviada correctamente"
                }
                detail={customSuccessDetail}
                attachmentsCount={celebrationKind === "forward" ? 2 : 1}
              />
            </div>
          </div>
        </section>

        {/* SECCIÓN 5: AVISOS EN TIEMPO REAL (SignalR / Escritorio / Sonido) */}
        <section className="space-y-4 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-zinc-200/80 pb-2.5">
            <div>
              <span className="font-heading text-[10px] font-bold uppercase tracking-[0.09em] text-brand-red">
                5 · Eventos en tiempo real (InboxAlerts & Notificaciones del sistema)
              </span>
              <h2 className="font-heading text-[15px] font-bold text-ink">
                Avisos de llegada de correo, asignaciones y alertas SLA
              </h2>
              <p className="text-[12px] text-subtle">
                Simula los 4 eventos en vivo que llegan por SignalR (sonido + notificación nativa del navegador).
              </p>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              src/lib/notifications.ts · src/components/app/InboxAlerts.tsx
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
                  <Mail className="size-4" />
                </span>
                <div>
                  <h3 className="font-heading text-[13px] font-bold text-ink">Correo nuevo</h3>
                  <p className="mt-0.5 text-[11.5px] text-subtle">
                    «Correo de cliente@empresa.com · Cotización urgente»
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full justify-center"
                onClick={async () => {
                  playChime(true);
                  await requestDesktop();
                  showArrival(
                    {
                      emailId: 1,
                      folder: "Inbox",
                      fromName: "Envases del Caribe",
                      fromEmail: "compras@envasescaribe.com",
                      subject: "Cotización urgente de cubetas 5 galones",
                      hasAttachments: true,
                    },
                    () => {},
                  );
                  receipts.done({
                    action: "sim-arrival",
                    title: "Correo de Envases del Caribe",
                    detail: "Cotización urgente de cubetas 5 galones · con adjuntos",
                  });
                }}
              >
                <Play className="size-3.5 text-brand-red" />
                Simular llegada
              </Button>
            </div>

            <div className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
                  <UserRoundCheck className="size-4" />
                </span>
                <div>
                  <h3 className="font-heading text-[13px] font-bold text-ink">Correo asignado</h3>
                  <p className="mt-0.5 text-[11.5px] text-subtle">
                    «Carlos Pérez te asignó un correo · De compras@empresa.com»
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full justify-center"
                onClick={async () => {
                  playChime(true);
                  await requestDesktop();
                  showAssignment(
                    {
                      emailId: 2,
                      assignedStaffId: 1,
                      fromName: "Distribuidora Nacional",
                      fromEmail: "pedidos@disnacional.do",
                      subject: "Consulta sobre despacho #4091",
                      assignedByName: "Carlos Pérez",
                    },
                    () => {},
                  );
                  receipts.done({
                    action: "sim-assign-mail",
                    title: "Carlos Pérez te asignó un correo",
                    detail: "De Distribuidora Nacional · Consulta sobre despacho #4091",
                  });
                }}
              >
                <Play className="size-3.5 text-brand-red" />
                Simular asignación
              </Button>
            </div>

            <div className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
                  <Ticket className="size-4" />
                </span>
                <div>
                  <h3 className="font-heading text-[13px] font-bold text-ink">Ticket asignado</h3>
                  <p className="mt-0.5 text-[11.5px] text-subtle">
                    «Te asignaron el ticket TK-1042 · Prioridad: Alta»
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full justify-center"
                onClick={async () => {
                  playChime(true);
                  await requestDesktop();
                  showTicketAssignment(
                    {
                      ticketId: 1042,
                      ticketNumber: "TK-1042",
                      assignedStaffId: 1,
                      subject: "Reclamación por lote de tapas",
                      priority: "Alta",
                      assignedByName: "Supervisión Calidad",
                    },
                    () => {},
                  );
                  receipts.done({
                    action: "sim-assign-ticket",
                    title: "Supervisión Calidad te asignó el ticket TK-1042",
                    detail: "Reclamación por lote de tapas · Prioridad: Alta",
                  });
                }}
              >
                <Play className="size-3.5 text-brand-red" />
                Simular ticket
              </Button>
            </div>

            <div className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
                  <Hourglass className="size-4" />
                </span>
                <div>
                  <h3 className="font-heading text-[13px] font-bold text-ink">Alerta de SLA</h3>
                  <p className="mt-0.5 text-[11.5px] text-subtle">
                    «SLA Incumplido o Próximo a vencer en ticket asignado»
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full justify-center"
                onClick={async () => {
                  playChime(true);
                  await requestDesktop();
                  showTicketSlaAlert(
                    {
                      ticketId: 1042,
                      ticketNumber: "TK-1042",
                      noticeType: "breach",
                      subject: "Reclamación por lote de tapas",
                      details: "Venció hace 15 min",
                    },
                    () => {},
                  );
                  receipts.failed({
                    action: "sim-sla",
                    title: "SLA Incumplido: TK-1042",
                    detail: "Reclamación por lote de tapas · Venció hace 15 min",
                  });
                }}
              >
                <Info className="size-3.5 text-brand-red" />
                Simular alerta SLA
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Portales en vivo cuando se pulsa "Disparar arriba" */}
      <Toast
        message={liveToast?.message ?? null}
        variant={liveToast?.variant ?? "info"}
        onDismiss={() => setLiveToast(null)}
      />
      <AuthToast
        message={liveAuthToast?.message ?? null}
        variant={liveAuthToast?.variant ?? "error"}
        onDismiss={() => setLiveAuthToast(null)}
      />
    </div>
  );
}
