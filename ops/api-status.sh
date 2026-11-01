#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"

pid_file="${VTL_RUN_DIR}/api.pid"
if [[ ! -e "${pid_file}" ]]; then
  printf 'API status: stopped (no PID file).\n'
  exit 0
fi

pid=""
IFS= read -r pid < "${pid_file}" || true
if [[ ! "${pid}" =~ ^[1-9][0-9]*$ ]] || ! kill -0 "${pid}" 2>/dev/null; then
  printf 'API status: stopped (stale PID file: %s).\n' "${pid_file}"
  exit 1
fi

set +e
vtl_pid_is_api_process "${pid}"
identity_status=$?
set -e
if (( identity_status == 2 )); then
  printf 'API status: unable to verify PID %s (platform lacks supported process identity checks).\n' "${pid}" >&2
  exit 2
elif (( identity_status != 0 )); then
  printf 'API status: PID file points to live unrelated process %s.\n' "${pid}" >&2
  exit 1
fi

if vtl_healthcheck 3; then
  printf 'API status: running and healthy (PID %s) at %s/healthz.\n' "${pid}" "${VTL_BASE_URL}"
  exit 0
fi
printf 'API status: unhealthy (managed process PID %s is alive, health check failed).\n' "${pid}" >&2
exit 1
