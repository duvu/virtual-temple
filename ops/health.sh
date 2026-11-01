#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=ops/lib/common.sh
source "${script_dir}/lib/common.sh"
cd -- "${VTL_ROOT}"

if (( $# > 1 )); then
  printf 'Usage: %s [timeout-seconds]\n' "${0##*/}" >&2
  exit 2
fi

timeout="${1:-5}"
if [[ ! "${timeout}" =~ ^[0-9]+$ || ${#timeout} -gt 2 ]]; then
  printf 'Health probe timeout must be an integer from 1 to 60 seconds.\n' >&2
  exit 2
fi
while [[ ${#timeout} -gt 1 && "${timeout:0:1}" == 0 ]]; do timeout="${timeout:1}"; done
if (( 10#${timeout} < 1 || 10#${timeout} > 60 )); then
  printf 'Health probe timeout must be an integer from 1 to 60 seconds.\n' >&2
  exit 2
fi

url="${VTL_BASE_URL}/healthz"
if ! response="$(curl --silent --show-error --connect-timeout "${timeout}" --max-time "${timeout}" --write-out $'\nHTTP_STATUS:%{http_code}' "${url}")"; then
  printf 'Health request failed: %s\n' "${url}" >&2
  exit 1
fi

status="${response##*$'\n'HTTP_STATUS:}"
body="${response%$'\n'HTTP_STATUS:*}"
printf '%s\n' "${body}"
printf 'HTTP status: %s\n' "${status}"
if [[ ! "${status}" =~ ^2[0-9][0-9]$ ]]; then
  printf 'Health endpoint returned a non-success status: %s\n' "${url}" >&2
  exit 1
fi
