import { useEffect, useState } from "react";
import { authApi } from "../api/auth";
import { authLockout } from "../lib/authLockout";

/** Segundos de bloqueo que faltan; con `sync` consulta al servidor al montar, así aparece el de la IP aunque se borre el almacenamiento o se cambie de equipo. */
export function useAuthLockout({ sync = false }: { sync?: boolean } = {}): number {
  const [remaining, setRemaining] = useState(() => authLockout.remainingSeconds());

  useEffect(() => authLockout.subscribe(() => setRemaining(authLockout.remainingSeconds())), []);

  const active = remaining > 0;
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      const next = authLockout.remainingSeconds();
      if (next <= 0) authLockout.clear();
      setRemaining(next);
    }, 500);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!sync) return;
    let cancelled = false;
    authApi
      .lockoutStatus({ email: authLockout.email() })
      .then((status) => {
        if (!cancelled) authLockout.syncFromServer(status.locked ? (status.retryAfterSeconds ?? 0) : 0);
      })
      .catch(() => {
        // Sin respuesta se conserva lo conocido: el servidor rechaza igual cada intento.
      });
    return () => {
      cancelled = true;
    };
  }, [sync]);

  return remaining;
}
