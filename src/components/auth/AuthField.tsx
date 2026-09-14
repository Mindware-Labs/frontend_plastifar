import { CircleAlert, Eye, EyeOff } from "lucide-react";
import {
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ForwardedRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { RelayRing } from "./RelayRing";
import { useFocusRelay } from "./useFocusRelay";

interface AuthFieldBaseProps {
  /** Nombre del campo: etiqueta visible y accesible */
  label: string;
  icon: ReactNode;
  error?: string;
  hasError?: boolean;
  action?: ReactNode;
  hint?: string;
  /** Mensaje que ocupa el lugar de action en la etiqueta mientras el envío no prospera. */
  notice?: ReactNode;
  /** Control desde el que viaja el anillo de foco hasta este campo. */
  relayFrom?: RefObject<HTMLElement | null>;
  /** Cada cambio lanza el relevo: el anillo viaja y el campo recibe el foco con el texto seleccionado. */
  relayKey?: number;
}

interface AuthFieldProps extends AuthFieldBaseProps, InputHTMLAttributes<HTMLInputElement> {}

interface AuthPasswordFieldProps
  extends AuthFieldBaseProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {}

const boxClass = (invalid: boolean) =>
  `group relative flex h-10 w-full items-center rounded-lg border bg-white px-3 transition-all duration-150 ${
    invalid
      ? "border-brand-red ring-3 ring-brand-red/10"
      : "border-zinc-200 hover:border-zinc-300 focus-within:border-brand-red focus-within:ring-3 focus-within:ring-brand-red/10"
  }`;

const iconClass = (invalid: boolean) =>
  `mr-2.5 shrink-0 transition-colors ${
    invalid ? "text-brand-red" : "text-zinc-400 group-focus-within:text-brand-red"
  }`;

/** Ref local para enfocar desde el relevo; la del formulario recibe el mismo elemento. */
function useMergedRef<T>(forwarded: ForwardedRef<T>) {
  const local = useRef<T | null>(null);
  useImperativeHandle(forwarded, () => local.current as T, []);
  return local;
}

/** Al posarse el anillo, el campo recibe el foco con el texto seleccionado: escribir reemplaza. */
function useFieldRelay(
  inputRef: RefObject<HTMLInputElement | null>,
  relayFrom: RefObject<HTMLElement | null> | undefined,
  relayKey: number | undefined,
) {
  return useFocusRelay(relayFrom, relayKey, () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });
}

interface LabelRowProps {
  inputId: string;
  label: string;
  action?: ReactNode;
  message?: ReactNode;
  messageId: string;
}

/** Fila de etiqueta de altura fija: el mensaje sustituye a la acción con un fundido, sin mover nada. */
function LabelRow({ inputId, label, action, message, messageId }: LabelRowProps) {
  const hasMessage = message != null;
  const layer =
    "absolute inset-y-0 right-0 flex items-center whitespace-nowrap transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-opacity";

  return (
    <div className="mb-2 flex h-[18px] items-center justify-between gap-2">
      <label
        htmlFor={inputId}
        className="shrink-0 text-[12px] font-semibold text-zinc-700 tracking-[-0.01em]"
      >
        {label}
      </label>
      {(action != null || hasMessage) && (
        <div className="relative h-full min-w-0 flex-1">
          {action != null && (
            <span
              inert={hasMessage}
              className={`${layer} ${hasMessage ? "opacity-0 -translate-y-1 motion-reduce:translate-y-0" : ""}`}
            >
              {action}
            </span>
          )}
          <span
            id={messageId}
            inert={!hasMessage}
            className={`${layer} text-[12px] font-semibold text-ink ${
              hasMessage ? "" : "opacity-0 translate-y-1 motion-reduce:translate-y-0"
            }`}
          >
            {message}
          </span>
        </div>
      )}
    </div>
  );
}

function CapsLockNotice() {
  return (
    <span className="flex items-center gap-1.5 font-medium text-amber-600">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Bloq Mayús activado
    </span>
  );
}

function ErrorLine({ id, error }: { id: string; error: string }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-brand-red">
      <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {error}
    </p>
  );
}

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  {
    label,
    icon,
    error,
    hasError,
    action,
    hint,
    notice,
    relayFrom,
    relayKey,
    id,
    className = "",
    placeholder,
    ...props
  },
  ref,
) {
  const fallbackId = useId();
  const inputId = id ?? props.name ?? fallbackId;
  const errorId = `${inputId}-error`;
  const noticeId = `${inputId}-notice`;
  const isInvalid = Boolean(error || hasError);
  const inputRef = useMergedRef(ref);
  const ringRef = useFieldRelay(inputRef, relayFrom, relayKey);

  return (
    <div className="flex flex-col">
      <LabelRow inputId={inputId} label={label} action={action} message={notice} messageId={noticeId} />

      <div className={boxClass(isInvalid)}>
        <span className={iconClass(isInvalid)}>{icon}</span>

        <input
          ref={inputRef}
          id={inputId}
          placeholder={placeholder ?? label}
          className={`h-full w-full min-w-0 bg-transparent text-[13.5px] font-normal text-zinc-900 placeholder:text-zinc-400 placeholder:font-normal outline-none ${className}`}
          aria-invalid={isInvalid || notice != null}
          aria-describedby={error ? errorId : notice != null ? noticeId : undefined}
          {...props}
        />

        <RelayRing ringRef={ringRef} />
      </div>

      {error && <ErrorLine id={errorId} error={error} />}

      {hint && !error && <span className="mt-1.5 text-[11.5px] text-zinc-500">{hint}</span>}
    </div>
  );
});

export const AuthPasswordField = forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  function AuthPasswordField(
    {
      label,
      icon,
      error,
      hasError,
      action,
      hint,
      notice,
      relayFrom,
      relayKey,
      id,
      className = "",
      placeholder,
      ...props
    },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const fallbackId = useId();
    const inputId = id ?? props.name ?? fallbackId;
    const errorId = `${inputId}-error`;
    const noticeId = `${inputId}-notice`;
    const isInvalid = Boolean(error || hasError);
    const inputRef = useMergedRef(ref);
    const ringRef = useFieldRelay(inputRef, relayFrom, relayKey);

    function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
      setCapsLock(event.getModifierState?.("CapsLock") ?? false);
    }

    return (
      <div className="flex flex-col">
        <LabelRow
          inputId={inputId}
          label={label}
          action={action}
          message={capsLock ? <CapsLockNotice /> : notice}
          messageId={noticeId}
        />

        <div className={boxClass(isInvalid)}>
          <span className={iconClass(isInvalid)}>{icon}</span>

          <input
            ref={inputRef}
            id={inputId}
            type={visible ? "text" : "password"}
            placeholder={placeholder ?? label}
            className={`h-full w-full min-w-0 bg-transparent text-[13.5px] font-normal text-zinc-900 placeholder:text-zinc-400 placeholder:font-normal outline-none ${
              visible ? "" : "tracking-[0.14em]"
            } ${className}`}
            aria-invalid={isInvalid || notice != null}
            aria-describedby={error ? errorId : notice != null ? noticeId : undefined}
            {...props}
            onKeyDown={(event) => {
              trackCapsLock(event);
              props.onKeyDown?.(event);
            }}
            onKeyUp={(event) => {
              trackCapsLock(event);
              props.onKeyUp?.(event);
            }}
            onBlur={(event) => {
              setCapsLock(false);
              props.onBlur?.(event);
            }}
          />

          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="ml-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>

          <RelayRing ringRef={ringRef} />
        </div>

        {error && <ErrorLine id={errorId} error={error} />}

        {hint && !error && <span className="mt-1.5 text-[11.5px] text-zinc-500">{hint}</span>}
      </div>
    );
  },
);
