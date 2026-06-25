#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 4 ]; then
  echo "Usage: $0 <opencli-session> <data-url-file> [url-selector] [load-button-selector]" >&2
  exit 64
fi

session="$1"
data_url_file="$2"
url_selector="${3:-#agentImageUrl}"
load_button_selector="${4:-#agentLoadImageBtn}"

if [ ! -f "$data_url_file" ]; then
  echo "Data URL file not found: $data_url_file" >&2
  exit 66
fi

data_url="$(cat "$data_url_file")"
if [[ "$data_url" != data:image/* ]]; then
  echo "Data URL file does not start with data:image/: $data_url_file" >&2
  exit 65
fi

log_file="$(mktemp "${TMPDIR:-/tmp}/meme-opencli-fill.XXXXXX")"
{
  opencli browser "$session" fill "$url_selector" "$data_url"
  opencli browser "$session" click "$load_button_selector"
} > "$log_file"

printf '%s\n' "$log_file"
