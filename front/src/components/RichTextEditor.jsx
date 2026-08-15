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
  MicIcon,
  MicOffIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";
import api from "../libs/axios";
import useOnline from "../hooks/useOnline";
import useSpeechToText from "../hooks/useSpeechToText";
import Button from "./Button";

// Active state is a translucent primary wash rather than a solid fill: a row
// of solid buttons on a glass bar reads as heavier than the text it formats.
const ToolbarButton = ({ onClick, active, disabled, label, children }) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    aria-pressed={Boolean(active)}
    variant="ghost"
    size="xs"
    square
    className={active ? "bg-primary/20 text-primary hover:bg-primary/30" : ""}
  >
    {children}
  </Button>
);

/**
 * TipTap editor over an HTML string. `value` is only read when it differs from
 * what the editor already holds, so typing never fights the parent's state.
 */
const RichTextEditor = ({ value, onChange, placeholder = "Write..." }) => {
  // Which AI action is in flight, or null. Both buttons disable together so a
  // second request cannot overwrite the first one's result.
  const [aiAction, setAiAction] = useState(null);
  const isOnline = useOnline();

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

  // Dictation goes in through the normal command pipeline, exactly like typing:
  // `onUpdate` fires, the parent's `value` catches up, and Ctrl+Z undoes a
  // spoken sentence. Nothing is persisted until the user saves the note.
  const speech = useSpeechToText({
    onFinalResult: (text) => {
      const spoken = text.trim();
      if (!editor || !spoken) return;
      // Inserted at the cursor rather than appended, so dictation can be used to
      // fill in the middle of an existing note. The trailing space is what keeps
      // consecutive phrases from running together.
      editor
        .chain()
        .focus()
        .insertContent(spoken + " ")
        .run();
    },
    onError: (code) => {
      if (code === "not-allowed" || code === "service-not-allowed") {
        toast.error("Microphone blocked. Check this site's mic permissions.");
      } else if (code === "network") {
        toast.error("Dictation lost its connection");
      }
    },
  });

  const toggleDictation = () => {
    if (!speech.isSupported) {
      toast.error("Dictation isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    // Recognition is not local — it goes to the browser vendor's speech service
    // — so starting it offline hangs rather than failing fast.
    if (!isOnline) {
      toast.error("Dictation needs a connection");
      return;
    }
    if (speech.isListening) speech.stop();
    else speech.start();
  };

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
    <div className="glass-inset">
      {/* Sticky only from `md:` up. Wrapped at 375px this bar is two rows of
          44px targets plus the AI actions — roughly a fifth of a phone
          viewport — and parking that permanently under the navbar costs more
          than the convenience is worth. Wrapping beats horizontal scroll
          either way: a scrolled sticky bar hides buttons with no affordance. */}
      <div className="glass-panel m-2 flex flex-wrap items-center gap-1 p-2 md:sticky md:top-[calc(var(--navbar-h)+0.5rem)] md:z-30">
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

        {/* Group separators only make sense while the bar is one row; once it
            wraps on a phone they orphan onto their own line. */}
        <div className="mx-1 hidden h-4 w-px bg-base-content/20 md:block" />

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

        {/* Group separators only make sense while the bar is one row; once it
            wraps on a phone they orphan onto their own line. */}
        <div className="mx-1 hidden h-4 w-px bg-base-content/20 md:block" />

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

        {/* Sits with undo/redo rather than the formatting marks: it acts on the
            document as a whole, not on the selection. Disabled while an AI
            action is in flight because those replace the whole document with
            `setContent`, which would swallow anything dictated meanwhile. */}
        <ToolbarButton
          label={speech.isListening ? "Stop dictation" : "Dictate"}
          active={speech.isListening}
          disabled={busy}
          onClick={toggleDictation}
        >
          {speech.isListening ? (
            <MicOffIcon className="size-3.5 animate-pulse text-error" />
          ) : (
            <MicIcon className="size-3.5" />
          )}
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline-primary"
            size="xs"
            icon={SparklesIcon}
            iconClassName={aiAction === "grammar" ? "animate-pulse" : ""}
            onClick={() => runAI("grammar")}
            disabled={busy}
          >
            {aiAction === "grammar" ? "Fixing..." : "Fix grammar"}
          </Button>
          <Button
            variant="outline-primary"
            size="xs"
            icon={WandSparklesIcon}
            iconClassName={aiAction === "format" ? "animate-pulse" : ""}
            onClick={() => runAI("format")}
            disabled={busy}
          >
            {aiAction === "format" ? "Formatting..." : "Format"}
          </Button>
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
