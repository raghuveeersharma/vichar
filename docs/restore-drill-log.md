# Restore drill log

Append one entry per drill, newest first, using the template below. Never record
connection strings, keys, user emails, or note content. Procedure:
[backup-and-recovery.md](backup-and-recovery.md).

## Template

```
### YYYY-MM-DD — <initial pre-launch | quarterly | after change: …>

- Operator:
- Archive (filename + UTC timestamp):
- Checksum verified (sha256 sidecar): yes / no
- Restore target (isolated; describe, no URI):
- Backup → restore duration:
- `NOTE_ENCRYPTION_KEY` recovered from: primary secret manager / break-glass escrow (test both)
- `GET /ready` → 200: yes / no
- `server/scripts/verify-restore.js` exit code and summary (counts, indexes, encrypted notes opened):
- Normal note read + edit by owner on temporary API: pass / fail
- Encrypted note opened in the app, plaintext matches expected: pass / fail
- Restore environment torn down and data deleted: yes / no
- Result: success / failed
- Follow-up work:
```

## Pre-launch checklist (the initial drill)

1. Take a real backup from the production-equivalent database with
   `scripts/mongodb-backup.sh`; confirm the archive and `.sha256` reached the
   offsite destination.
2. Provision an isolated MongoDB target (not a second database on the same cluster).
3. Run `scripts/mongodb-restore-drill.sh --archive … --confirm-drop`.
4. Run `MONGODB_RESTORE_URI=… NOTE_ENCRYPTION_KEY=… node server/scripts/verify-restore.js`
   from the repo root (set the key from the escrow copy, then repeat with the
   runtime copy). The drill needs at least one encrypted note in the archive,
   otherwise the key is not exercised.
5. Start a temporary API against the target, then do the manual checks in the log
   template.
6. Tear down, fill in the entry below, and tick the TODO item.

## Entries

_No drills recorded yet._
