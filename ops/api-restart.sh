#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"

umask 077
mkdir -p -- "${VTL_RUN_DIR}"
vtl_require_command flock
exec 9>"${VTL_RUN_DIR}/api.lock"
if ! flock -n 9; then
  printf 'Another API start or stop operation is in progress.\n' >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
VTL_API_LOCK_HELD=1 "${script_dir}/api-stop.sh"
VTL_API_LOCK_HELD=1 "${script_dir}/api-start.sh"
