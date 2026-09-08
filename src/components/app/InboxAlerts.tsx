import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEmailCounts } from "../../context/useEmailCounts";
import {
  playChime,
  readPrefs,
  showArrival,
  showAssignment,
  showTicketAssignment,
  showTicketSlaAlert,
} from "../../lib/notifications";

/**
 * Escucha los correos y tickets en vivo, y avisa segun las preferencias de la persona.
 * No pinta nada: vive en el layout para que el aviso llegue desde cualquier pagina.
 */
export function InboxAlerts() {
  const { onInboxReceived, onInboxAssigned, onTicketAssigned, onTicketSlaAlert } = useEmailCounts();
  const navigate = useNavigate();

  useEffect(
    () =>
      onInboxReceived((arrival) => {
        // Lo que cae en la papelera no merece un aviso.
        if (arrival.folder === "Trash") return;

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

  useEffect(
    () =>
      onTicketAssigned((notice) => {
        const prefs = readPrefs();
        if (prefs.sound) playChime();

        const away = document.visibilityState !== "visible" || !document.hasFocus();
        if (prefs.desktop && away) {
          showTicketAssignment(notice, () => {
            window.focus();
            navigate(`/tickets/${notice.ticketId}`);
          });
        }
      }),
    [onTicketAssigned, navigate],
  );

  useEffect(
    () =>
      onTicketSlaAlert((notice) => {
        const prefs = readPrefs();
        if (prefs.sound) playChime();

        const away = document.visibilityState !== "visible" || !document.hasFocus();
        if (prefs.desktop && away) {
          showTicketSlaAlert(notice, () => {
            window.focus();
            navigate(`/tickets/${notice.ticketId}`);
          });
        }
      }),
    [onTicketSlaAlert, navigate],
  );

  return null;
}
