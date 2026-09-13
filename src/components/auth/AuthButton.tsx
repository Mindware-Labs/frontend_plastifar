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
    "bg-brand-red shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.06)] hover:bg-[#b0102b] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_5px_rgba(196,18,48,0.25)] disabled:hover:bg-brand-red",
  ink: "bg-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-ink disabled:hover:bg-ink",
  success: "bg-brand-green shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-brand-green disabled:hover:bg-brand-green",
};

/** Botón principal de autenticación con estado de carga y confirmación integrados. */
export const AuthButton = forwardRef<HTMLButtonElement, AuthButtonProps>(function AuthButton(
  { isLoading = false, tone = "primary", toneLabel, disabled, className = "", children, ...props },
  ref,
) {
  const showTone = tone !== "primary" && toneLabel != null;
  const layer =
    "absolute inset-0 flex items-center justify-center gap-2 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-opacity";

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`relative flex h-10 w-full cursor-pointer items-center justify-center overflow-hidden
        rounded-lg font-heading text-[13.5px] font-semibold text-white
        transition-[background-color,box-shadow,transform] duration-200 ease-out
        active:scale-[0.99]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red
        disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:scale-100
        motion-reduce:active:scale-100
        ${toneClass[tone]} ${className}`}
      {...props}
    >
      <span className={`${layer} ${showTone ? "opacity-0 -translate-y-2 motion-reduce:translate-y-0" : ""}`}>
        {isLoading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
        <span>{children}</span>
      </span>
      <span
        aria-hidden={!showTone}
        className={`${layer} ${showTone ? "" : "opacity-0 translate-y-2 motion-reduce:translate-y-0"}`}
      >
        <span>{toneLabel}</span>
      </span>
    </button>
  );
});
