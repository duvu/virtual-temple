#!/usr/bin/env bash
set -Eeuo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"

vtl_require_command node
export VTL_BASE_URL

node --input-type=module <<'NODE'
const baseUrl = process.env.VTL_BASE_URL;

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text.slice(0, 300) };
  }
  if (!response.ok) {
    console.error(`${method} ${path} ${response.status} ${JSON.stringify(data)}`);
    process.exit(1);
  }
  return data;
}

const channel = await request('POST', '/channels', {
  name: 'Demo Channel',
  world: { name: 'Demo World' },
});
const runtime = await request('POST', `/channels/${encodeURIComponent(channel.channelId)}/runtimes`);
await request('POST', `/runtimes/${encodeURIComponent(runtime.runtimeId)}/actions`, { action: 'initialize' });
await request('POST', `/runtimes/${encodeURIComponent(runtime.runtimeId)}/actions`, { action: 'start' });
const finalRuntime = await request('GET', `/runtimes/${encodeURIComponent(runtime.runtimeId)}`);

console.log(JSON.stringify({
  note: 'Demo channel and runtime use ephemeral in-memory API state.',
  channelId: channel.channelId,
  runtimeId: runtime.runtimeId,
  status: finalRuntime.status,
}, null, 2));
NODE
