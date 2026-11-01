#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"

umask 077
mkdir -p -- "${VTL_RUN_DIR}"
vtl_require_command flock
if [[ "${VTL_API_LOCK_HELD:-0}" == 1 ]]; then
  expected_lock="$(readlink -m -- "${VTL_RUN_DIR}/api.lock")"
  inherited_lock="$(readlink -f -- /proc/self/fd/9 2>/dev/null || true)"
  if [[ "${inherited_lock}" != "${expected_lock}" ]] || ! flock -n 9; then
    printf 'Cannot reuse the API lifecycle lock inherited from restart.\n' >&2
    exit 1
  fi
else
  exec 9>"${VTL_RUN_DIR}/api.lock"
  if ! flock -n 9; then
    printf 'Another API start or stop operation is in progress.\n' >&2
    exit 1
  fi
fi

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

# Revalidate immediately before signaling to reduce the PID-reuse window.
set +e
vtl_pid_is_api_process "${pid}"
identity_status=$?
set -e
if (( identity_status == 2 )); then
  printf 'Cannot recheck API PID %s on this platform; process left untouched.\n' "${pid}" >&2
  exit 2
elif (( identity_status != 0 )); then
  printf 'API PID %s changed identity before TERM; process left untouched.\n' "${pid}" >&2
  exit 1
fi
if ! kill -TERM "${pid}"; then
  printf 'Could not TERM managed API process %s; PID file retained.\n' "${pid}" >&2
  exit 1
fi
for ((second = 0; second < 15; second++)); do
  if ! kill -0 "${pid}" 2>/dev/null; then
    current_pid=""
    IFS= read -r current_pid < "${pid_file}" || true
    [[ "${current_pid}" != "${pid}" ]] || rm -f -- "${pid_file}"
    printf 'Stopped managed API process %s.\n' "${pid}"
    exit 0
  fi
  sleep 1
done

if ! kill -0 "${pid}" 2>/dev/null; then
  current_pid=""
  IFS= read -r current_pid < "${pid_file}" || true
  [[ "${current_pid}" != "${pid}" ]] || rm -f -- "${pid_file}"
  printf 'Stopped managed API process %s.\n' "${pid}"
  exit 0
fi
printf 'Managed API process %s did not stop within 15 seconds; PID file retained.\n' "${pid}" >&2
exit 1
