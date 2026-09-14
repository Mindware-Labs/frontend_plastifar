import { createContext, useContext } from "react";
import type {
  ComposingPresence,
  EmailAssignment,
  EmailFolderCounts,
  InboxArrival,
  TicketAssignmentNotice,
  TicketNewMessageNotice,
  TicketSlaNotice,
  TicketStatusChangeNotice,
} from "../types/api";

export type Listener = () => void;
export type ArrivalListener = (arrival: InboxArrival) => void;
export type AssignmentListener = (assignment: EmailAssignment) => void;
export type ComposingListener = (presence: ComposingPresence) => void;
export type TicketAssignmentListener = (notice: TicketAssignmentNotice) => void;
export type TicketStatusChangeListener = (notice: TicketStatusChangeNotice) => void;
export type TicketNewMessageListener = (notice: TicketNewMessageNotice) => void;
export type TicketSlaListener = (notice: TicketSlaNotice) => void;

export interface EmailCountsValue {
  counts: EmailFolderCounts | null;
  refresh: () => void;
  /** Avisos del servidor cuando la bandeja cambia. Devuelve la baja de la suscripcion. */
  onInboxChanged: (listener: Listener) => () => void;
  /** Correo recibido, con remitente y asunto: para sonar o avisar en el escritorio. */
  onInboxReceived: (listener: ArrivalListener) => () => void;
  /** Le asignaron una conversacion a esta persona: para sonar o avisar en el escritorio. */
  onInboxAssigned: (listener: AssignmentListener) => () => void;
  /** Otra persona empezo o dejo de escribir en una conversacion. */
  onComposing: (listener: ComposingListener) => () => void;
  /** Avisa al resto que se esta escribiendo (o ya no) en esta conversacion. */
  setComposing: (emailId: number, active: boolean) => void;
  /** Quienes estan escribiendo ahora mismo en la conversacion. */
  whoIsComposing: (emailId: number) => Promise<ComposingPresence[]>;
  /** Avisos del servidor cuando la bandeja de tickets cambia. */
  onTicketsChanged: (listener: Listener) => () => void;
  /** Aviso de ticket asignado en tiempo real. */
  onTicketAssigned: (listener: TicketAssignmentListener) => () => void;
  /** Aviso de cambio de estado de un ticket. */
  onTicketStatusChanged: (listener: TicketStatusChangeListener) => () => void;
  /** Aviso de nuevo mensaje en un ticket. */
  onTicketNewMessage: (listener: TicketNewMessageListener) => () => void;
  /** Alerta de SLA (vencido o por vencer). */
  onTicketSlaAlert: (listener: TicketSlaListener) => () => void;
}

export const EmailCountsContext = createContext<EmailCountsValue>({
  counts: null,
  refresh: () => undefined,
  onInboxChanged: () => () => undefined,
  onInboxReceived: () => () => undefined,
  onInboxAssigned: () => () => undefined,
  onComposing: () => () => undefined,
  setComposing: () => undefined,
  whoIsComposing: () => Promise.resolve([]),
  onTicketsChanged: () => () => undefined,
  onTicketAssigned: () => () => undefined,
  onTicketStatusChanged: () => () => undefined,
  onTicketNewMessage: () => () => undefined,
  onTicketSlaAlert: () => () => undefined,
});

export function useEmailCounts() {
  return useContext(EmailCountsContext);
}
