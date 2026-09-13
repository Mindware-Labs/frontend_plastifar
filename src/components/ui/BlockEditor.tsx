import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { es } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./BlockEditor.css";

interface BlockEditorProps {
  initialContent?: unknown;
  onChange: (blocks: unknown) => void;
  placeholder?: string;
}

/** Sin medios: una imagen por URL la bloquea el cliente de correo, y subirla es otro trabajo. */
const {
  image: _image,
  video: _video,
  audio: _audio,
  file: _file,
  ...blockSpecs
} = defaultBlockSpecs;

const schema = BlockNoteSchema.create({ blockSpecs });

/** Los grises de BlockNote sobre el panel parecen otra aplicacion: el tema sale de la marca. */
const theme = {
  colors: {
    editor: { text: "#1B1B1D", background: "#FFFFFF" },
    menu: { text: "#1B1B1D", background: "#FFFFFF" },
    tooltip: { text: "#1B1B1D", background: "#F1F1F3" },
    hovered: { text: "#1B1B1D", background: "#F1F1F3" },
    selected: { text: "#FFFFFF", background: "#E4002B" },
    disabled: { text: "#9A9AA0", background: "#F1F1F3" },
    shadow: "#E7E7EA",
    border: "#E7E7EA",
    sideMenu: "#9A9AA0",
  },
  borderRadius: 2,
  fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif",
} as const;

export default function BlockEditor({ initialContent, onChange, placeholder }: BlockEditorProps) {
  const editor = useCreateBlockNote({
    schema,
    dictionary: {
      ...es,
      placeholders: { ...es.placeholders, emptyDocument: placeholder ?? es.placeholders.emptyDocument },
    },
    // Un documento vacio necesita al menos un bloque o el editor no arranca.
    initialContent:
      Array.isArray(initialContent) && initialContent.length > 0
        ? (initialContent as PartialBlock[])
        : [{ type: "paragraph" }],
  });

  return (
    <BlockNoteView
      editor={editor}
      theme={theme}
      onChange={() => onChange(editor.document)}
      className="plf-editor"
    />
  );
}
