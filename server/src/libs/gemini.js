import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

export { ThinkingLevel };

// The AI endpoints are optional: the rest of the app boots and runs without a
// key, and /api/ai answers 503 instead. So the client is created lazily rather
// than at import time — a missing key must not take the whole server down.
let client = null;

export function isAIConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getGemini() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

// Overridable so a model swap is an .env change, not a code change.
//
// Pinned to an exact version rather than the `gemini-flash-latest` alias: the
// alias silently rolls forward onto models with different knobs (3.x dropped
// `thinkingBudget` in favour of `thinkingLevel`), so tracking it turns a Google
// release into a surprise 400 in production. Bump this deliberately instead.
// Note gemini-2.5-flash is closed to new API keys and 404s — don't go back.
export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// The editor round-trips TipTap HTML, so every reply has to come back as HTML
// we can hand straight to `editor.commands.setContent`. Pairing this with
// responseMimeType: "application/json" makes that a guarantee instead of a
// hope — no fenced code blocks, no "Here is the corrected text:" preamble.
// Note this is Gemini's OpenAPI-flavoured Schema, not full JSON Schema:
// `additionalProperties` and friends are not part of the accepted subset.
export const HTML_RESULT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    html: {
      type: Type.STRING,
      description:
        "The rewritten note body as an HTML fragment, using only the allowed tags.",
    },
    summary: {
      type: Type.STRING,
      description:
        "One short sentence describing what changed, or 'No changes needed.'",
    },
  },
  required: ["html", "summary"],
  propertyOrdering: ["html", "summary"],
};

// Kept in sync with the TipTap StarterKit nodes/marks the editor registers —
// anything outside this list would be silently dropped when the HTML is parsed
// back into the document, which looks like data loss to the user.
export const ALLOWED_TAGS =
  "<p>, <h1>, <h2>, <h3>, <strong>, <em>, <u>, <s>, <code>, <pre>, <blockquote>, <ul>, <ol>, <li>, <a>, <hr>, <br>";
