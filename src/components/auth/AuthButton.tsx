import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/** primary: acción en rojo. ink: el envío no prosperó. success: entrando. */
export type AuthButtonTone = "primary" | "ink" | "success";

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  tone?: AuthButtonTone;
  /** Etiqueta que sustituye a children mientras tone no es primary. */
  toneLabel?: ReactNode;
}

const toneClass: Record<AuthButtonTone, string> = {
  primary:
    "bg-brand-red shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_rgba(228,0,43,0.25)] hover:bg-[#cb0026] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_20px_rgba(228,0,43,0.32)] disabled:hover:bg-brand-red",
  ink: "bg-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.12)] hover:bg-zinc-900 disabled:hover:bg-zinc-800",
  success:
    "bg-brand-green shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_rgba(0,124,57,0.25)] hover:bg-[#006e32] disabled:hover:bg-brand-green",
};

/** Botón principal de autenticación con estado de carga y confirmación integrados. */
export const AuthButton = forwardRef<HTMLButtonElement, AuthButtonProps>(function AuthButton(
  { isLoading = false, tone = "primary", toneLabel, disabled, className = "", children, ...props },
  ref,
) {
  const showTone = tone !== "primary" && toneLabel != null;
  const layer =
    "absolute inset-0 flex items-center justify-center gap-2 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-opacity";

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`relative flex h-12 w-full cursor-pointer items-center justify-center overflow-hidden
        rounded-xl font-heading text-[13.5px] sm:text-[14px] font-semibold text-white tracking-[-0.01em]
        transition-[background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        active:scale-[0.99]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red
        disabled:cursor-not-allowed disabled:opacity-85 disabled:shadow-none disabled:active:scale-100
        motion-reduce:active:scale-100
        ${toneClass[tone]} ${className}`}
      {...props}
    >
      <span className={`${layer} ${showTone ? "opacity-0 -translate-y-1.5 pointer-events-none" : "opacity-100 translate-y-0"}`}>
        {isLoading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
        <span>{children}</span>
      </span>
      <span
        aria-hidden={!showTone}
        className={`${layer} px-2 ${showTone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5 pointer-events-none"}`}
      >
        <span className="truncate">{toneLabel}</span>
      </span>
    </button>
  );
});
