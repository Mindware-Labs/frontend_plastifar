import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { qualityApi } from "../../api/quality";
import { Alert } from "../../components/ui/Alert";
import {
  LookupField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { FormSection } from "../../components/ui/FormSection";
import { Modal } from "../../components/ui/Modal";
import { formatBytes } from "../../lib/format";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import type { ActionPlanItem } from "../../types/quality";

// Espejo de la validacion del servidor de POST/PUT /api/quality/sheets/{id}/plan.
const schema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "Describe la acción: al menos 10 caracteres")
    .max(500, "Máximo 500 caracteres"),
  responsibleStaffId: z.string().min(1, "Elige quién responde por esta acción"),
  dueDate: z.string().min(1, "Indica la fecha comprometida"),
  evidenceNotes: z.string().trim().max(2000, "Máximo 2000 caracteres"),
});

type FormValues = z.infer<typeof schema>;

/** Los mismos límites que AttachmentPolicy en el servidor (docs/plan/05, pregunta 11). */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 10;

interface ActionPlanItemModalProps {
  sheetId: number;
  sheetNumber: string;
  /** Ausente = alta. */
  item?: ActionPlanItem;
  onClose: () => void;
  onSaved: (item: ActionPlanItem) => void;
}

/**
 * RF-Q4: agregar y editar acciones del plan. Marcar cumplida y anular son
 * acciones de fila, no campos de este formulario.
 *
 * RF-H4: la evidencia de implementación —texto y archivos— vive aquí. Una
 * acción ya resuelta solo admite completar su evidencia; el qué, quién y
 * cuándo quedan fijos.
 */
export function ActionPlanItemModal({
  sheetId,
  sheetNumber,
  item,
  onClose,
  onSaved,
}: ActionPlanItemModalProps) {
  const isEdit = item !== undefined;
  const settled = item !== undefined && (item.status === "Cumplida" || item.status === "Anulada");
  const [formError, setFormError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      description: item?.description ?? "",
      responsibleStaffId: item ? String(item.responsibleStaffId) : "",
      dueDate: item?.dueDate ?? "",
      evidenceNotes: item?.evidenceNotes ?? "",
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    setFileError(null);

    if (files.length + incoming.length > MAX_FILES) {
      setFileError(`No se pueden adjuntar más de ${MAX_FILES} archivos a la vez.`);
      return;
    }
    const tooBig = incoming.find((file) => file.size > MAX_FILE_BYTES);
    if (tooBig) {
      setFileError(`El archivo ${tooBig.name} excede los 10 MB.`);
      return;
    }
    const total = [...files, ...incoming].reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      setFileError("El tamaño total de los adjuntos excede los 25 MB.");
      return;
    }
    setFiles((current) => [...current, ...incoming]);
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const evidenceNotes = values.evidenceNotes.trim();
    const request = {
      description: values.description.trim(),
      responsibleStaffId: Number(values.responsibleStaffId),
      dueDate: values.dueDate,
      evidenceNotes: evidenceNotes === "" ? null : evidenceNotes,
    };

    try {
      let saved = isEdit
        ? await qualityApi.planItems.update(item.id, request)
        : await qualityApi.planItems.create(sheetId, request);

      // Los archivos van en una segunda llamada, como multipart. Si falla, la
      // acción ya quedó guardada: se dice y se deja el diálogo abierto.
      if (files.length > 0) {
        try {
          saved = await qualityApi.planItems.uploadEvidence(saved.id, files);
        } catch (err) {
          setFormError(
            (err instanceof ApiError ? err.message : "No se pudieron subir los archivos.") +
              " La acción sí quedó guardada; vuelve a intentar con los archivos.",
          );
          onSaved(saved);
          return;
        }
      }

      onSaved(saved);
      onClose();
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar la acción" : "No se pudo agregar la acción";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal
      title={isEdit ? (settled ? "Evidencia de la acción" : "Editar acción") : "Nueva acción del plan"}
      description={
        settled
          ? "La acción ya está resuelta: solo se completa su evidencia de implementación."
          : `Del plan de ${sheetNumber}. La hoja no se cierra mientras quede una acción sin resolver.`
      }
      onClose={onClose}
      maxWidth="max-w-xl"
      footer={
        <FormModalFooter
          formId="plan-item-form"
          isEdit={isEdit}
          createLabel="Agregar acción"
          isSubmitting={isSubmitting}
          onCancel={onClose}
        />
      }
    >
      <form
        id="plan-item-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormSection title="La acción" hint="Qué, quién y cuándo.">
        <TextAreaField
          label="Acción"
          required
          rows={3}
          placeholder="Qué se va a hacer para que no vuelva a ocurrir"
          disabled={settled}
          error={errors.description?.message}
          {...register("description")}
        />

        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="responsibleStaffId"
            control={control}
            render={({ field }) => (
              <LookupField
                label="Responsable"
                required
                name={field.name}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                onBlur={field.onBlur}
                placeholder="Elige uno"
                searchPlaceholder="Buscar responsable…"
                search={searchActiveStaff}
                resolveSelectedLabel={resolveStaffLabel}
                disabled={settled}
                state={stateOf("responsibleStaffId")}
                error={errors.responsibleStaffId?.message}
              />
            )}
          />

          <TextField
            label="Comprometida para"
            type="date"
            required
            disabled={settled}
            state={stateOf("dueDate")}
            error={errors.dueDate?.message}
            {...register("dueDate")}
          />
        </div>
        </FormSection>

        <FormSection title="Evidencia de la implementación" hint="Opcional para dar la acción por cumplida.">
          <TextAreaField
            label="Qué se hizo y cómo consta"
            rows={3}
            placeholder="Se cambió el molde el 20 de octubre; foto del molde nuevo adjunta"
            error={errors.evidenceNotes?.message}
            {...register("evidenceNotes")}
          />

          {isEdit && item.attachments.length > 0 && (
            <ul className="flex flex-col gap-1 text-[12.5px] text-brand-gray">
              {item.attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center gap-2">
                  <FileText aria-hidden className="h-3.5 w-3.5 shrink-0 text-faint" />
                  <span className="truncate">{attachment.fileName}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-faint">{formatBytes(attachment.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group flex h-[88px] w-full cursor-pointer flex-col items-center justify-center rounded-edge border-2 border-dashed border-line-strong bg-canvas/60 px-4 py-3 text-center outline-none transition-colors hover:border-brand-red/40 hover:bg-brand-red/5 focus-visible:ring-3 focus-visible:ring-brand-red/20"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-fill text-subtle transition-transform group-hover:scale-105">
                <Upload className="size-3.5" />
              </span>
              <span className="mt-1.5 font-heading text-[12px] font-semibold text-ink">Adjuntar archivos de evidencia</span>
              <span className="mt-0.5 text-[11px] text-faint">PDF, imágenes, documentos de oficina o comprimidos · hasta 10 MB por archivo</span>
            </button>

            {fileError && <p className="text-[12px] text-brand-red">{fileError}</p>}

            {files.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-edge border border-line bg-white px-2.5 py-1.5 text-[12px]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {file.type.startsWith("image/") ? (
                        <ImageIcon aria-hidden className="size-3.5 shrink-0 text-brand-red" />
                      ) : (
                        <FileText aria-hidden className="size-3.5 shrink-0 text-faint" />
                      )}
                      <span className="truncate font-medium text-ink" title={file.name}>
                        {file.name}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-faint">({formatBytes(file.size)})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      title="Quitar archivo"
                      aria-label={`Quitar ${file.name}`}
                      className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-faint hover:bg-fill hover:text-ink"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FormSection>
      </form>
    </Modal>
  );
}
