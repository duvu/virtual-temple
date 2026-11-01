#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"

pid_file="${VTL_RUN_DIR}/api.pid"
if [[ ! -e "${pid_file}" ]]; then
  printf 'API is stopped (no PID file).\n'
  exit 0
fi

pid=""
IFS= read -r pid < "${pid_file}" || true
if [[ ! "${pid}" =~ ^[1-9][0-9]*$ ]] || ! kill -0 "${pid}" 2>/dev/null; then
  rm -f -- "${pid_file}"
  printf 'Removed stale API PID file; API is stopped.\n'
  exit 0
fi

set +e
vtl_pid_is_api_process "${pid}"
identity_status=$?
set -e
if (( identity_status == 2 )); then
  printf 'Cannot inspect API PID %s on this platform; process left untouched.\n' "${pid}" >&2
  exit 2
elif (( identity_status != 0 )); then
  printf 'PID file points to live unrelated process %s; process left untouched.\n' "${pid}" >&2
  exit 1
fi

kill -TERM "${pid}"
for ((second = 0; second < 15; second++)); do
  if ! kill -0 "${pid}" 2>/dev/null; then
    rm -f -- "${pid_file}"
    printf 'Stopped managed API process %s.\n' "${pid}"
    exit 0
  fi
  sleep 1
done

if ! kill -0 "${pid}" 2>/dev/null; then
  rm -f -- "${pid_file}"
  printf 'Stopped managed API process %s.\n' "${pid}"
  exit 0
fi
printf 'Managed API process %s did not stop within 15 seconds; PID file retained.\n' "${pid}" >&2
exit 1
