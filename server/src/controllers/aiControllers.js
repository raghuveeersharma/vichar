import {
  getGemini,
  isAIConfigured,
  AI_MODEL,
  HTML_RESULT_SCHEMA,
  ALLOWED_TAGS,
  ThinkingLevel,
} from "../libs/gemini.js";
import { sanitizeRichText } from "../libs/richText.js";

// Roughly 25k tokens of HTML. Past this the request gets slow and expensive for
// a note editor, so refuse loudly instead of silently truncating the user's work.
const MAX_CONTENT_CHARS = 100_000;

const SHARED_RULES = `You are editing the body of a personal note inside a rich-text editor.

Rules:
- The "html" field must contain an HTML fragment only — no <html>, <head>, <body> wrapper and no markdown code fences.
- Use only these tags: ${ALLOWED_TAGS}. Anything else is dropped by the editor.
- Preserve the author's meaning, voice, facts, and language. Never add information they did not write, and never remove content.
- If the note is already fine, return it unchanged and say so in the summary.`;

// Depth is set with `thinkingLevel`, not `thinkingBudget`: Gemini 3.x rejects
// a budget outright (400 INVALID_ARGUMENT), while `thinkingLevel` is accepted
// by both 2.5 and 3.x — so this survives a model bump in either direction.
const ACTIONS = {
  grammar: {
    // Proofreading needs no deliberation, and this runs on a button press.
    thinkingLevel: ThinkingLevel.MINIMAL,
    system: `${SHARED_RULES}

Your task is proofreading. Fix spelling, grammar, punctuation, and obvious typos. Leave word choice, tone, and structure alone — this is a correction pass, not a rewrite.`,
  },
  format: {
    // Restructuring a long note needs a little more room than proofreading,
    // but it is still a structural pass — not a reasoning problem.
    thinkingLevel: ThinkingLevel.LOW,
    system: `${SHARED_RULES}

Your task is formatting. Improve the structure of the note so it is easy to scan: split walls of text into paragraphs, turn run-on enumerations into <ul>/<ol> lists, add <h2>/<h3> headings where the note has distinct sections, and emphasise key terms sparingly. Do not reword sentences and do not fix grammar — only change the structure.`,
  },
};

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function runAction(action, content) {
  const { system, thinkingLevel } = ACTIONS[action];

  const response = await getGemini().models.generateContent({
    model: AI_MODEL,
    contents: content,
    config: {
      systemInstruction: system,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseSchema: HTML_RESULT_SCHEMA,
      thinkingConfig: { thinkingLevel },
    },
  });

  // Gemini reports refusals in two different places depending on whether the
  // input or the output tripped a filter, and both come back as a 200.
  if (response.promptFeedback?.blockReason) {
    throw fail(422, "This note was blocked by the AI safety filters");
  }

  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    throw fail(413, "Note is too long to rewrite in one pass");
  }
  if (finishReason && finishReason !== "STOP") {
    throw fail(422, "The model declined to edit this note");
  }

  // responseMimeType + responseSchema guarantee the text is JSON matching
  // HTML_RESULT_SCHEMA, so there is nothing to strip or repair here.
  const text = response.text;
  if (!text) throw fail(502, "The AI returned an empty response");
  return JSON.parse(text);
}

function handler(action) {
  return async function assist(req, res) {
    try {
      if (!isAIConfigured()) {
        return res
          .status(503)
          .json({ message: "AI features are not configured on this server" });
      }

      const { content } = req.body;
      if (typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }
      if (content.length > MAX_CONTENT_CHARS) {
        return res
          .status(413)
          .json({ message: "Note is too long for AI editing" });
      }

      // Legacy notes and crafted requests can contain markup the current
      // editor would never emit. Do not send executable or unsupported HTML to
      // an external model, and never return it to the browser either.
      const safeContent = sanitizeRichText(content);
      if (!safeContent.trim()) {
        return res.status(400).json({ message: "Note content is not allowed" });
      }

      const { html, summary } = await runAction(action, safeContent);
      const safeHtml = sanitizeRichText(html);
      if (!safeHtml.trim()) {
        throw fail(502, "The AI returned unsafe or empty content");
      }
      res.status(200).json({ html: safeHtml, summary });
    } catch (error) {
      console.error(`Error in ${action}:`, error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      // A 404 or 400 from Gemini is a configuration bug, not a runtime blip —
      // usually a model id the key cannot use, or one that rejects a knob we
      // send. Say so, because "Internal server error" sends you hunting in the
      // wrong place. `AI_MODEL` is the first thing to check.
      if (error.status === 404 || error.status === 400) {
        return res.status(503).json({
          message: `AI model "${AI_MODEL}" rejected the request — check GEMINI_MODEL`,
        });
      }
      // Upstream rate limits and outages are worth distinguishing: the client
      // shows a "try again" toast rather than a generic failure.
      if (error.status === 429 || error.status >= 500) {
        return res
          .status(503)
          .json({ message: "AI service is busy, please try again" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

export const fixGrammar = handler("grammar");
export const formatNote = handler("format");
