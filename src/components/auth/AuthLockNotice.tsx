import { authLockout, formatCountdown } from "../../lib/authLockout";
import { Alert } from "../ui/Alert";

/** Aviso del bloqueo con cuenta regresiva; al lector de pantalla se le da la hora de fin, no un numero que cambia cada segundo. */
export function AuthLockNotice({ seconds, className = "" }: { seconds: number; className?: string }) {
  const until = authLockout.until();
  const endsAt = until
    ? new Date(until).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Alert variant="error" className={`text-[13px] ${className}`}>
      <span className="font-semibold">Acceso bloqueado temporalmente.</span> Hubo demasiados intentos fallidos.
      Por seguridad, el inicio de sesión y la recuperación de contraseña quedan deshabilitados.{" "}
      <span aria-hidden>
        Podrás intentarlo de nuevo en{" "}
        <span className="font-semibold tabular-nums">{formatCountdown(seconds)}</span>.
      </span>
      {endsAt && <span className="sr-only">Podrás intentarlo de nuevo a las {endsAt}.</span>}
    </Alert>
  );
}
