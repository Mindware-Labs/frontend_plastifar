import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = "", ...props },
  ref,
) {
  const inputId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={`rounded-lg border px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors
          placeholder:text-zinc-400 focus:border-brand-red focus:ring-2 focus:ring-brand-red/20
          ${error ? "border-brand-red" : "border-zinc-300"} ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs font-medium text-brand-red">
          {error}
        </p>
      )}
    </div>
  );
});
