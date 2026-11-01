#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=ops/lib/common.sh
source "${script_dir}/lib/common.sh"
cd -- "${VTL_ROOT}"

exec pnpm dev "$@"
