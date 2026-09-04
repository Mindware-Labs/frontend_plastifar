import { ChevronDown, ChevronUp, Maximize, RotateCw, Search, ZoomIn, ZoomOut } from "lucide-react";
import { GlobalWorkerOptions, TextLayer, getDocument } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "../../components/ui/Spinner";
import { findRanges, revealRange } from "./pdfSearch";
import { dividerClass, iconButtonClass } from "./toolbarStyles";
import "./pdfTextLayer.css";

GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfViewerProps {
  url: string;
  /** Hueco de la barra del modal donde se dibujan zoom, paginas y giro. */
  toolbarSlot: HTMLElement | null;
  /** El bucket no dejó leer el archivo: el modal vuelve al visor del navegador. */
  onUnavailable: () => void;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

/** Aire alrededor del papel al calcular el ajuste, el mismo relleno que lleva la pila de paginas. */
const SIDE_MARGIN = 16;
const STACK_MARGIN = 40;

const MATCH_HIGHLIGHT = "pdf-match";
const ACTIVE_HIGHLIGHT = "pdf-match-active";

/** Sin la API de resaltado no hay forma de marcar el hallazgo: el buscador no se ofrece. */
const canHighlight = typeof CSS !== "undefined" && "highlights" in CSS;

function PdfPage({
  doc,
  pageNumber,
  scale,
  rotation,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;
    let textLayer: TextLayer | null = null;

    void doc.getPage(pageNumber).then((page) => {
      const canvas = canvasRef.current;
      const textContainer = textRef.current;
      if (cancelled || !canvas || !textContainer) return;

      const spin = (page.rotate + rotation) % 360;
      const viewport = page.getViewport({ scale, rotation: spin });

      // El lienzo se dibuja a la densidad real de la pantalla y se muestra en pixeles CSS.
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      task = page.render({
        canvas,
        viewport: page.getViewport({ scale: scale * ratio, rotation: spin }),
      });
      task.promise.catch(() => undefined);

      // Los renglones se posicionan en pixeles CSS: la capa lee la escala de esta variable.
      textContainer.replaceChildren();
      textContainer.style.setProperty("--total-scale-factor", String(scale));

      textLayer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: textContainer,
        viewport,
      });
      textLayer.render().catch(() => undefined);
    });

    return () => {
      cancelled = true;
      task?.cancel();
      textLayer?.cancel();
    };
  }, [doc, pageNumber, scale, rotation]);

  return (
    <div data-page={pageNumber} className="relative shadow-[0_2px_10px_-4px_rgba(27,27,29,0.35)]">
      <canvas ref={canvasRef} className="block bg-white" />
      <div ref={textRef} className="textLayer" />
    </div>
  );
}

export function PdfViewer({ url, toolbarSlot, onUnavailable }: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [base, setBase] = useState({ width: 0, height: 0 });
  const [viewer, setViewer] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<"fit" | number>(1);
  const [zoomDraft, setZoomDraft] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<{ ranges: Range[]; index: number }>({
    ranges: [],
    index: 0,
  });
  const [textVersion, setTextVersion] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const zoomRef = useRef<HTMLInputElement>(null);
  const editingZoom = zoomDraft !== null;

  const unavailableRef = useRef(onUnavailable);
  useEffect(() => {
    unavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    let cancelled = false;
    const task = getDocument({ url });

    task.promise
      .then((loaded) => {
        if (!cancelled) setDoc(loaded);
      })
      .catch(() => {
        if (!cancelled) unavailableRef.current();
      });

    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [url]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) =>
      setViewer({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    // Las capas de texto llegan pagina por pagina: se espera a que la tanda se asiente.
    let timer = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTextVersion((current) => current + 1), 120);
    });

    observer.observe(element, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!canHighlight) return;
    const element = scrollRef.current;
    const ranges = element ? findRanges(element, query) : [];

    CSS.highlights.set(MATCH_HIGHLIGHT, new Highlight(...ranges));
    // oxlint-disable-next-line react/set-state-in-effect
    setMatches({ ranges, index: 0 });

    return () => {
      CSS.highlights.delete(MATCH_HIGHLIGHT);
    };
  }, [query, textVersion]);

  useEffect(() => {
    if (!canHighlight) return;
    const active = matches.ranges[matches.index];

    if (!active) {
      CSS.highlights.delete(ACTIVE_HIGHLIGHT);
      return;
    }

    CSS.highlights.set(ACTIVE_HIGHLIGHT, new Highlight(active));
    if (scrollRef.current) revealRange(active, scrollRef.current);

    return () => {
      CSS.highlights.delete(ACTIVE_HIGHLIGHT);
    };
  }, [matches]);

  useEffect(() => {
    if (editingZoom) zoomRef.current?.select();
  }, [editingZoom]);

  // El atajo de siempre abre nuestro buscador, no el del navegador, que no ve el lienzo.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      searchRef.current?.select();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;

    void doc.getPage(1).then((first) => {
      if (cancelled) return;
      const { width, height } = first.getViewport({
        scale: 1,
        rotation: (first.rotate + rotation) % 360,
      });
      setBase({ width, height });
    });

    return () => {
      cancelled = true;
    };
  }, [doc, rotation]);

  // La primera pagina entra entera: manda el lado que primero se queda sin sitio.
  const fitScale =
    base.width > 0
      ? Math.min(
          (viewer.width - SIDE_MARGIN) / base.width,
          (viewer.height - STACK_MARGIN) / base.height,
        )
      : 0;
  const scale = zoom === "fit" ? fitScale : zoom;
  const ready = doc !== null && scale > 0;

  function applyZoom(value: number) {
    setZoom(Math.min(Math.max(value, MIN_SCALE), MAX_SCALE));
  }

  function commitZoomDraft() {
    const typed = Number(zoomDraft);
    if (Number.isFinite(typed) && typed > 0) applyZoom(typed / 100);
    setZoomDraft(null);
  }

  function stepMatch(direction: number) {
    setMatches((previous) => {
      const total = previous.ranges.length;
      if (total === 0) return previous;
      return { ...previous, index: (previous.index + direction + total) % total };
    });
  }

  function goToPage(target: number) {
    scrollRef.current
      ?.querySelector(`[data-page="${target}"]`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  // La pagina visible es la ultima cuyo borde superior ya paso por el del visor.
  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;

    const limit = element.getBoundingClientRect().top + 80;
    const pages = Array.from(element.querySelectorAll<HTMLElement>("[data-page]"));
    const visible = pages.findLast((item) => item.getBoundingClientRect().top <= limit);
    setPage(Number(visible?.dataset.page ?? 1));
  }

  return (
    <>
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-auto">
        {ready ? (
          <div className="flex flex-col items-center gap-3 py-5">
            {Array.from({ length: doc.numPages }, (_, position) => (
              <PdfPage
                key={position + 1}
                doc={doc}
                pageNumber={position + 1}
                scale={scale}
                rotation={rotation}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        )}
      </div>

      {ready &&
        toolbarSlot &&
        createPortal(
          <>
            {canHighlight && (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5
                    -translate-y-1/2 text-faint"
                />
                <input
                  ref={searchRef}
                  value={query}
                  data-skip-autofocus
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    stepMatch(event.shiftKey ? -1 : 1);
                  }}
                  placeholder="Buscar"
                  title="Buscar en el documento (Enter para el siguiente)"
                  className="h-7 w-44 rounded-edge border border-line bg-canvas pl-7 pr-12
                    text-[12px] text-ink outline-none transition-colors placeholder:text-faint
                    focus:border-brand-red/40 focus:bg-white focus:ring-3 focus:ring-brand-red/12"
                />
                {query.trim() !== "" && (
                  <span
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px]
                      font-medium text-subtle"
                  >
                    {matches.ranges.length === 0 ? "0" : `${matches.index + 1}/${matches.ranges.length}`}
                  </span>
                )}
              </div>
            )}

            {canHighlight && <span aria-hidden className={dividerClass} />}

            <button
              type="button"
              onClick={() => applyZoom(scale / 1.2)}
              disabled={scale <= MIN_SCALE}
              aria-label="Alejar"
              title="Alejar"
              className={iconButtonClass}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            {editingZoom ? (
              <input
                ref={zoomRef}
                value={zoomDraft}
                inputMode="numeric"
                data-skip-autofocus
                aria-label="Zoom en porcentaje"
                onChange={(event) => setZoomDraft(event.target.value.replace(/[^0-9]/g, ""))}
                onBlur={commitZoomDraft}
                onKeyDown={(event) => {
                  // El dialogo cierra con Escape: mientras se escribe, la tecla solo cancela.
                  event.stopPropagation();
                  if (event.key === "Enter") commitZoomDraft();
                  if (event.key === "Escape") setZoomDraft(null);
                }}
                className="h-7 w-[42px] rounded-edge border border-line bg-white px-1 text-center
                  text-[11.5px] font-medium text-ink outline-none
                  focus:border-brand-red/40 focus:ring-3 focus:ring-brand-red/12"
              />
            ) : (
              <button
                type="button"
                onClick={() => setZoomDraft(String(Math.round(scale * 100)))}
                title="Escribir un zoom"
                className="h-7 min-w-[42px] rounded-edge px-1 text-[11.5px] font-medium text-brand-gray
                  outline-none transition-colors hover:bg-fill hover:text-ink
                  focus-visible:ring-3 focus-visible:ring-brand-red/20"
              >
                {Math.round(scale * 100)}%
              </button>
            )}
            <button
              type="button"
              onClick={() => applyZoom(scale * 1.2)}
              disabled={scale >= MAX_SCALE}
              aria-label="Acercar"
              title="Acercar"
              className={iconButtonClass}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom("fit")}
              aria-label="Ajustar la página"
              title="Ajustar la página"
              className={iconButtonClass}
            >
              <Maximize className="h-4 w-4" />
            </button>

            <span aria-hidden className={dividerClass} />

            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
              title="Página anterior"
              className={iconButtonClass}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span className="min-w-[42px] text-center text-[11.5px] font-medium text-subtle">
              {page}/{doc.numPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= doc.numPages}
              aria-label="Página siguiente"
              title="Página siguiente"
              className={iconButtonClass}
            >
              <ChevronDown className="h-4 w-4" />
            </button>

            <span aria-hidden className={dividerClass} />

            <button
              type="button"
              onClick={() => setRotation((current) => (current + 90) % 360)}
              aria-label="Rotar"
              title="Rotar"
              className={iconButtonClass}
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </>,
          toolbarSlot,
        )}
    </>
  );
}
