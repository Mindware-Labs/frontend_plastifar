import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

interface HeaderCountsProps<T> {
  /** Los contadores; mientras no llegan se muestra `loadingLabel`. */
  counts: T | null | undefined;
  loadingLabel: ReactNode;
  /** Las pastillas (HeaderTag). Se separan con «·»; las falsas se omiten. */
  children: (counts: T) => ReactNode;
}

/** Resumen de contadores bajo el titulo de un modulo (ModuleHeader `summary`). */
export function HeaderCounts<T>({ counts, loadingLabel, children }: HeaderCountsProps<T>) {
  if (counts == null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
        {loadingLabel}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
      {flatten(children(counts)).map((child, index) => (
        <Fragment key={isValidElement(child) ? child.key : index}>
          {index > 0 && <span aria-hidden className="text-zinc-300">·</span>}
          {child}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Las pastillas llegan dentro de un fragmento: se separan una a una. Cada una
 * conserva la clave de su posicion original (Children.toArray cuenta los huecos
 * de las condicionales), asi una pastilla que desaparece no hace que React
 * reutilice el boton de la siguiente.
 */
function flatten(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((child) =>
    isValidElement(child) && child.type === Fragment
      ? flatten((child as ReactElement<{ children?: ReactNode }>).props.children)
      : [child],
  );
}
