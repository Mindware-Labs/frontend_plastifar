/**
 * Traduce los bloques del editor a HTML de correo. No vale el HTML del editor:
 * viene con clases y una hoja de estilos aparte, y Gmail borra ambas cosas.
 * Aqui todo va con estilos en linea, que es lo unico que sobrevive.
 */

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', SFMono-Regular, Consolas, 'Courier New', monospace";
const INK = "#1B1B1D";
const BODY = "#515151";
const MUTED = "#8A8A90";
const LINE = "#E7E7EA";
const CANVAS = "#F5F5F6";
const RED = "#E4002B";

const TEXT = `font-family:${SANS}; font-size:14px; line-height:1.65; color:${BODY};`;

interface StyledText {
  type?: string;
  text?: string;
  href?: string;
  content?: unknown;
  styles?: Record<string, unknown>;
}

interface Block {
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: Block[];
}

function escape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Solo http, https y mailto: un href con javascript: es un enlace armado. */
function safeHref(href: string) {
  return /^(https?:|mailto:)/i.test(href.trim()) ? escape(href.trim()) : "";
}

function inlineToHtml(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";

  return nodes
    .map((node) => {
      const item = node as StyledText;

      if (item.type === "link") {
        const href = safeHref(item.href ?? "");
        const inner = inlineToHtml(item.content);
        return href ? `<a href="${href}" style="color:${RED};">${inner}</a>` : inner;
      }

      let html = escape(item.text ?? "").replace(/\n/g, "<br />");
      const styles = item.styles ?? {};

      if (styles.code) html = `<code style="font-family:${MONO}; font-size:13px;">${html}</code>`;
      if (styles.bold) html = `<strong>${html}</strong>`;
      if (styles.italic) html = `<em>${html}</em>`;
      if (styles.underline) html = `<u>${html}</u>`;
      if (styles.strike) html = `<s>${html}</s>`;

      return html;
    })
    .join("");
}

function cellsOf(row: unknown): unknown[] {
  const cells = (row as { cells?: unknown[] } | undefined)?.cells;
  return Array.isArray(cells) ? cells : [];
}

/** Una celda es contenido suelto o un objeto con su propio contenido, segun la version. */
function cellContent(cell: unknown): unknown {
  if (Array.isArray(cell)) return cell;
  return (cell as { content?: unknown } | undefined)?.content ?? [];
}

function tableToHtml(block: Block): string {
  const rows = (block.content as { rows?: unknown[] } | undefined)?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return "";

  const body = rows
    .map((row) => {
      const cells = cellsOf(row)
        .map(
          (cell) =>
            `<td style="border:1px solid ${LINE}; padding:6px 10px; ${TEXT}">` +
            `${inlineToHtml(cellContent(cell)) || "&nbsp;"}</td>`,
        )
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return (
    `<table cellpadding="0" cellspacing="0" role="presentation" ` +
    `style="border-collapse:collapse; margin:0 0 14px; width:100%;">${body}</table>`
  );
}

function blockToHtml(block: Block): string {
  const inner = inlineToHtml(block.content);

  switch (block.type) {
    case "heading": {
      const level = Number(block.props?.level ?? 1);
      const size = level === 1 ? 20 : level === 2 ? 17 : 15;
      return (
        `<div style="margin:22px 0 10px; font-family:${SANS}; font-size:${size}px; ` +
        `font-weight:700; line-height:1.3; color:${INK};">${inner}</div>`
      );
    }

    case "quote":
      return (
        `<blockquote style="margin:0 0 14px; padding:2px 0 2px 12px; ` +
        `border-left:2px solid ${LINE}; ${TEXT} color:${MUTED};">${inner}</blockquote>`
      );

    case "codeBlock":
      return (
        `<pre style="margin:0 0 14px; padding:10px 12px; background:${CANVAS}; ` +
        `border:1px solid ${LINE}; font-family:${MONO}; font-size:13px; ` +
        `line-height:1.5; color:${INK}; white-space:pre-wrap;">${inner}</pre>`
      );

    case "checkListItem":
      return `<p style="margin:0 0 6px; ${TEXT}">${block.props?.checked ? "☑" : "☐"} ${inner}</p>`;

    case "table":
      return tableToHtml(block);

    case "divider":
      return `<hr style="border:0; border-top:1px solid ${LINE}; margin:18px 0;" />`;

    default:
      // Un parrafo vacio es un salto de linea deliberado del que escribe.
      return inner
        ? `<p style="margin:0 0 14px; ${TEXT}">${inner}</p>`
        : `<p style="margin:0 0 14px; ${TEXT}">&nbsp;</p>`;
  }
}

/** Las listas llegan como bloques sueltos y consecutivos: hay que envolverlas. */
export function blocksToEmailHtml(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";

  const out: string[] = [];
  let openList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (openList) out.push(`</${openList}>`);
    openList = null;
  };

  for (const raw of blocks as Block[]) {
    const listTag =
      raw.type === "bulletListItem" ? "ul" : raw.type === "numberedListItem" ? "ol" : null;

    if (listTag) {
      if (openList !== listTag) {
        closeList();
        out.push(`<${listTag} style="margin:0 0 14px; padding-left:22px; ${TEXT}">`);
        openList = listTag;
      }

      const nested = Array.isArray(raw.children) && raw.children.length > 0
        ? blocksToEmailHtml(raw.children)
        : "";

      out.push(`<li style="margin:0 0 4px;">${inlineToHtml(raw.content)}${nested}</li>`);
      continue;
    }

    closeList();
    out.push(blockToHtml(raw));

    if (Array.isArray(raw.children) && raw.children.length > 0) {
      out.push(blocksToEmailHtml(raw.children));
    }
  }

  closeList();
  return out.join("");
}

/** La version de texto plano del mismo mensaje: la usan los clientes sin HTML. */
export function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";

  const lines: string[] = [];

  const inlineText = (nodes: unknown): string => {
    if (!Array.isArray(nodes)) return "";
    return nodes
      .map((node) => {
        const item = node as StyledText;
        return item.type === "link" ? inlineText(item.content) : item.text ?? "";
      })
      .join("");
  };

  const walk = (list: Block[], depth: number) => {
    for (const block of list) {
      const text = inlineText(block.content);
      const indent = "  ".repeat(depth);

      if (block.type === "bulletListItem") lines.push(`${indent}- ${text}`);
      else if (block.type === "numberedListItem") lines.push(`${indent}1. ${text}`);
      else if (block.type === "checkListItem") lines.push(`${indent}[${block.props?.checked ? "x" : " "}] ${text}`);
      else if (block.type === "table") {
        const rows = (block.content as { rows?: unknown[] } | undefined)?.rows ?? [];
        for (const row of rows) {
          lines.push(cellsOf(row).map((cell) => inlineText(cellContent(cell))).join(" | "));
        }
      } else if (block.type === "divider") lines.push("---");
      else lines.push(`${indent}${text}`);

      if (Array.isArray(block.children) && block.children.length > 0) walk(block.children, depth + 1);
    }
  };

  walk(blocks as Block[], 0);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
