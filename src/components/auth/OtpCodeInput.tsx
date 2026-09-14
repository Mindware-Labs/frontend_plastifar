import { useId, useRef, type ClipboardEvent, type KeyboardEvent, type RefObject } from "react";
import { RelayRing } from "./RelayRing";
import { useFocusRelay } from "./useFocusRelay";

interface OtpCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** El código no fue aceptado: los seis dígitos se marcan por igual, sin señalar ninguno. */
  invalid?: boolean;
  /** El código fue aceptado: los dígitos confirman en cascada y dejan de editarse. */
  success?: boolean;
  autoFocus?: boolean;
  /** Control desde el que viaja el anillo de foco hasta los dígitos. */
  relayFrom?: RefObject<HTMLElement | null>;
  /** Cada cambio lanza el relevo: el anillo viaja y el primer dígito recibe el foco. */
  relayKey?: number;
}

export function OtpCodeInput({
  length = 6,
  value,
  onChange,
  error,
  invalid = false,
  success = false,
  autoFocus,
  relayFrom,
  relayKey,
}: OtpCodeInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const errorId = useId();
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  // El foco queda en el primer dígito para poder reescribir, pero sin resaltarlo ni seleccionarlo.
  const ringRef = useFocusRelay(relayFrom, relayKey, () => inputsRef.current[0]?.focus());

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
      <div className="flex justify-center">
        <div className="relative flex gap-1.5 sm:gap-2.5">
          {digits.map((digit, index) => {
            const stateClass = success
              ? "border-brand-green ring-3 ring-brand-green/10 text-brand-green animate-plf-otp-confirm"
              : error || invalid
                ? "border-brand-red ring-3 ring-brand-red/10"
                : `${digit ? "border-zinc-300" : "border-zinc-200"} hover:border-zinc-300 focus:border-brand-red focus:ring-3 focus:ring-brand-red/10`;

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
                readOnly={success}
                style={success ? { transitionDelay: `${index * 60}ms`, animationDelay: `${index * 60}ms` } : undefined}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                aria-label={`Dígito ${index + 1} de ${length} del código`}
                aria-invalid={!!error || invalid}
                aria-describedby={error ? errorId : undefined}
                className={`h-10 w-10 shrink-0 rounded-lg border bg-white text-center font-heading text-base font-semibold tabular-nums text-ink caret-brand-red outline-none transition-[border-color,box-shadow,color] duration-150 sm:h-12 sm:w-12 sm:text-lg ${stateClass}`}
              />
            );
          })}
          <RelayRing ringRef={ringRef} className="-inset-1.5 rounded-md" />
        </div>
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-[13px] text-brand-red">
          {error}
        </p>
      )}
    </div>
  );
}
