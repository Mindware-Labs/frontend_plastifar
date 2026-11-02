import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";

const MIN_HEIGHT_PX = 160;

export interface CannedTemplateBodyEditorHandle {
  focus: () => void;
}

interface CannedTemplateBodyEditorProps {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  placeholder?: string;
}

export const CannedTemplateBodyEditor = forwardRef<CannedTemplateBodyEditorHandle, CannedTemplateBodyEditorProps>(
  function CannedTemplateBodyEditor({ value, onChange, maxLength = 20000, placeholder }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus() {
        textareaRef.current?.focus();
      },
    }));

    useEffect(() => {
      autoResizeTextarea(textareaRef.current, MIN_HEIGHT_PX);
    }, [value, placeholder]);

    return (
      <div className="w-full px-3.5 py-2.5">
        <textarea
          ref={textareaRef}
          rows={6}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label="Texto de la plantilla"
          onChange={(event) => {
            onChange(event.target.value);
            autoResizeTextarea(event.target, MIN_HEIGHT_PX);
          }}
          onBlur={(event) => onChange(event.target.value)}
          className="block w-full min-h-[160px] resize-none overflow-hidden border-0 bg-transparent p-0 font-sans text-[13px] leading-[1.65] text-ink shadow-none outline-none placeholder:text-zinc-400 focus:ring-0"
        />
      </div>
    );
  },
);
