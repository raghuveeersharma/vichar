import crypto from "node:crypto";

// At-rest encryption for note bodies. A note flagged `isEncrypted` never has
// readable content in Mongo: the plaintext HTML is sealed here before the
// document is written and opened again on the way out, so a database dump or a
// stray `find()` in a Mongo shell shows only ciphertext.
//
// AES-256-GCM, so the tag authenticates the ciphertext — a tampered or
// truncated blob fails to open instead of decrypting to garbage. The owner id
// goes in as additional authenticated data, which binds a blob to one user:
// pasting another row's ciphertext into your own note makes the tag check fail.
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits, the size GCM is specified for
const KEY_BYTES = 32; // AES-256

// Versioned so a future format (different cipher, wrapped keys) can be told
// apart from this one instead of being fed to the wrong decryptor.
const PREFIX = "enc:v1";

// Read lazily, never at import time: index.js calls dotenv.config() in its
// module body, which ESM runs *after* every import has already been evaluated.
// A key captured at import would always be undefined.
let cachedKey = null;

function parseKey(raw) {
  // 64 hex chars is what `openssl rand -hex 32` prints; base64 is accepted for
  // hosts whose env UI mangles long hex. Anything that is not exactly 32 bytes
  // is a configuration error, not something to pad or hash into shape.
  const buf = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `NOTE_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length}) — see server/.env.example`
    );
  }
  return buf;
}

export function isEncryptionConfigured() {
  return Boolean(process.env.NOTE_ENCRYPTION_KEY);
}

function getKey() {
  if (!cachedKey) {
    if (!isEncryptionConfigured()) {
      throw new Error("NOTE_ENCRYPTION_KEY is not set");
    }
    cachedKey = parseKey(process.env.NOTE_ENCRYPTION_KEY);
  }
  return cachedKey;
}

// `enc:v1:<iv>:<tag>:<ciphertext>`, all three parts base64. Keeping the whole
// envelope in one string is what lets `content` stay a plain String field, so
// the schema, the validators and the AI endpoints are unchanged.
export function encryptContent(plaintext, aad) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  cipher.setAAD(Buffer.from(String(aad), "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    PREFIX,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function isEncryptedPayload(value) {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`);
}

// Throws on a wrong key, a tampered blob, or a mismatched owner. Callers decide
// what that means: a listing degrades to a placeholder, a single-note read
// fails outright rather than handing the editor content it would then save over.
export function decryptContent(payload, aad) {
  const parts = payload.split(":");
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== PREFIX) {
    throw new Error("Malformed encrypted note payload");
  }
  const [, , ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAAD(Buffer.from(String(aad), "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
