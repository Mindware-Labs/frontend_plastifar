import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEmailCounts } from "../../context/useEmailCounts";
import { playChime, readPrefs, showArrival, showAssignment } from "../../lib/notifications";

/**
 * Escucha los correos que entran y las conversaciones que le asignan a esta
 * persona, y avisa segun su preferencia. No pinta nada: vive en el layout
 * para que el aviso llegue desde cualquier pagina.
 */
export function InboxAlerts() {
  const { onInboxReceived, onInboxAssigned } = useEmailCounts();
  const navigate = useNavigate();

  useEffect(
    () =>
      onInboxReceived((arrival) => {
        // Lo que cae en No deseado no merece un aviso.
        if (arrival.folder === "Junk") return;

        const prefs = readPrefs();
        if (prefs.sound) playChime();

        // Con la pestana a la vista el aviso del sistema estorba: la bandeja ya se refresca sola.
        const away = document.visibilityState !== "visible" || !document.hasFocus();
        if (prefs.desktop && away) {
          showArrival(arrival, () => {
            window.focus();
            navigate(`/bandeja?correo=${arrival.emailId}`);
          });
        }
      }),
    [onInboxReceived, navigate],
  );

  useEffect(
    () =>
      onInboxAssigned((assignment) => {
        const prefs = readPrefs();
        if (prefs.sound) playChime();

        const away = document.visibilityState !== "visible" || !document.hasFocus();
        if (prefs.desktop && away) {
          showAssignment(assignment, () => {
            window.focus();
            navigate(`/bandeja?correo=${assignment.emailId}`);
          });
        }
      }),
    [onInboxAssigned, navigate],
  );

  return null;
}
