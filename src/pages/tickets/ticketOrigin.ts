/** Identificador textual del mensaje inicial que originó el ticket. */
export function originLabel(channel: string): { label: string; hint: string } {
  return channel.toLowerCase() === "correo"
    ? {
        label: "Correo inicial",
        hint: "El ticket se creó a partir de este correo, recibido el",
      }
    : {
        label: "Solicitud inicial",
        hint: "Con esto se abrió el ticket, el",
      };
}

export const isEmailChannel = (channel: string) => channel.toLowerCase() === "correo";
