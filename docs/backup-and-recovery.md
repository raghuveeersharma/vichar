# Backup, recovery, and encryption-key policy

This runbook covers the Vichar MongoDB data and the separate key material that
allows encrypted notes to be opened. It applies to every environment holding
real user data.

## Recovery objectives and ownership

- The service owner is responsible for ensuring that backups run every 24
  hours, are copied to a separate failure domain, and are retained for at least
  35 days. Configure a shorter recovery-point objective only after explicitly
  accepting the potential data loss.
- Store backup archives in a provider-managed encrypted bucket or vault with
  access limited to the backup job and named recovery operators. Enable
  immutability or object versioning where the provider supports it.
- Perform and record a restore drill at least quarterly and after changing the
  database topology, backup credentials, or encryption implementation. Record
  the archive timestamp, operator, target, duration, result, and any follow-up
  work in the operations log. Never record connection strings or keys there.

The scripts below use the [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/).
They do not upload, encrypt, retain, or schedule backups themselves; configure
those controls in the deployment platform or backup system.

## Create a backup

Run this from a controlled backup worker, not from an application container.
Keep the destination outside this repository and outside the host running the
application.

```bash
export MONGODB_URI='mongodb+srv://backup-user:…@cluster.example/vichar?retryWrites=true&w=majority'
export MONGODB_DATABASE='vichar'
./scripts/mongodb-backup.sh --output-dir /secure/offsite/vichar
```

The command creates a compressed BSON archive of `MONGODB_DATABASE` and a SHA-256 sidecar file. It
writes with owner-only permissions, first to a temporary filename, and only
publishes the final archive after `mongodump` succeeds. Copy both files to the
encrypted offsite destination; a checksum only detects corruption and is not
encryption or an authenticity guarantee.

Use a database user with only the read permissions needed for the Vichar
database. Before automating a schedule, run this command once and confirm that
both files reached the offsite destination. Do not put the URI in shell history,
CI logs, source control, or ticket comments; provide it through the scheduler's
secret store.

## Restore drill

Never restore into production for a drill. Provision an isolated MongoDB
instance or cluster with a disposable database and credentials. The archive
keeps its original database namespace, so the target must be isolated rather
than merely a differently named database on the production cluster.

```bash
export MONGODB_RESTORE_URI='mongodb://restore-user:…@restore-host:27017/vichar'
./scripts/mongodb-restore-drill.sh \
  --archive /secure/offsite/vichar/vichar-mongodb-20260921T000000Z.archive.gz \
  --confirm-drop
```

`--confirm-drop` is mandatory because the script removes collections at the
target before restoring them. If the archive has a `.sha256` sidecar beside it,
the script verifies it before altering the target. The script also refuses an
identical `MONGODB_URI` and `MONGODB_RESTORE_URI` when both are present; keep
the restore target isolated regardless.

After `mongorestore` succeeds, start a temporary API against the restored
database using the recovered `NOTE_ENCRYPTION_KEY`, an isolated JWT secret, and
a temporary frontend origin. Confirm all of the following before marking the
drill successful:

1. `GET /ready` returns `200`.
2. User, folder, and note counts are plausible for the archive timestamp.
3. A normal note can be read and edited by its owner.
4. An encrypted note can be opened and its saved plaintext matches the expected
   content. Do not use a production account or expose note content in logs.
5. The expected MongoDB indexes exist, especially `notes.owner_1_createdAt_-1`,
   `notes.owner_1_folder_1_createdAt_-1`, and the unique folders owner/name
   index.

Tear down the restore environment and securely delete its data after the drill.

## Production recovery

Declare an incident, stop application writers, and select the newest verified
archive at or before the desired recovery point. Restore only to a replacement
or newly provisioned production database, using the exact key version that was
active when the archive was written. Configure the API with that database and
key, run the same application checks as the restore drill, then switch traffic.
Do not overwrite the damaged production database until the replacement has
passed validation and the incident owner approves the cutover.

## `NOTE_ENCRYPTION_KEY` policy

`NOTE_ENCRYPTION_KEY` is a 32-byte AES key, supplied as 64 hexadecimal
characters or base64. Generate it with `openssl rand -hex 32`. Store the value
as a production secret rather than in `.env`, source control, application logs,
browser configuration, or backup filenames.

Keep two independently recoverable, access-controlled copies: the primary
secret manager used at runtime and a separate break-glass escrow controlled by
at least two designated recovery operators. Record the key identifier and
creation date, never the key value. Test access to both locations during each
restore drill. The database archive and the exact corresponding key must be
retained for the same duration.

Losing or changing the key makes existing encrypted notes permanently
unreadable. A database backup does not contain a substitute for it.

### Rotation

The current `enc:v1` payload does not store a key identifier and the server
accepts one active `NOTE_ENCRYPTION_KEY`. Therefore, **do not rotate the key by
replacing the environment variable**: that immediately prevents every existing
encrypted note from decrypting.

Rotation requires a separately planned and tested migration that can read with
the old key, re-encrypt every encrypted note with a new key, atomically record
which key version protects each note, retain the old key until every backup
containing old ciphertext has expired, and include rollback and restore-drill
coverage. Until that migration exists, treat a suspected key compromise as a
security incident: restrict secret access, preserve the old key for recovery,
and schedule the migration rather than making an uncoordinated key change.
