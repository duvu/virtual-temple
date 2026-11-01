#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"

pid_file="${VTL_RUN_DIR}/api.pid"
log_file="${VTL_RUN_DIR}/api.log"
pid_tmp=""
cleanup() {
  [[ -z "${pid_tmp}" ]] || rm -f -- "${pid_tmp}"
}
trap cleanup EXIT

umask 077
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

mkdir -p -- "${VTL_RUN_DIR}"
printf 'Building API workspace...\n'
(cd -- "${VTL_ROOT}" && pnpm build)

if [[ ! -f "${VTL_ROOT}/apps/api/dist/server.js" ]]; then
  printf 'API build did not produce apps/api/dist/server.js.\n' >&2
  exit 1
fi

pid_tmp="$(mktemp "${VTL_RUN_DIR}/api.pid.XXXXXXXX")"
cd -- "${VTL_ROOT}"
node apps/api/dist/server.js >>"${log_file}" 2>&1 </dev/null &
api_pid=$!
printf '%s\n' "${api_pid}" > "${pid_tmp}"
mv -f -- "${pid_tmp}" "${pid_file}"
pid_tmp=""

if vtl_wait_for_health 30 1; then
  printf 'API is healthy (PID %s) at %s/healthz. Log: %s\n' "${api_pid}" "${VTL_BASE_URL}" "${log_file}"
else
  printf 'Managed API process %s did not become healthy; inspect %s.\n' "${api_pid}" "${log_file}" >&2
  exit 1
fi
