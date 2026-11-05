import { Check } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../../hooks/motion";
import { APPLE_LIST_ENTER_MS, APPLE_LIST_EXIT_MS } from "../../../hooks/useAppleListMotion";
import type { UpdateCategory } from "./ticketTransitions";

interface TicketUpdateStepNavProps {
  updateCategory: UpdateCategory | undefined;
  updateStep: 1 | 2 | 3;
  onStepClick: (step: 1 | 2 | 3) => void;
  onContinueFromStep1: () => void;
  onContinueToStep3: () => void;
}

function step2Copy(category: UpdateCategory | undefined) {
  if (category === "veredicto") {
    return { title: "Completar ticket", subtitle: "Elegir veredicto" };
  }
  if (category === "cancelar") {
    return { title: "Cancelar ticket", subtitle: "Motivo de cancelación" };
  }
  if (category === "pausar") {
    return { title: "Pausar ticket", subtitle: "Motivo de la pausa" };
  }
  return { title: "Confirmar", subtitle: "Motivo de reapertura" };
}

function StepPill({
  stepId,
  title,
  subtitle,
  isActive,
  isCompleted,
  onClick,
  labelMotionKey,
}: {
  stepId: 1 | 2 | 3;
  title: string;
  subtitle: string;
  isActive: boolean;
  isCompleted: boolean;
  onClick: () => void;
  labelMotionKey?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-[background-color,border-color,box-shadow,color,opacity] duration-200 ease-out ${
        isActive
          ? "bg-white shadow-2xs border border-zinc-200 text-zinc-900"
          : isCompleted
            ? "hover:bg-white/60 text-zinc-600 cursor-pointer"
            : "opacity-60 cursor-default text-zinc-500"
      }`}
    >
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold transition-colors duration-200 ease-out ${
          isActive
            ? "bg-brand-red text-white shadow-2xs"
            : isCompleted
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
              : "bg-zinc-200/80 text-zinc-500"
        }`}
      >
        {isCompleted ? <Check className="size-3.5" strokeWidth={2.5} /> : stepId}
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          key={labelMotionKey}
          className={labelMotionKey ? "animate-plf-apple-tab motion-reduce:animate-none" : undefined}
        >
          <p
            className={`font-heading text-[11.5px] font-bold leading-tight truncate ${isActive ? "text-zinc-900" : "text-zinc-600"}`}
          >
            {title}
          </p>
          <p className="text-[10px] text-zinc-400 leading-tight truncate hidden sm:block">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

/** Barra de pasos del dialogo Actualizar ticket: 2 o 3 pasos con transicion elástica al cambiar accion. */
export function TicketUpdateStepNav({
  updateCategory,
  updateStep,
  onStepClick,
  onContinueFromStep1,
  onContinueToStep3,
}: TicketUpdateStepNavProps) {
  const isVeredicto = updateCategory === "veredicto";
  const step2 = step2Copy(updateCategory);
  const [thirdVisible, setThirdVisible] = useState(isVeredicto);
  const [thirdMotion, setThirdMotion] = useState<"idle" | "in" | "out">("idle");
  const [shellReady, setShellReady] = useState(false);
  const thirdVisibleRef = useRef(thirdVisible);
  thirdVisibleRef.current = thirdVisible;

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setShellReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (isVeredicto) {
      setThirdVisible(true);
      if (!prefersReducedMotion()) {
        setThirdMotion("in");
        const enterDone = setTimeout(() => setThirdMotion("idle"), APPLE_LIST_ENTER_MS);
        return () => clearTimeout(enterDone);
      }
      setThirdMotion("idle");
      return;
    }

    if (!thirdVisibleRef.current) return;

    if (prefersReducedMotion()) {
      setThirdVisible(false);
      setThirdMotion("idle");
      return;
    }

    setThirdMotion("out");
    const hide = setTimeout(() => {
      setThirdVisible(false);
      setThirdMotion("idle");
    }, APPLE_LIST_EXIT_MS);
    return () => clearTimeout(hide);
  }, [isVeredicto]);

  const thirdInnerClass =
    thirdMotion === "in"
      ? "animate-plf-apple-row-in motion-reduce:animate-none"
      : thirdMotion === "out"
        ? "animate-plf-apple-row-out motion-reduce:animate-none"
        : "";

  return (
    <nav
      aria-label="Pasos de actualización de ticket"
      className="mb-4 flex gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 p-1"
    >
      <div className="min-w-0 flex-1">
        <StepPill
          stepId={1}
          title="Situación"
          subtitle="Seleccionar acción"
          isActive={updateStep === 1}
          isCompleted={updateStep > 1}
          onClick={() => {
            if (updateStep > 1) onStepClick(1);
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <StepPill
          stepId={2}
          title={step2.title}
          subtitle={step2.subtitle}
          isActive={updateStep === 2}
          isCompleted={updateStep > 2}
          labelMotionKey={updateCategory ?? "none"}
          onClick={() => {
            if (updateStep > 2) onStepClick(2);
            else if (updateStep === 1) onContinueFromStep1();
          }}
        />
      </div>

      <div
        className="plf-apple-col-shell min-w-0 flex-[1_1_0%]"
        data-collapsed={thirdVisible ? "false" : "true"}
        data-ready={shellReady ? "true" : "false"}
        aria-hidden={!thirdVisible}
      >
        <div className="plf-apple-row-clip">
          <div className={`min-w-[7.5rem] ${thirdInnerClass}`}>
            <StepPill
              stepId={3}
              title="Resolución"
              subtitle="Evidencias y notas"
              isActive={updateStep === 3}
              isCompleted={false}
              onClick={() => {
                if (updateStep === 2 && isVeredicto) onContinueToStep3();
                else if (updateStep > 3) onStepClick(3);
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
