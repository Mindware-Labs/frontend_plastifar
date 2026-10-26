import { z } from "zod";

const quantity = z
  .string()
  .trim()
  .refine(
    (value) =>
      value !== "" &&
      !Number.isNaN(Number(value)) &&
      Number(value) >= 1 &&
      Number.isInteger(Number(value)),
    "Indica un número entero mayor a 0",
  );

// Espejo de DiscrepancyRules.ValidateLines (docs/plan/06, sección 13).
export const lineSchema = z
  .object({
    productId: z.string().min(1, "Elige el producto"),
    invoiceRef: z
      .string()
      .trim()
      .min(1, "Indica la factura")
      .max(40, "Máximo 40 caracteres"),
    claimRef: z.string().trim().max(20, "Máximo 20 caracteres"),
    clientId: z.string(),
    discrepancyType: z.enum(["faltante", "sobrante"]),
    quantity: quantity,
    qualifies: z.enum(["", "si", "no"]),
    creditNoteNumber: z.string().trim().max(20, "Máximo 20 caracteres"),
    dispatcherName: z
      .string()
      .trim()
      .min(3, "Escribe el despachador: al menos 3 caracteres")
      .max(160, "Máximo 160 caracteres"),
    supervisorName: z.string().trim().max(160, "Máximo 160 caracteres"),
  })
  .superRefine((line, ctx) => {
    if (line.creditNoteNumber !== "" && line.qualifies !== "si") {
      ctx.addIssue({
        code: "custom",
        path: ["creditNoteNumber"],
        message: "Solo en una línea apta para nota de crédito",
      });
    }
  });

export const schema = z.object({
  ticketId: z.string().min(1, "Elige el ticket"),
  note: z.string().trim().max(4000, "Máximo 4000 caracteres"),
  lines: z.array(lineSchema).min(1, "Agrega al menos una línea"),
});

export type FormValues = z.infer<typeof schema>;
export type LineValues = FormValues["lines"][number];

export const emptyLine = (defaultClientId = "", defaultClaimRef = ""): LineValues => ({
  productId: "",
  invoiceRef: "",
  claimRef: defaultClaimRef,
  clientId: defaultClientId,
  discrepancyType: "faltante",
  quantity: "",
  qualifies: "",
  creditNoteNumber: "",
  dispatcherName: "",
  supervisorName: "",
});

export const DISCREPANCY_TYPE_OPTIONS = [
  { value: "faltante", label: "Faltante" },
  { value: "sobrante", label: "Sobrante" },
];

export const QUALIFIES_OPTIONS = [
  { value: "", label: "Sin decidir" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];

/** Lista oficial de los 9 puntos de seguridad de PF-FOR-291 */
export const SECURITY_ITEMS = [
  {
    itemNumber: 1,
    text: "No se pudo evidenciar video de vigilancia de la carga al momento de la investigación",
  },
  {
    itemNumber: 2,
    text: "El despachador no realizó la inspeccion previa de contenedor vacio antes de iniciar la carga de materiales.",
  },
  {
    itemNumber: 3,
    text: "El despachador no utiliza las herramientas de inspeccion (Martillo de Goma, Formato de Inspección).",
  },
  {
    itemNumber: 4,
    text: "No hay suficiente iluminacion al momento de realizar la inspeccion del contenedor y no se utilizo linterna en caso falta de iluminacion.",
  },
  {
    itemNumber: 5,
    text: "La carga es introducida al contenedor antes de realizar la inspeccion de seguridad.",
  },
  {
    itemNumber: 6,
    text: "Durante el proceso de carga se pudo evidenciar la manipulación de empaques para introducir materiales sospechas dentro del empaque?",
  },
  {
    itemNumber: 7,
    text: "Durante el proceso de carga se pudo evidenciar la presencia de personal ajeno a la carga o no autorizado?",
  },
  {
    itemNumber: 8,
    text: "Alguna persona de las que trabajaron en la carga de contenedor nunca salió del contenedor al finalizar la carga? Contrabando de personas",
  },
  {
    itemNumber: 9,
    text: "En caso de positivo en alguna de las anteriores preguntas se notifico a las Gerencias de Seguridad y Logística del evento?",
  },
];

/** Respuesta de un punto de seguridad mientras se llena el formulario. */
export type CheckChoice = "Positivo" | "Negativo" | "";
