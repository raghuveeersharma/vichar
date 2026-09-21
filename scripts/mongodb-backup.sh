#!/usr/bin/env bash
# Create an encrypted-at-rest MongoDB archive suitable for Vichar recovery.
# The destination must be an access-controlled, off-host backup location.
set -euo pipefail
umask 077

usage() {
  cat <<'EOF'
Usage: MONGODB_URI='mongodb+srv://…/vichar' MONGODB_DATABASE=vichar \
  scripts/mongodb-backup.sh --output-dir /secure/backups/vichar

Creates one gzip-compressed mongodump archive and a SHA-256 sidecar checksum.
Install MongoDB Database Tools (mongodump) first. The script deliberately does
not print the connection URI or embed it in the backup metadata.
EOF
}

output_dir=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)
      [[ $# -ge 2 ]] || { echo "--output-dir needs a path" >&2; exit 2; }
      output_dir="$2"
      shift 2
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

[[ -n "${MONGODB_URI:-}" ]] || {
  echo "MONGODB_URI must be set in the environment" >&2
  exit 2
}
[[ -n "${MONGODB_DATABASE:-}" ]] || {
  echo "MONGODB_DATABASE must be set so the backup scope is explicit" >&2
  exit 2
}
[[ -n "$output_dir" ]] || {
  echo "--output-dir is required" >&2
  exit 2
}
command -v mongodump >/dev/null 2>&1 || {
  echo "mongodump is required; install MongoDB Database Tools" >&2
  exit 127
}
command -v sha256sum >/dev/null 2>&1 || {
  echo "sha256sum is required" >&2
  exit 127
}

mkdir -p -- "$output_dir"
[[ -d "$output_dir" ]] || {
  echo "Backup destination is not a directory" >&2
  exit 2
}

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$output_dir/vichar-mongodb-$timestamp.archive.gz"
checksum="$archive.sha256"
temporary_archive="$output_dir/.vichar-mongodb-$timestamp.$$.tmp"

cleanup() {
  rm -f -- "$temporary_archive"
}
trap cleanup EXIT

# An archive preserves collections, documents, and indexes. Write to a temporary
# name and rename only after mongodump succeeds, so backup jobs never mistake a
# partial upload for a restorable archive.
mongodump \
  --uri="$MONGODB_URI" \
  --db="$MONGODB_DATABASE" \
  --archive="$temporary_archive" \
  --gzip
mv -- "$temporary_archive" "$archive"
# Record only the filename. The archive and sidecar may be moved together to
# offsite storage, so an absolute source-worker path would make verification
# fail after transfer (and unnecessarily disclose local layout).
(
  cd -- "$output_dir"
  sha256sum -- "$(basename "$archive")"
) > "$checksum"

echo "Backup complete: $(basename "$archive")"
echo "Checksum written: $(basename "$checksum")"
