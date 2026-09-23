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

// Codes that are part of normal dictation rather than a fault. `no-speech`
// fires on any ordinary pause — it would toast at someone who merely stopped to
// think — and `aborted` is what our own stop() and unmount teardown raise, so
// both would be reporting the user's own action back to them.
const SILENT_SPEECH_ERRORS = new Set(["no-speech", "aborted"]);

// Everything else is worth saying out loud. Anything unlisted falls through to
// a generic message rather than surfacing a raw spec code.
const SPEECH_ERROR_MESSAGES = {
  "not-allowed": "Microphone blocked. Check this site's mic permissions.",
  "service-not-allowed": "Microphone blocked. Check this site's mic permissions.",
  "audio-capture": "No microphone found",
  network: "Dictation lost its connection",
  "language-not-supported": "Dictation isn't available for this language",
};

// How much of the in-progress phrase the preview shows. The *end* is the part
// worth seeing — it is what was just said — so the head is dropped rather than
// letting CSS truncate the tail, which would freeze the preview on the first
// few words while the rest of the sentence scrolled past unseen.
const INTERIM_PREVIEW_CHARS = 60;

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
const RichTextEditor = ({
  value,
  onChange,
  placeholder = "Write...",
  disabled = false,
}) => {
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
      if (!editor || !spoken || disabled) return;
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
      if (SILENT_SPEECH_ERRORS.has(code)) return;
      toast.error(SPEECH_ERROR_MESSAGES[code] ?? "Dictation stopped unexpectedly");
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

  // An encrypted note must not accumulate plaintext edits while offline. Make
  // the editor genuinely read-only as well as disabling the page's save action;
  // toolbar commands otherwise still mutate TipTap's in-memory document.
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (disabled && speech.isListening) speech.stop();
  }, [disabled, speech]);

  const runAI = async (action) => {
    if (!editor || disabled) return;
    if (!isOnline) {
      toast.error("AI editing needs a connection");
      return;
    }
    // End dictation first. The mic button is disabled while a request is in
    // flight, so leaving it running would strand the user with no way to switch
    // it off — and the reply arrives as a whole-document `setContent`, which
    // would discard anything spoken while it was on its way.
    if (speech.isListening) speech.stop();
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

  // Keep the tail, and let the `truncate` class handle whatever still does not
  // fit at 375px — the character cap alone cannot know the rendered width.
  const interim = speech.interimTranscript.trim();
  const interimPreview =
    interim.length > INTERIM_PREVIEW_CHARS
      ? `…${interim.slice(-INTERIM_PREVIEW_CHARS)}`
      : interim;

  return (
    <div className="glass-inset">
      {!isOnline && !disabled && (
        <div className="mx-2 mt-2 rounded-box border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-content">
          AI editing and dictation need a connection.
        </div>
      )}
      {/* Sticky only from `md:` up. Wrapped at 375px this bar is two rows of
          44px targets plus the AI actions — roughly a fifth of a phone
          viewport — and parking that permanently under the navbar costs more
          than the convenience is worth. Wrapping beats horizontal scroll
          either way: a scrolled sticky bar hides buttons with no affordance. */}
      <fieldset
        disabled={disabled}
        className="contents"
        aria-label={disabled ? "Editing unavailable while offline" : undefined}
      >
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
          disabled={disabled || busy || !isOnline}
          onClick={toggleDictation}
        >
          {speech.isListening ? (
            <MicOffIcon className="size-3.5 animate-pulse text-error" />
          ) : (
            <MicIcon className="size-3.5" />
          )}
        </ToolbarButton>

        {/* Read-only preview of what the recogniser is still revising. It is
            deliberately not in the document: interim text is rewritten as more
            audio arrives, so committing it would put words in the note that
            were never said. It lands there when it comes back as final. */}
        {speech.isListening && interimPreview && (
          <span className="basis-full truncate text-xs italic text-base-content/50 sm:basis-auto sm:max-w-[18rem]">
            {interimPreview}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline-primary"
            size="xs"
            icon={SparklesIcon}
            iconClassName={aiAction === "grammar" ? "animate-pulse" : ""}
            onClick={() => runAI("grammar")}
            disabled={disabled || busy || !isOnline}
          >
            {aiAction === "grammar" ? "Fixing..." : "Fix grammar"}
          </Button>
          <Button
            variant="outline-primary"
            size="xs"
            icon={WandSparklesIcon}
            iconClassName={aiAction === "format" ? "animate-pulse" : ""}
            onClick={() => runAI("format")}
            disabled={disabled || busy || !isOnline}
          >
            {aiAction === "format" ? "Formatting..." : "Format"}
          </Button>
        </div>
        </div>
      </fieldset>

      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
