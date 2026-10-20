// Read-only post-restore check for the restore drill in docs/backup-and-recovery.md.
// Reports counts, index presence, and whether every encrypted note opens with
// the supplied key. It never prints note content, ids, or the connection string.
//
//   MONGODB_RESTORE_URI='mongodb://…/vichar' NOTE_ENCRYPTION_KEY=… \
//     node server/scripts/verify-restore.js
import mongoose from "mongoose";
import User from "../src/modals/user.modal.js";
import Folder from "../src/modals/folder.modal.js";
import Note from "../src/modals/note.modal.js";
import { decryptContent, isEncryptedPayload } from "../src/libs/noteCrypto.js";

const uri = process.env.MONGODB_RESTORE_URI;
if (!uri) {
  console.error("MONGODB_RESTORE_URI must be set");
  process.exit(2);
}
if (uri === process.env.MONGODB_URI) {
  console.error("Refusing to run against MONGODB_URI (the source database)");
  process.exit(2);
}

const EXPECTED_INDEXES = {
  notes: ["owner_1_createdAt_-1", "owner_1_folder_1_createdAt_-1"],
  folders: ["owner_1_name_1"],
};

let failed = false;
const report = (ok, label, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

try {
  await mongoose.connect(uri);

  const [users, folders, notes] = await Promise.all([
    User.countDocuments(),
    Folder.countDocuments(),
    Note.countDocuments(),
  ]);
  console.log(`INFO  users=${users} folders=${folders} notes=${notes}`);
  report(users > 0 && notes > 0, "collections are non-empty");

  for (const [collection, names] of Object.entries(EXPECTED_INDEXES)) {
    const present = (await mongoose.connection.collection(collection).indexes()).map(
      (index) => index.name
    );
    for (const name of names) {
      report(present.includes(name), `index ${collection}.${name}`);
    }
  }

  const encrypted = await Note.find({ isEncrypted: true }).select("+content owner").lean();
  let opened = 0;
  let unreadable = 0;
  let unflagged = 0;
  for (const note of encrypted) {
    try {
      decryptContent(note.content, note.owner);
      opened += 1;
    } catch {
      unreadable += 1;
    }
  }
  // A sealed body on a note that is not flagged would be served as ciphertext.
  unflagged = await Note.countDocuments({
    isEncrypted: { $ne: true },
    content: { $regex: "^enc:v1:" },
  });
  console.log(`INFO  encrypted notes=${encrypted.length}`);
  report(
    encrypted.length === 0 || unreadable === 0,
    "every encrypted note opens with the supplied key",
    `${opened} opened, ${unreadable} failed`
  );
  report(unflagged === 0, "no sealed bodies on unflagged notes", `${unflagged} found`);
  if (encrypted.length === 0) {
    console.log("WARN  no encrypted notes in archive: the key was NOT exercised by this check");
  }
} catch (error) {
  failed = true;
  console.error(`FAIL  verification aborted: ${error.message}`);
} finally {
  await mongoose.disconnect();
}

process.exit(failed ? 1 : 0);
