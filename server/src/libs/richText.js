import sanitizeHtml from "sanitize-html";

// This is intentionally narrower than sanitize-html's default policy. It
// mirrors the structure and marks supported by the TipTap editor, so HTML that
// reaches storage is both safe to render and unlikely to disappear when the
// client next loads it into the editor.
const ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "hr",
  "br",
];

const SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  // Links are the only editor output that needs an attribute. In particular,
  // do not preserve styles, event handlers, classes, ids, or target="_blank"
  // (which would also require rel="noopener").
  allowedAttributes: { a: ["href"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
};

/**
 * Return the safe HTML fragment that can be stored or rendered by Vichar.
 *
 * All user-authored note bodies go through this before persistence and every
 * Gemini response goes through it before being handed to the browser. This is
 * defence in depth: the editor and Gemini schema are useful constraints, but
 * neither is an authority boundary.
 */
export function sanitizeRichText(value) {
  return sanitizeHtml(value, SANITIZE_OPTIONS);
}

