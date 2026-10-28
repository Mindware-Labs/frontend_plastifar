/** Crece con el contenido; sin scroll interno si el contenedor lo permite. */
export function autoResizeTextarea(textarea: HTMLTextAreaElement | null, minHeightPx = 96): void {
  if (!textarea) return;

  // Preservar la posición de scroll del contenedor padre si existe
  const scrollParent = textarea.closest(".overflow-y-auto") as HTMLElement | null;
  const prevScrollTop = scrollParent ? scrollParent.scrollTop : null;

  textarea.style.height = "auto";
  const borderOffset = textarea.offsetHeight - textarea.clientHeight;
  const targetHeight = Math.max(textarea.scrollHeight + borderOffset, minHeightPx);
  textarea.style.height = `${targetHeight}px`;

  // Si el cambio de alto temporal descolocó el scroll del modal, restaurarlo inmediatamente
  if (scrollParent && prevScrollTop !== null && scrollParent.scrollTop !== prevScrollTop) {
    scrollParent.scrollTop = prevScrollTop;
  }
}
