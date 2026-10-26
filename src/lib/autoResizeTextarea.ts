/** Crece con el contenido; sin scroll interno si el contenedor lo permite. */
export function autoResizeTextarea(textarea: HTMLTextAreaElement | null, minHeightPx = 96): void {
  if (!textarea) return;
  textarea.style.height = "auto";
  const borderOffset = textarea.offsetHeight - textarea.clientHeight;
  textarea.style.height = `${Math.max(textarea.scrollHeight + borderOffset, minHeightPx)}px`;
}
