import {
  cannedVariableLabel,
  lookupCannedVariable,
  normalizeVariableKey,
} from "../../lib/cannedVariables";
import { parseTemplateString } from "./cannedTemplateParts";
import {
  CANNED_VAR_CHIP_DOT,
  CANNED_VAR_CHIP_INLINE,
  CANNED_VAR_CHIP_REMOVE,
} from "./cannedVariableChipStyles";

export function serializeRichRoot(root: HTMLElement): string {
  let out = "";
  root.childNodes.forEach((node, index) => {
    out += serializeNode(node);
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if ((el.tagName === "DIV" || el.tagName === "P") && index < root.childNodes.length - 1) {
        out += "\n";
      }
    }
  });
  return out;
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\u200B/g, "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  if (el.dataset.varKey) return `{${normalizeVariableKey(el.dataset.varKey)}}`;
  if (el.tagName === "BR") {
    if (el.dataset.bogus === "1") return "";
    return "\n";
  }
  let chunk = "";
  el.childNodes.forEach((child) => {
    chunk += serializeNode(child);
  });
  return chunk;
}

function appendText(root: HTMLElement, text: string) {
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (line) root.appendChild(document.createTextNode(line));
    if (index < lines.length - 1) root.appendChild(document.createElement("br"));
  });
}

export function createChipElement(rawKey: string): HTMLSpanElement {
  const varKey = normalizeVariableKey(rawKey);
  const def = lookupCannedVariable(varKey);
  const label = cannedVariableLabel(varKey);

  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.dataset.varKey = varKey;
  chip.className = CANNED_VAR_CHIP_INLINE;
  chip.title = def ? `${def.label}: ${def.hint}` : label;

  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  dot.className = CANNED_VAR_CHIP_DOT;
  chip.appendChild(dot);

  const text = document.createElement("span");
  text.className = "truncate";
  text.textContent = label;
  chip.appendChild(text);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.chipRemove = "1";
  remove.setAttribute("aria-label", `Quitar ${label}`);
  remove.className = CANNED_VAR_CHIP_REMOVE;
  remove.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  remove.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  chip.appendChild(remove);

  return chip;
}

export function populateRichRoot(root: HTMLElement, value: string) {
  root.innerHTML = "";
  for (const part of parseTemplateString(value)) {
    if (part.kind === "variable") {
      root.appendChild(createChipElement(part.key));
      root.appendChild(document.createTextNode("\u200B"));
    } else {
      appendText(root, part.text);
    }
  }
}

export function placeCaretAtEnd(root: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection) return null;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return range.cloneRange();
}

export function insertChipAtSelection(
  root: HTMLElement,
  rawKey: string,
  savedRange?: Range | null,
): Range | null {
  const chip = createChipElement(rawKey);
  const spacer = document.createTextNode("\u200B");
  const selection = window.getSelection();

  let activeRange: Range | null = null;
  if (selection && selection.rangeCount > 0 && root.contains(selection.anchorNode)) {
    activeRange = selection.getRangeAt(0);
  } else if (savedRange && root.contains(savedRange.startContainer)) {
    activeRange = savedRange;
  }

  if (!activeRange) {
    root.appendChild(chip);
    root.appendChild(spacer);
    return placeCaretAtEnd(root);
  }

  // Si la selección está por error dentro de otro chip, nos movemos justo después de ese chip.
  const startNode = activeRange.startContainer;
  const parentChip =
    startNode.nodeType === Node.ELEMENT_NODE
      ? (startNode as HTMLElement).closest("[data-var-key]")
      : startNode.parentElement?.closest("[data-var-key]");

  if (parentChip && root.contains(parentChip)) {
    activeRange.setStartAfter(parentChip);
    activeRange.collapse(true);
  }

  activeRange.deleteContents();
  activeRange.insertNode(spacer);
  activeRange.insertNode(chip);

  const nextRange = document.createRange();
  nextRange.setStartAfter(spacer);
  nextRange.collapse(true);

  if (selection) {
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }

  return nextRange.cloneRange();
}

export function removeChipElement(chip: Element) {
  const next = chip.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE && next.textContent === "\u200B") {
    next.remove();
  }
  chip.remove();
}
