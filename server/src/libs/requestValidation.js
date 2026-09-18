// Limits are deliberately defined at the HTTP boundary, before values reach
// Mongoose, bcrypt, the HTML sanitizer, or the AI provider. Schema validation
// remains useful defence in depth, but it cannot prevent an oversized request
// from consuming work first.
export const LIMITS = Object.freeze({
  email: 254,
  name: 100,
  passwordBytes: 72,
  noteTitle: 200,
  noteContentBytes: 128 * 1024,
  folderName: 60,
});

function hasControlCharacters(value) {
  // Newlines and other controls do not make useful names or titles and can
  // make logs, headings, and labels misleading.
  return /[\u0000-\u001F\u007F]/.test(value);
}

export function normalizedText(value, { label, maxLength }) {
  if (typeof value !== "string") {
    return { error: `${label} must be text` };
  }

  const text = value.trim();
  if (!text) return { error: `${label} is required` };
  if (text.length > maxLength) {
    return { error: `${label} must be at most ${maxLength} characters` };
  }
  if (hasControlCharacters(text)) {
    return { error: `${label} cannot contain control characters` };
  }
  return { value: text };
}

export function normalizedEmail(value) {
  const result = normalizedText(value, {
    label: "Email",
    maxLength: LIMITS.email,
  });
  if (result.error) return result;

  const email = result.value.toLowerCase();
  // This intentionally checks the practical shape needed by this application,
  // not the full RFC 5322 grammar (which accepts surprising obsolete forms).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Email must be a valid email address" };
  }
  return { value: email };
}

export function validPassword(value, { label = "Password", minLength = 6 } = {}) {
  if (typeof value !== "string") {
    return { error: `${label} must be text` };
  }
  if (value.length < minLength) {
    return { error: `${label} must be at least ${minLength} characters` };
  }
  // bcrypt only incorporates the first 72 UTF-8 bytes. Rejecting longer
  // passwords avoids silently accepting two different passwords as the same.
  if (Buffer.byteLength(value, "utf8") > LIMITS.passwordBytes) {
    return {
      error: `${label} must be at most ${LIMITS.passwordBytes} bytes`,
    };
  }
  return { value };
}

export function validNoteContent(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { error: "Note content is required" };
  }
  if (Buffer.byteLength(value, "utf8") > LIMITS.noteContentBytes) {
    return {
      error: `Note content must be at most ${LIMITS.noteContentBytes / 1024} KB`,
      status: 413,
    };
  }
  return { value };
}
