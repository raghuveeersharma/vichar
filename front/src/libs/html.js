const HTML_TAG = /<[a-z][\s\S]*>/i;

// Notes written before the rich-text editor existed are stored as plain text
// with newlines. Handing that straight to TipTap collapses it into one
// paragraph, so promote each line to its own <p> first.
export function toEditorHtml(value) {
  if (!value) return "";
  if (HTML_TAG.test(value)) return value;
  return value
    .split(/\n{2,}|\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

// TipTap emits "<p></p>" for an empty document, which is truthy but not
// content — validation has to look at the text, not the markup.
export function isEmptyHtml(value) {
  return htmlToText(value).trim().length === 0;
}

// Used for the card previews on the home page, where the raw markup would
// otherwise show up as literal tags.
export function htmlToText(value) {
  if (!value) return "";
  if (!HTML_TAG.test(value)) return value;
  const doc = new DOMParser().parseFromString(value, "text/html");
  return doc.body.textContent || "";
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
