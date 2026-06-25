#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <image-path> [output-file]" >&2
  exit 64
fi

image_path="$1"
output_file="${2:-}"

if [ ! -f "$image_path" ]; then
  echo "Image file not found: $image_path" >&2
  exit 66
fi

mime_type="$(file -b --mime-type "$image_path")"
case "$mime_type" in
  image/png|image/jpeg|image/webp|image/gif) ;;
  *)
    echo "Unsupported image MIME type: $mime_type" >&2
    exit 65
    ;;
esac

if [ -z "$output_file" ]; then
  output_file="$(mktemp "${TMPDIR:-/tmp}/meme-image-data-url.XXXXXX")"
fi

{
  printf 'data:%s;base64,' "$mime_type"
  if base64 -i "$image_path" >/dev/null 2>&1; then
    base64 -i "$image_path" | tr -d '\n'
  else
    base64 "$image_path" | tr -d '\n'
  fi
} > "$output_file"

printf '%s\n' "$output_file"
