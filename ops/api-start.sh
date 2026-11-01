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
api_pid=""
startup_cleanup_armed=1
cleanup() {
  if [[ -n "${pid_tmp}" && -e "${pid_tmp}" ]]; then
    if [[ -z "${api_pid}" ]] || ! kill -0 "${api_pid}" 2>/dev/null; then
      rm -f -- "${pid_tmp}"
    fi
  fi
}
trap cleanup EXIT

publish_startup_pid() {
  local current_pid=""
  if [[ -e "${pid_file}" ]]; then
    IFS= read -r current_pid < "${pid_file}" || true
    if [[ "${current_pid}" == "${api_pid}" ]]; then
      return 0
    fi
    printf 'Cannot publish managed PID %s because %s now contains another PID.\n' "${api_pid}" "${pid_file}" >&2
    return 1
  fi
  if [[ -z "${pid_tmp}" ]]; then
    pid_tmp="$(mktemp "${VTL_RUN_DIR}/api.pid.XXXXXXXX")"
  fi
  printf '%s\n' "${api_pid}" > "${pid_tmp}"
  mv -f -- "${pid_tmp}" "${pid_file}"
  pid_tmp=""
}

startup_job_is_running() {
  local candidate
  local -a running_jobs=()
  mapfile -t running_jobs < <(jobs -pr)
  for candidate in "${running_jobs[@]}"; do
    [[ "${candidate}" != "${1}" ]] || return 0
  done
  return 1
}

clear_exited_startup_child() {
  local current_pid=""
  wait "${api_pid}" 2>/dev/null || true
  IFS= read -r current_pid < "${pid_file}" || true
  [[ "${current_pid}" != "${api_pid}" ]] || rm -f -- "${pid_file}"
  [[ -z "${pid_tmp}" ]] || rm -f -- "${pid_tmp}"
  pid_tmp=""
}

cleanup_startup_child() {
  local identity_status attempt second
  local -a startup_jobs=()
  if [[ -z "${api_pid}" ]]; then
    # Bash records the async job before delivering a pending trap, even if it
    # arrives in the small interval before the following `$!` assignment.
    mapfile -t startup_jobs < <(jobs -pr)
    if (( ${#startup_jobs[@]} == 1 )) && [[ "${startup_jobs[0]}" =~ ^[1-9][0-9]*$ ]]; then
      api_pid="${startup_jobs[0]}"
    fi
  fi
  if [[ -z "${api_pid}" ]]; then
    return 0
  fi

  # Only signal a PID Bash still recognizes as this script's running job.
  # During fork/exec, retry /proc identity briefly while checking ownership.
  for ((attempt = 0; attempt < 5; attempt++)); do
    if ! startup_job_is_running "${api_pid}"; then
      clear_exited_startup_child
      return 0
    fi
    set +e
    vtl_pid_is_api_process "${api_pid}"
    identity_status=$?
    set -e
    (( identity_status == 0 )) && break
    sleep 0.1
  done

  if ! startup_job_is_running "${api_pid}"; then
    clear_exited_startup_child
    return 0
  fi

  # Even if /proc is not ready yet, the exact PID is still a running direct
  # background child in this shell's job table, so TERM cannot target a stale
  # $! value or an unrelated process.
  if ! kill -TERM "${api_pid}"; then
    if ! startup_job_is_running "${api_pid}"; then
      clear_exited_startup_child
      return 0
    fi
    printf 'Could not TERM directly owned startup child %s.\n' "${api_pid}" >&2
    publish_startup_pid || true
    return 1
  fi

  for ((second = 0; second < 15; second++)); do
    if ! startup_job_is_running "${api_pid}"; then
      clear_exited_startup_child
      return 0
    fi
    sleep 1
  done

  if ! startup_job_is_running "${api_pid}"; then
    clear_exited_startup_child
    return 0
  fi
  if ! publish_startup_pid; then
    printf 'Startup child %s remains alive; PID file/temp state retained for manual stop.\n' "${api_pid}" >&2
    return 1
  fi
  printf 'Startup child %s did not stop within 15 seconds; PID file and log retained for manual stop.\n' "${api_pid}" >&2
  return 1
}

handle_startup_signal() {
  local signal="$1" signal_status
  case "${signal}" in
    INT) signal_status=130 ;;
    TERM) signal_status=143 ;;
    HUP) signal_status=129 ;;
    *) signal_status=1 ;;
  esac
  trap '' INT TERM HUP
  if (( startup_cleanup_armed )); then
    cleanup_startup_child || true
  fi
  exit "${signal_status}"
}
trap 'handle_startup_signal INT' INT
trap 'handle_startup_signal TERM' TERM
trap 'handle_startup_signal HUP' HUP

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
  startup_cleanup_armed=0
  trap - INT TERM HUP
  printf 'API is healthy (PID %s) at %s/healthz. Log: %s\n' "${api_pid}" "${VTL_BASE_URL}" "${log_file}"
  exit 0
fi

trap '' INT TERM HUP
printf 'API process %s failed its health check; attempting to stop the managed child.\n' "${api_pid}" >&2
cleanup_startup_child || true
exit 1
