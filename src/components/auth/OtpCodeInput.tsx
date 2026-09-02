import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

interface OtpCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export function OtpCodeInput({
  length = 6,
  value,
  onChange,
  error,
  autoFocus,
}: OtpCodeInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const errorId = useId();
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(""));
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigit(index, digit);
    if (digit && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
        setDigit(index - 1, "");
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div>
      <div className="flex justify-center gap-1.5 sm:gap-2.5">
        {digits.map((digit, index) => {
          const stateClass = error
            ? "border-brand-red bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_4px_color-mix(in_srgb,var(--color-brand-red)_8%,transparent),0_6px_16px_-8px_color-mix(in_srgb,var(--color-brand-red)_35%,transparent)]"
            : `${digit ? "border-zinc-300" : "border-line"} hover:border-zinc-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_-1px_rgba(15,23,42,0.07)] focus:border-brand-red focus:bg-white focus:scale-[1.05] focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_4px_color-mix(in_srgb,var(--color-brand-red)_8%,transparent),0_6px_16px_-8px_color-mix(in_srgb,var(--color-brand-red)_35%,transparent)]`;

          return (
            <input
              key={index}
              ref={(el) => {
                inputsRef.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              autoFocus={autoFocus && index === 0}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              aria-label={`Dígito ${index + 1} de ${length} del código`}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              className={`h-10 w-10 shrink-0 rounded-edge border bg-gradient-to-b from-white to-zinc-50/70 text-center font-heading text-base font-semibold tabular-nums text-ink caret-brand-red shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out sm:h-12 sm:w-12 sm:text-lg ${stateClass}`}
            />
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-[13px] text-brand-red">
          {error}
        </p>
      )}
    </div>
  );
}
