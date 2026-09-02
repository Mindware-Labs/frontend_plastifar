import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

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
      <div className="flex justify-center gap-2.5">
        {digits.map((digit, index) => (
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
            className={`h-12 w-12 shrink-0 rounded-edge border bg-white text-center font-heading text-lg font-semibold text-ink caret-brand-red outline-none transition-[border-color,box-shadow] duration-200 ease-out ${
              error
                ? "border-brand-red shadow-[0_0_0_4px_rgba(228,0,43,0.09)]"
                : "border-line hover:border-zinc-300 focus:border-brand-red focus:shadow-[0_0_0_4px_rgba(228,0,43,0.09)]"
            }`}
          />
        ))}
      </div>
      {error && <p className="mt-2 text-[13px] text-brand-red">{error}</p>}
    </div>
  );
}
