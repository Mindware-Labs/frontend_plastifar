/** Carta horizontal a ~96 dpi (11 in). */
export const LANDSCAPE_SHEET_PX = 1056;
/** Carta vertical a ~96 dpi (8.5 in). */
export const PORTRAIT_SHEET_PX = 816;

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function horizontalPadding(el: HTMLElement): number {
  const s = getComputedStyle(el);
  return (parseFloat(s.paddingLeft) || 0) + (parseFloat(s.paddingRight) || 0);
}

/**
 * Convierte imágenes del lienzo original a data URLs en el clon para evitar
 * bloqueos de CORS, cargas diferidas o fallos dentro de SVG foreignObject.
 */
async function inlineImagesFromSource(sourceRoot: HTMLElement, targetRoot: HTMLElement): Promise<void> {
  const sourceImgs = Array.from(sourceRoot.querySelectorAll("img"));
  const targetImgs = Array.from(targetRoot.querySelectorAll("img"));

  await Promise.all(
    targetImgs.map(async (targetImg, index) => {
      const srcImg = sourceImgs[index] ?? targetImg;
      if (!srcImg.complete) {
        await new Promise<void>((resolve) => {
          srcImg.onload = () => resolve();
          srcImg.onerror = () => resolve();
        });
      }
      try {
        const w = srcImg.naturalWidth || srcImg.width;
        const h = srcImg.naturalHeight || srcImg.height;
        if (w > 0 && h > 0) {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.drawImage(srcImg, 0, 0, w, h);
            targetImg.src = c.toDataURL("image/png");
            targetImg.removeAttribute("srcset");
          }
        }
      } catch {
        // Conserva el src original si no se pudo serializar en canvas.
      }
      if (!targetImg.complete) {
        await new Promise<void>((resolve) => {
          targetImg.onload = () => resolve();
          targetImg.onerror = () => resolve();
        });
      }
    }),
  );
}

/**
 * Convierte cualquier color CSS moderno (como oklch / oklab de Tailwind v4)
 * a formato rgb/rgba estándar soportado por todos los motores de captura.
 */
function toStandardRgb(raw: string, ctx: CanvasRenderingContext2D, cache: Map<string, string>): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "transparent" || trimmed === "none" || trimmed === "currentcolor") {
    return trimmed;
  }
  if (
    /^(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i.test(trimmed) &&
    !trimmed.includes("okl") &&
    !trimmed.includes("color")
  ) {
    return trimmed;
  }
  const cached = cache.get(trimmed);
  if (cached) return cached;

  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000000";
  ctx.fillStyle = trimmed;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const result =
    a === 0
      ? "rgba(0, 0, 0, 0)"
      : a === 255
        ? `rgb(${r}, ${g}, ${b})`
        : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  cache.set(trimmed, result);
  return result;
}

/**
 * Normaliza en línea todos los colores computados del árbol clonado a rgb/rgba
 * para que ni html-to-image ni html2canvas fallen con funciones oklch/oklab.
 */
function normalizeColorsInSubtree(root: HTMLElement, doc: Document): void {
  const scratchCanvas = doc.createElement("canvas");
  scratchCanvas.width = 1;
  scratchCanvas.height = 1;
  const ctx = scratchCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const cache = new Map<string, string>();
  const win = doc.defaultView ?? window;

  if (doc.documentElement) {
    doc.documentElement.style.backgroundColor = "#ffffff";
    doc.documentElement.style.color = "#000000";
  }
  if (doc.body) {
    doc.body.style.backgroundColor = "#ffffff";
    doc.body.style.color = "#000000";
  }

  const nodes: HTMLElement[] = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of nodes) {
    const cs = win.getComputedStyle(el);
    el.style.color = toStandardRgb(cs.color, ctx, cache);
    el.style.backgroundColor = toStandardRgb(cs.backgroundColor, ctx, cache);
    el.style.borderTopColor = toStandardRgb(cs.borderTopColor, ctx, cache);
    el.style.borderRightColor = toStandardRgb(cs.borderRightColor, ctx, cache);
    el.style.borderBottomColor = toStandardRgb(cs.borderBottomColor, ctx, cache);
    el.style.borderLeftColor = toStandardRgb(cs.borderLeftColor, ctx, cache);
    el.style.textDecorationColor = toStandardRgb(cs.textDecorationColor, ctx, cache);
    el.style.webkitTextStrokeColor = toStandardRgb(cs.webkitTextStrokeColor, ctx, cache);
    el.style.outlineColor = "transparent";
    el.style.boxShadow = "none";
    el.style.textShadow = "none";
    if (cs.backgroundImage && (cs.backgroundImage.includes("okl") || cs.backgroundImage.includes("color-mix"))) {
      el.style.backgroundImage = "none";
    }
  }
}

/** Escala tablas que desbordan el ancho útil del lienzo para que nunca salgan cortadas. */
function fitTablesInSheet(root: HTMLElement): void {
  const innerW = root.clientWidth - horizontalPadding(root);
  if (innerW <= 0) return;

  root.querySelectorAll("table").forEach((node) => {
    if (!(node instanceof HTMLTableElement)) return;
    const sw = node.scrollWidth;
    if (sw <= innerW + 1) return;

    const scale = innerW / sw;
    node.style.transform = `scale(${scale})`;
    node.style.transformOrigin = "top left";
    node.style.width = `${sw}px`;
    const gap = node.getBoundingClientRect().height * (1 - scale);
    if (gap > 0) node.style.marginBottom = `${-gap}px`;
  });
}

function measureCaptureBounds(root: HTMLElement, sheetWidth: number): { width: number; height: number } {
  const rect = root.getBoundingClientRect();
  let maxBottom = rect.bottom;

  root.querySelectorAll("table, header, section, footer, div").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const r = node.getBoundingClientRect();
    maxBottom = Math.max(maxBottom, r.bottom);
  });

  return {
    width: sheetWidth,
    height: Math.ceil(Math.max(maxBottom - rect.top, root.scrollHeight, root.offsetHeight)),
  };
}

/**
 * Bloques del documento en px de la captura (relativos a su borde superior).
 * `group` son los `.avoid-break`: se mantienen enteros si caben en una página;
 * los demás (filas, párrafos, títulos) son átomos que nunca se parten.
 */
export interface CaptureBlock {
  top: number;
  bottom: number;
  group: boolean;
}

const ATOM_SELECTOR = "tr, p, li, h1, h2, h3, h4, h5, h6, dt, dd, img, svg";

function collectBlocks(root: HTMLElement): CaptureBlock[] {
  const rootTop = root.getBoundingClientRect().top;
  const blocks: CaptureBlock[] = [];
  const push = (el: Element, group: boolean) => {
    const r = el.getBoundingClientRect();
    if (r.height <= 0) return;
    blocks.push({ top: r.top - rootTop, bottom: r.bottom - rootTop, group });
  };
  root.querySelectorAll(".avoid-break").forEach((el) => push(el, true));
  root.querySelectorAll(ATOM_SELECTOR).forEach((el) => push(el, false));
  return blocks;
}

export interface CaptureResult {
  canvas: HTMLCanvasElement;
  /** Bloques ya escalados a píxeles del canvas. */
  blocks: CaptureBlock[];
}

/**
 * Captura completa del formulario oficial en un HTMLCanvasElement de alta resolución,
 * aislando el documento del layout de la aplicación (sidebar, contenedores con scroll
 * o márgenes automáticos) para que nunca salga cortado ni falle con colores oklch.
 */
export async function captureElementAsCanvas(
  element: HTMLElement,
  orientation: "portrait" | "landscape",
): Promise<CaptureResult> {
  const sheetWidth = orientation === "landscape" ? LANDSCAPE_SHEET_PX : PORTRAIT_SHEET_PX;

  const host = document.createElement("div");
  host.setAttribute("data-pdf-capture-host", "true");
  host.style.cssText = [
    "position: fixed",
    "left: 0",
    "top: 0",
    `width: ${sheetWidth}px`,
    "height: auto",
    "overflow: visible",
    "background: #ffffff",
    "opacity: 0",
    "pointer-events: none",
    "z-index: -9999",
  ].join(";");

  const workNode = element.cloneNode(true) as HTMLElement;
  workNode.setAttribute("data-pdf-capture", "true");
  workNode.style.cssText = [
    `width: ${sheetWidth}px`,
    `min-width: ${sheetWidth}px`,
    `max-width: ${sheetWidth}px`,
    "height: auto",
    "min-height: 0",
    "max-height: none",
    "margin: 0",
    "margin-left: 0",
    "margin-right: 0",
    "margin-top: 0",
    "margin-bottom: 0",
    "margin-inline: 0",
    "margin-block: 0",
    "padding: 20px",
    "box-sizing: border-box",
    "overflow: visible",
    "background: #ffffff",
    "color: #000000",
    "box-shadow: none",
    "border-radius: 0",
    "transform: none",
    "filter: none",
    "animation: none",
  ].join(";");

  host.appendChild(workNode);
  document.body.appendChild(host);

  try {
    await document.fonts.ready;
    await inlineImagesFromSource(element, workNode);
    await doubleRaf();

    fitTablesInSheet(workNode);
    await doubleRaf();

    normalizeColorsInSubtree(workNode, document);
    await doubleRaf();

    const { width: captureWidth, height: captureHeight } = measureCaptureBounds(workNode, sheetWidth);
    workNode.style.height = `${captureHeight}px`;
    await doubleRaf();
    const cssBlocks = collectBlocks(workNode);
    const withBlocks = (canvas: HTMLCanvasElement): CaptureResult => {
      const ratio = canvas.height / captureHeight;
      return {
        canvas,
        blocks: cssBlocks.map((block) => ({
          top: block.top * ratio,
          bottom: block.bottom * ratio,
          group: block.group,
        })),
      };
    };

    // 1. Intento primario con html-to-image (motor nativo SVG foreignObject del navegador)
    try {
      const { toCanvas, getFontEmbedCSS } = await import("html-to-image");
      let fontEmbedCSS = "";
      try {
        fontEmbedCSS = await getFontEmbedCSS(workNode);
      } catch {
        fontEmbedCSS = "";
      }

      const canvas = await toCanvas(workNode, {
        width: captureWidth,
        height: captureHeight,
        canvasWidth: captureWidth,
        canvasHeight: captureHeight,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: false,
        fontEmbedCSS,
        style: {
          margin: "0",
          marginLeft: "0",
          marginRight: "0",
          marginTop: "0",
          marginBottom: "0",
          marginInline: "0",
          marginBlock: "0",
          width: `${captureWidth}px`,
          minWidth: `${captureWidth}px`,
          maxWidth: `${captureWidth}px`,
          height: `${captureHeight}px`,
          boxSizing: "border-box",
          overflow: "visible",
          boxShadow: "none",
          borderRadius: "0",
          transform: "none",
        },
      });

      if (canvas && canvas.width > 0 && canvas.height > 0) {
        return withBlocks(canvas);
      }
    } catch (primaryErr) {
      console.warn("Fallback a html2canvas tras error en html-to-image:", primaryErr);
    }

    // 2. Respaldo con html2canvas sobre el árbol ya sanitizado a RGB
    const html2canvas = (await import("html2canvas")).default;
    const windowWidth = Math.max(captureWidth + 64, window.innerWidth, document.documentElement.clientWidth);
    const windowHeight = Math.max(captureHeight + 64, window.innerHeight);

    const fallbackCanvas = await html2canvas(workNode, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      width: captureWidth,
      height: captureHeight,
      windowWidth,
      windowHeight,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc, clonedEl) => {
        if (!(clonedEl instanceof HTMLElement)) return;
        let node: HTMLElement | null = clonedEl;
        while (node) {
          node.style.opacity = "1";
          node.style.overflow = "visible";
          node.style.maxWidth = "none";
          node = node.parentElement;
        }
        normalizeColorsInSubtree(clonedEl, clonedDoc);
      },
    });
    return withBlocks(fallbackCanvas);
  } finally {
    host.remove();
  }
}

