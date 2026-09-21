#!/usr/bin/env bash
# Restore one archive into an isolated MongoDB target and fail on restore errors.
# This is intentionally destructive to the target database, never the source.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: MONGODB_RESTORE_URI='mongodb://…/vichar_restore_drill' \
  scripts/mongodb-restore-drill.sh --archive /secure/backups/vichar/file.archive.gz --confirm-drop

Restores the archive with --drop into the database encoded by
MONGODB_RESTORE_URI. Use a disposable, isolated restore target only. A matching
.sha256 sidecar is verified when present. Install MongoDB Database Tools
(mongorestore and sha256sum) first.
EOF
}

archive=""
confirmed="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive)
      [[ $# -ge 2 ]] || { echo "--archive needs a path" >&2; exit 2; }
      archive="$2"
      shift 2
      ;;
    --confirm-drop)
      confirmed="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ -n "${MONGODB_RESTORE_URI:-}" ]] || {
  echo "MONGODB_RESTORE_URI must be set in the environment" >&2
  exit 2
}
[[ -n "$archive" && -f "$archive" ]] || {
  echo "--archive must name an existing archive file" >&2
  exit 2
}
[[ "$confirmed" == "true" ]] || {
  echo "Refusing to drop target collections without --confirm-drop" >&2
  exit 2
}
[[ "$MONGODB_RESTORE_URI" != "${MONGODB_URI:-}" ]] || {
  echo "Restore URI must not equal MONGODB_URI (the source database)" >&2
  exit 2
}
command -v mongorestore >/dev/null 2>&1 || {
  echo "mongorestore is required; install MongoDB Database Tools" >&2
  exit 127
}

checksum="$archive.sha256"
if [[ -f "$checksum" ]]; then
  command -v sha256sum >/dev/null 2>&1 || {
    echo "sha256sum is required to verify the archive checksum" >&2
    exit 127
  }
  (
    cd -- "$(dirname "$archive")"
    sha256sum -c -- "$(basename "$checksum")"
  )
fi

# --drop makes the drill a meaningful reconstruction rather than merging old
# documents into a target. --stopOnError prevents a partial restore from being
# reported as successful.
mongorestore \
  --uri="$MONGODB_RESTORE_URI" \
  --archive="$archive" \
  --gzip \
  --drop \
  --stopOnError

echo "Restore completed successfully. Perform the application checks in docs/backup-and-recovery.md before recording this drill."
