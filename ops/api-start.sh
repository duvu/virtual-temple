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
log_file="${VTL_RUN_DIR}/api.log"
pid_tmp=""
cleanup() {
  [[ -z "${pid_tmp}" ]] || rm -f -- "${pid_tmp}"
}
trap cleanup EXIT

vtl_require_command pnpm
vtl_require_command node

if [[ -e "${pid_file}" ]]; then
  pid=""
  IFS= read -r pid < "${pid_file}" || true
  if [[ "${pid}" =~ ^[1-9][0-9]*$ ]] && kill -0 "${pid}" 2>/dev/null; then
    set +e
    vtl_pid_is_api_process "${pid}"
    identity_status=$?
    set -e
    if (( identity_status == 2 )); then
      printf 'Cannot inspect existing API PID %s on this platform; leaving it untouched.\n' "${pid}" >&2
      exit 2
    elif (( identity_status == 0 )); then
      printf 'API already has a managed process (PID %s).\n' "${pid}" >&2
      exit 1
    else
      printf 'Refusing to start: PID file points to live unrelated process %s.\n' "${pid}" >&2
      exit 1
    fi
  fi
  rm -f -- "${pid_file}"
fi

printf 'Building API workspace...\n'
(cd -- "${VTL_ROOT}" && pnpm build)

if [[ ! -f "${VTL_ROOT}/apps/api/dist/server.js" ]]; then
  printf 'API build did not produce apps/api/dist/server.js.\n' >&2
  exit 1
fi

pid_tmp="$(mktemp "${VTL_RUN_DIR}/api.pid.XXXXXXXX")"
cd -- "${VTL_ROOT}"
node apps/api/dist/server.js 9>&- >>"${log_file}" 2>&1 </dev/null &
api_pid=$!
printf '%s\n' "${api_pid}" > "${pid_tmp}"
mv -f -- "${pid_tmp}" "${pid_file}"
pid_tmp=""

if vtl_wait_for_health 30 1; then
  printf 'API is healthy (PID %s) at %s/healthz. Log: %s\n' "${api_pid}" "${VTL_BASE_URL}" "${log_file}"
  exit 0
fi

printf 'API process %s failed its health check; attempting to stop the managed child.\n' "${api_pid}" >&2
set +e
vtl_pid_is_api_process "${api_pid}"
identity_status=$?
set -e
if (( identity_status == 2 )); then
  printf 'Cannot verify PID %s on this platform; PID file and log retained for manual stop.\n' "${api_pid}" >&2
  exit 1
elif (( identity_status == 0 )); then
  # Recheck immediately before signaling to reduce the PID-reuse window.
  set +e
  vtl_pid_is_api_process "${api_pid}"
  identity_status=$?
  set -e
  if (( identity_status == 0 )); then
    if ! kill -TERM "${api_pid}"; then
      printf 'Could not TERM managed API child %s; PID file and log retained for manual stop.\n' "${api_pid}" >&2
      exit 1
    fi
  fi
fi

if (( identity_status != 0 )); then
  if ! kill -0 "${api_pid}" 2>/dev/null; then
    current_pid=""
    IFS= read -r current_pid < "${pid_file}" || true
    [[ "${current_pid}" != "${api_pid}" ]] || rm -f -- "${pid_file}"
    wait "${api_pid}" 2>/dev/null || true
    printf 'Unhealthy API child exited; removed its PID file. Log: %s\n' "${log_file}" >&2
    exit 1
  fi
  printf 'Cannot safely signal PID %s; PID file and log retained for manual stop.\n' "${api_pid}" >&2
  exit 1
fi

for ((second = 0; second < 15; second++)); do
  if ! kill -0 "${api_pid}" 2>/dev/null; then
    wait "${api_pid}" 2>/dev/null || true
    current_pid=""
    IFS= read -r current_pid < "${pid_file}" || true
    [[ "${current_pid}" != "${api_pid}" ]] || rm -f -- "${pid_file}"
    printf 'Unhealthy API child stopped; removed its PID file. Log: %s\n' "${log_file}" >&2
    exit 1
  fi
  sleep 1
done

if ! kill -0 "${api_pid}" 2>/dev/null; then
  wait "${api_pid}" 2>/dev/null || true
  current_pid=""
  IFS= read -r current_pid < "${pid_file}" || true
  [[ "${current_pid}" != "${api_pid}" ]] || rm -f -- "${pid_file}"
  printf 'Unhealthy API child stopped; removed its PID file. Log: %s\n' "${log_file}" >&2
  exit 1
fi
printf 'Unhealthy API child %s did not stop within 15 seconds; PID file and log retained for manual stop.\n' "${api_pid}" >&2
exit 1
