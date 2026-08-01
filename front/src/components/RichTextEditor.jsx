import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import toast from "react-hot-toast";
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  CodeIcon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Undo2Icon,
  Redo2Icon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";
import api from "../libs/axios";

const ToolbarButton = ({ onClick, active, disabled, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    aria-pressed={Boolean(active)}
    className={`btn btn-xs btn-square ${active ? "btn-primary" : "btn-ghost"}`}
  >
    {children}
  </button>
);

/**
 * TipTap editor over an HTML string. `value` is only read when it differs from
 * what the editor already holds, so typing never fights the parent's state.
 */
const RichTextEditor = ({ value, onChange, placeholder = "Write..." }) => {
  // Which AI action is in flight, or null. Both buttons disable together so a
  // second request cannot overwrite the first one's result.
  const [aiAction, setAiAction] = useState(null);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm sm:prose-base max-w-none min-h-[12rem] px-4 py-3 focus:outline-none",
      },
    },
  });

  // useEditor does not re-render on every transaction in TipTap v3, so the
  // toolbar's active/disabled states have to be selected explicitly.
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            code: editor.isActive("code"),
            h2: editor.isActive("heading", { level: 2 }),
            h3: editor.isActive("heading", { level: 3 }),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            blockquote: editor.isActive("blockquote"),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
          }
        : null,
  });

  // Pick up content that arrived after mount (e.g. the note detail page's
  // fetch). The equality check is what keeps the caret from jumping on typing.
  useEffect(() => {
    if (!editor) return;
    const next = value || "";
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  const runAI = async (action) => {
    if (!editor) return;
    const content = editor.getHTML();
    if (!editor.getText().trim()) {
      toast.error("Write something first");
      return;
    }
    try {
      setAiAction(action);
      const res = await api.post(`/ai/${action}`, { content });
      // Goes through the normal command pipeline, so Ctrl+Z undoes the AI edit.
      editor.commands.setContent(res.data.html);
      onChange(editor.getHTML());
      toast.success(res.data.summary || "Done");
    } catch (error) {
      console.error(`Error running AI ${action}:`, error);
      const status = error.response?.status;
      if (status === 503) {
        toast.error(
          error.response?.data?.message || "AI is unavailable right now"
        );
      } else if (status === 429) {
        toast.error("Too many AI requests. Please try again later.");
      } else if (status !== 401) {
        toast.error(error.response?.data?.message || "AI request failed");
      }
    } finally {
      setAiAction(null);
    }
  };

  if (!editor || !state) return null;

  const busy = aiAction !== null;

  return (
    <div className="rounded-lg border border-base-content/20 bg-base-100 focus-within:border-primary">
      <div className="flex flex-wrap items-center gap-1 border-b border-base-content/10 p-2">
        <ToolbarButton
          label="Bold"
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={state.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <StrikethroughIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          active={state.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeIcon className="size-3.5" />
        </ToolbarButton>

        <div className="mx-1 h-4 w-px bg-base-content/20" />

        <ToolbarButton
          label="Heading 2"
          active={state.h2}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2Icon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={state.h3}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3Icon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={state.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon className="size-3.5" />
        </ToolbarButton>

        <div className="mx-1 h-4 w-px bg-base-content/20" />

        <ToolbarButton
          label="Undo"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2Icon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2Icon className="size-3.5" />
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="btn btn-xs btn-outline btn-primary"
            onClick={() => runAI("grammar")}
            disabled={busy}
          >
            <SparklesIcon
              className={`size-3.5 ${
                aiAction === "grammar" ? "animate-pulse" : ""
              }`}
            />
            {aiAction === "grammar" ? "Fixing..." : "Fix grammar"}
          </button>
          <button
            type="button"
            className="btn btn-xs btn-outline btn-primary"
            onClick={() => runAI("format")}
            disabled={busy}
          >
            <WandSparklesIcon
              className={`size-3.5 ${
                aiAction === "format" ? "animate-pulse" : ""
              }`}
            />
            {aiAction === "format" ? "Formatting..." : "Format"}
          </button>
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
