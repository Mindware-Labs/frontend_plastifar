import { Palette } from "lucide-react";
import { useState } from "react";
import { cannedCategoriesApi } from "../../api/canned";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField, TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type { CategoriaResponseItem } from "../../types/api";

const PRESET_COLORS: { value: string; label: string; dot: string; bg: string; text: string }[] = [
  { value: "indigo", label: "Índigo", dot: "bg-indigo-500", bg: "bg-indigo-50", text: "text-indigo-700" },
  { value: "blue", label: "Azul", dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  { value: "emerald", label: "Esmeralda", dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  { value: "amber", label: "Ámbar", dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  { value: "teal", label: "Teal", dot: "bg-teal-500", bg: "bg-teal-50", text: "text-teal-700" },
  { value: "zinc", label: "Neutro", dot: "bg-zinc-400", bg: "bg-zinc-100", text: "text-zinc-700" },
];

interface CategoriaModalProps {
  category?: CategoriaResponseItem;
  onClose: () => void;
  onSaved: () => void;
}

export function CategoriaModal({ category, onClose, onSaved }: CategoriaModalProps) {
  const isEdit = category !== undefined;
  const { isExiting, requestClose } = useModalAnimation();

  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [color, setColor] = useState(category?.color ?? "indigo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanName = name.trim();
    const cleanDesc = description.trim();

    if (!cleanName) {
      setFormError("Ingresa un nombre para la categoría.");
      return;
    }
    if (cleanName.length > 60) {
      setFormError("El nombre no puede superar 60 caracteres.");
      return;
    }
    if (cleanDesc.length > 200) {
      setFormError("La descripción no puede superar 200 caracteres.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await cannedCategoriesApi.update(category.id, {
          name: cleanName,
          description: cleanDesc || null,
          color,
        });
      } else {
        await cannedCategoriesApi.create({
          name: cleanName,
          description: cleanDesc || null,
          color,
        });
      }
      onSaved();
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la categoría");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Atajo Ctrl+Enter para guardar
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  }

  const selectedColorOption = PRESET_COLORS.find((c) => c.value === color) ?? PRESET_COLORS[0];

  return (
    <Modal
      title={isEdit ? "Editar categoría" : "Nueva categoría"}
      eyebrow="Correo · Catálogo de respuestas"
      description="Organiza las respuestas rápidas y plantillas en categorías operativas."
      maxWidth="max-w-xl"
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Enter
            </kbd>
            <span className="ml-0.5">para guardar</span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={() => handleSubmit()} isLoading={isSubmitting}>
              {isEdit ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate className="flex flex-col gap-4 text-left">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div>
          <TextField
            size="sm"
            label="Nombre de la categoría"
            placeholder="Ej. Logística y Envíos, Cobros, Garantías..."
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Selector de color de distintivo */}
        <div className="flex flex-col gap-1.5">
          <label className="font-heading text-[11.5px] font-semibold text-faint flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-zinc-400" />
            <span>Color del distintivo</span>
          </label>
          <div className="grid grid-cols-6 gap-1.5 pt-0.5">
            {PRESET_COLORS.map((c) => {
              const isSelected = color === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  className={`flex w-full min-w-0 items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? `${c.bg} ${c.text} border-zinc-400/80 ring-2 ring-brand-red/20 shadow-2xs font-semibold`
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <span className={`size-2 shrink-0 rounded-full ${c.dot}`} />
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <TextAreaField
            label="Descripción (opcional)"
            placeholder="Breve explicación de los tipos de plantillas incluidas en esta categoría..."
            maxLength={200}
            autoGrow
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-zinc-200/80 bg-zinc-50/60 px-3 py-2">
          <span className="shrink-0 font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
            Vista previa
          </span>
          <span
            className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-zinc-200 px-2 py-0.5 text-[11.5px] font-semibold ${selectedColorOption.bg} ${selectedColorOption.text}`}
          >
            <span className={`size-1.5 shrink-0 rounded-full ${selectedColorOption.dot}`} />
            <span className="truncate">{name.trim() || "Nombre de categoría"}</span>
          </span>
        </div>
      </form>
    </Modal>
  );
}
