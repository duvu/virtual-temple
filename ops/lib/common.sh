# Shared operations helpers. Source this file; it intentionally performs no
# commands with side effects when loaded.

_vtl_common_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
VTL_ROOT="$(cd -- "${_vtl_common_dir}/../.." && pwd -P)"
unset _vtl_common_dir

_vtl_port_input="${PORT:-3000}"
if [[ ! "${_vtl_port_input}" =~ ^[0-9]+$ || ${#_vtl_port_input} -gt 5 ]] || (( 10#${_vtl_port_input} < 1 || 10#${_vtl_port_input} > 65535 )); then
  printf 'Invalid PORT: %s (expected an integer from 1 to 65535)\n' "${_vtl_port_input}" >&2
  return 2 2>/dev/null || exit 2
fi
VTL_PORT="$((10#${_vtl_port_input}))"
unset _vtl_port_input

VTL_BASE_URL="${VTL_BASE_URL:-http://127.0.0.1:${VTL_PORT}}"
while [[ "${VTL_BASE_URL}" == */ ]]; do
  VTL_BASE_URL="${VTL_BASE_URL%/}"
done
VTL_RUN_DIR="${VTL_RUN_DIR:-${VTL_ROOT}/.run}"

vtl_require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$1" >&2
    return 1
  fi
}

vtl_healthcheck() {
  local timeout="${1:-5}"
  if [[ ! "${timeout}" =~ ^[0-9]+$ || ${#timeout} -gt 2 ]]; then
    printf 'Health probe timeout must be an integer from 1 to 60 seconds.\n' >&2
    return 2
  fi
  while [[ ${#timeout} -gt 1 && "${timeout:0:1}" == 0 ]]; do timeout="${timeout:1}"; done
  if (( 10#${timeout} < 1 || 10#${timeout} > 60 )); then
    printf 'Health probe timeout must be an integer from 1 to 60 seconds.\n' >&2
    return 2
  fi
  vtl_require_command curl || return
  curl --fail --silent --show-error --output /dev/null --connect-timeout "${timeout}" --max-time "${timeout}" "${VTL_BASE_URL}/healthz"
}

vtl_wait_for_health() {
  local timeout="${1:-30}" interval="${2:-1}" deadline remaining probe_timeout sleep_for
  if [[ ! "${timeout}" =~ ^[0-9]+$ || ! "${interval}" =~ ^[0-9]+$ ]]; then
    printf 'Health timeout and interval must be integers.\n' >&2
    return 2
  fi
  while [[ ${#timeout} -gt 1 && "${timeout:0:1}" == 0 ]]; do timeout="${timeout:1}"; done
  while [[ ${#interval} -gt 1 && "${interval:0:1}" == 0 ]]; do interval="${interval:1}"; done
  if [[ ${#timeout} -gt 5 || ${#interval} -gt 4 ]] || (( 10#${timeout} > 86400 || 10#${interval} > 3600 )); then
    printf 'Health timeout must be 0 to 86400 seconds and interval 1 to 3600 seconds.\n' >&2
    return 2
  fi
  timeout="$((10#${timeout}))"
  interval="$((10#${interval}))"
  if (( interval < 1 )); then
    printf 'Health interval must be at least 1 second.\n' >&2
    return 2
  fi
  deadline=$((SECONDS + timeout))
  while :; do
    remaining=$((deadline - SECONDS))
    if (( remaining <= 0 )); then
      printf 'API health check timed out after %s seconds: %s/healthz\n' "${timeout}" "${VTL_BASE_URL}" >&2
      return 1
    fi
    probe_timeout="${remaining}"
    if (( probe_timeout > 5 )); then probe_timeout=5; fi
    if vtl_healthcheck "${probe_timeout}"; then
      return 0
    fi
    remaining=$((deadline - SECONDS))
    if (( remaining <= 0 )); then
      printf 'API health check timed out after %s seconds: %s/healthz\n' "${timeout}" "${VTL_BASE_URL}" >&2
      return 1
    fi
    sleep_for="${interval}"
    if (( sleep_for > remaining )); then sleep_for="${remaining}"; fi
    sleep "${sleep_for}"
  done
}

# True only for a live process whose working directory is this checkout and
# whose argv names this checkout's built API entrypoint.
vtl_pid_is_api_process() {
  local pid="${1:-}" cwd executable script
  local -a argv=()
  if (( BASH_VERSINFO[0] < 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] < 4) )) || [[ ! -d /proc ]]; then
    printf 'PID identity checks require Linux /proc and Bash 4.4 or newer.\n' >&2
    return 2
  fi
  [[ "${pid}" =~ ^[1-9][0-9]*$ ]] || return 1
  kill -0 "${pid}" 2>/dev/null || return 1
  [[ -r "/proc/${pid}/cmdline" && -r "/proc/${pid}/cwd" ]] || return 1
  cwd="$(readlink -f -- "/proc/${pid}/cwd" 2>/dev/null)" || return 1
  [[ "${cwd}" == "${VTL_ROOT}" ]] || return 1
  mapfile -d '' -t argv < "/proc/${pid}/cmdline" || return 1
  (( ${#argv[@]} >= 2 )) || return 1
  executable="${argv[0]##*/}"
  script="${argv[1]}"
  [[ ( "${executable}" == "node" || "${executable}" == "nodejs" ) && ( "${script}" == "${VTL_ROOT}/apps/api/dist/server.js" || "${script}" == "apps/api/dist/server.js" ) ]]
}

vtl_pid_file_is_api_process() {
  local pid_file="${1:-}"
  [[ -n "${pid_file}" && -f "${pid_file}" ]] || return 1
  local pid
  IFS= read -r pid < "${pid_file}" || [[ -n "${pid:-}" ]] || return 1
  vtl_pid_is_api_process "${pid}"
}
