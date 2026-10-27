import { ListTodo } from "lucide-react";

interface CreateTaskChipProps {
  active?: boolean;
  onCreate: () => void;
}

const rootClass =
  "group/chip relative inline-flex h-7 shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg border pl-1 pr-2.5 outline-none " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out " +
  "focus-visible:border-brand-red/40 focus-visible:ring-2 focus-visible:ring-brand-red/25 " +
  "active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";

/** Misma pastilla que «Crear ticket», para la acción hermana del correo. */
export function CreateTaskChip({ active = false, onCreate }: CreateTaskChipProps) {
  return (
    <button
      type="button"
      onClick={onCreate}
      data-active={active}
      className={`${rootClass} ${
        active
          ? "border-zinc-300 bg-zinc-100 text-zinc-900 shadow-none"
          : "border-zinc-200 bg-white text-zinc-700 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red transition-colors duration-200 group-hover/chip:bg-brand-red group-hover/chip:text-white"
      >
        <ListTodo className="size-3" strokeWidth={2.25} />
      </span>
      <span className="text-[12px] font-medium leading-none">Crear tarea</span>
    </button>
  );
}
