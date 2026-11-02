import { cannedVariableLabel } from "../../lib/cannedVariables";
import { parseTemplateString } from "./cannedTemplateParts";
import {
  CANNED_VAR_CHIP_INLINE,
  CANNED_VAR_CHIP_REMOVE,
} from "./cannedVariableChipStyles";

export function serializeRichRoot(root: HTMLElement): string {
  let out = "";
  root.childNodes.forEach((node, index) => {
    out += serializeNode(node);
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "DIV" && index < root.childNodes.length - 1) {
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
  if (el.dataset.varKey) return `{${el.dataset.varKey}}`;
  if (el.tagName === "BR") return "\n";
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

export function createChipElement(varKey: string): HTMLSpanElement {
  const label = cannedVariableLabel(varKey);
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.dataset.varKey = varKey;
  chip.className = CANNED_VAR_CHIP_INLINE;
  chip.title = label;

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
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  remove.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  chip.appendChild(remove);

  return chip;
}

export function populateRichRoot(root: HTMLElement, value: string) {
  root.innerHTML = "";
  for (const part of parseTemplateString(value)) {
    if (part.kind === "variable") {
      root.appendChild(createChipElement(part.key));
    } else {
      appendText(root, part.text);
    }
  }
}

export function insertChipAtSelection(root: HTMLElement, varKey: string) {
  const chip = createChipElement(varKey);
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) {
    root.appendChild(chip);
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(chip);
  range.setStartAfter(chip);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function removeChipElement(chip: Element) {
  const next = chip.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE && next.textContent === "\u200B") {
    next.remove();
  }
  chip.remove();
}
