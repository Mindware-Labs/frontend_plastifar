import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { normalizeVariableKey } from "../../lib/cannedVariables";
import { templateHasVariables } from "./cannedTemplateParts";
import {
  insertChipAtSelection,
  placeCaretAtEnd,
  populateRichRoot,
  removeChipElement,
  serializeRichRoot,
} from "./cannedTemplateRichDom";

export interface CannedTemplateBodyEditorHandle {
  focus: () => void;
  insertVariable: (tokenOrKey: string) => void;
}

interface CannedTemplateBodyEditorProps {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  placeholder?: string;
}

export const CannedTemplateBodyEditor = forwardRef<
  CannedTemplateBodyEditorHandle,
  CannedTemplateBodyEditorProps
>(function CannedTemplateBodyEditor({ value, onChange, maxLength = 20000, placeholder }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string>(value);
  const savedRangeRef = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const root = rootRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (root.contains(range.startContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const syncFromDom = useCallback(
    (convertTypedTokens = false) => {
      const root = rootRef.current;
      if (!root) return;

      let serialized = serializeRichRoot(root);
      if (serialized.length > maxLength) {
        serialized = serialized.slice(0, maxLength);
      }

      // Si alguien escribió o pegó un marcador como {cliente.correo}, se transforma en chip visual.
      if (convertTypedTokens && templateHasVariables(serialized)) {
        const hasRawBraceInTextNode = Array.from(root.childNodes).some(
          (node) => node.nodeType === Node.TEXT_NODE && /\{[a-z][a-z0-9_.]*\}/i.test(node.textContent ?? ""),
        );
        if (hasRawBraceInTextNode) {
          populateRichRoot(root, serialized);
          savedRangeRef.current = placeCaretAtEnd(root);
        }
      }

      lastEmittedRef.current = serialized;
      onChange(serialized);
    },
    [maxLength, onChange],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (value !== lastEmittedRef.current || root.childNodes.length === 0) {
      populateRichRoot(root, value);
      lastEmittedRef.current = value;
    }
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        const root = rootRef.current;
        if (!root) return;
        root.focus();
        if (!savedRangeRef.current) {
          savedRangeRef.current = placeCaretAtEnd(root);
        }
      },
      insertVariable(tokenOrKey: string) {
        const root = rootRef.current;
        if (!root) return;
        root.focus();
        const key = normalizeVariableKey(tokenOrKey);
        savedRangeRef.current = insertChipAtSelection(root, key, savedRangeRef.current);
        syncFromDom(false);
      },
    }),
    [syncFromDom],
  );

  const isEmpty = value.length === 0;

  return (
    <div
      className="relative w-full cursor-text px-3.5 py-2.5"
      onClick={(event) => {
        const target = event.target as HTMLElement;
        const removeBtn = target.closest("[data-chip-remove]");
        if (removeBtn) {
          event.preventDefault();
          event.stopPropagation();
          const chip = removeBtn.closest("[data-var-key]");
          if (chip) {
            removeChipElement(chip);
            syncFromDom(false);
          }
          return;
        }
        if (target === event.currentTarget) {
          rootRef.current?.focus();
        }
      }}
    >
      {isEmpty && placeholder && (
        <div
          aria-hidden
          className="pointer-events-none select-none whitespace-pre-wrap font-sans text-[13px] leading-[1.65] text-zinc-400"
        >
          {placeholder}
        </div>
      )}

      <div
        ref={rootRef}
        role="textbox"
        aria-multiline="true"
        aria-label="Texto de la plantilla"
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          saveSelection();
          syncFromDom(true);
        }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onFocus={saveSelection}
        onBlur={() => {
          saveSelection();
          syncFromDom(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            const root = rootRef.current;
            const sel = window.getSelection();
            if (!root || !sel || sel.rangeCount === 0) return;

            const range = sel.getRangeAt(0);
            range.deleteContents();

            const br = document.createElement("br");
            range.insertNode(br);

            // Si el salto de línea queda al final absoluto del contenedor, el navegador necesita un nodo después para mover el cursor.
            const needsTrailing =
              !br.nextSibling ||
              (br.nextSibling.nodeType === Node.TEXT_NODE && (br.nextSibling.textContent ?? "") === "");
            if (needsTrailing) {
              const bogus = document.createTextNode("\u200B");
              br.after(bogus);
              range.setStartBefore(bogus);
            } else {
              range.setStartAfter(br);
            }

            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            savedRangeRef.current = range.cloneRange();
            syncFromDom(false);
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const pasted = event.clipboardData.getData("text/plain").replace(/\r\n/g, "\n");
          if (!pasted) return;

          const root = rootRef.current;
          const sel = window.getSelection();
          if (!root || !sel || sel.rangeCount === 0) return;

          const range = sel.getRangeAt(0);
          range.deleteContents();

          const fragment = document.createDocumentFragment();
          const lines = pasted.split("\n");
          let lastNode: Node | null = null;
          lines.forEach((line, idx) => {
            if (line) {
              const textNode = document.createTextNode(line);
              fragment.appendChild(textNode);
              lastNode = textNode;
            }
            if (idx < lines.length - 1) {
              const br = document.createElement("br");
              fragment.appendChild(br);
              lastNode = br;
            }
          });

          range.insertNode(fragment);
          if (lastNode) {
            range.setStartAfter(lastNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            savedRangeRef.current = range.cloneRange();
          }

          syncFromDom(true);
        }}
        className={`block w-full min-h-[160px] whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-sans text-[13px] leading-[1.7] text-ink shadow-none outline-none focus:ring-0 ${
          isEmpty ? "absolute inset-x-3.5 top-2.5" : ""
        }`}
      />
    </div>
  );
});
