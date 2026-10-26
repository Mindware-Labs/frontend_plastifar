/**
 * Ajusta la altura del area de texto a su contenido, con un minimo en px.
 * Con `maxHeight` se detiene ahi y activa el scroll propio; sin el, crece sin limite
 * y no toca `overflowY`.
 */
export function autoResizeTextarea(
  textarea: HTMLTextAreaElement | null,
  minHeight: number,
  maxHeight?: number,
) {
  if (!textarea) return;
  textarea.style.height = "auto";
  const borderOffset = textarea.offsetHeight - textarea.clientHeight;
  const targetHeight = Math.max(textarea.scrollHeight + borderOffset, minHeight);
  if (maxHeight === undefined) {
    textarea.style.height = `${targetHeight}px`;
    return;
  }
  if (targetHeight >= maxHeight) {
    textarea.style.height = `${maxHeight}px`;
    textarea.style.overflowY = "auto";
  } else {
    textarea.style.height = `${targetHeight}px`;
    textarea.style.overflowY = "hidden";
  }
}
