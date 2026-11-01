#!/usr/bin/env bash
set -Eeuo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/lib/common.sh"

vtl_require_command node
export VTL_BASE_URL

node --input-type=module <<'NODE'
const baseUrl = process.env.VTL_BASE_URL;
const ERROR_BODY_LIMIT = 300;

function concise(value, limit = ERROR_BODY_LIMIT) {
  const text = String(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

async function request(method, path, body) {
  let response;
  let text;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    text = await response.text();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${method} ${path}: network failure (${concise(reason, 180)})`);
  }

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: concise(text) };
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} ${response.status} ${concise(JSON.stringify(data))}`);
  }
  return data;
}

function requireStringField(value, field, method, path) {
  if (!value || typeof value !== 'object' || typeof value[field] !== 'string' || value[field].length === 0) {
    throw new Error(`${method} ${path}: invalid response (missing ${field})`);
  }
  return value[field];
}

try {
  const channelPath = '/channels';
  const channel = await request('POST', channelPath, {
    name: 'Demo Channel',
    world: { name: 'Demo World' },
  });
  const channelId = requireStringField(channel, 'channelId', 'POST', channelPath);
  const runtimePath = `/channels/${encodeURIComponent(channelId)}/runtimes`;
  const runtime = await request('POST', runtimePath);
  const runtimeId = requireStringField(runtime, 'runtimeId', 'POST', runtimePath);
  const actionPath = `/runtimes/${encodeURIComponent(runtimeId)}/actions`;
  await request('POST', actionPath, { action: 'initialize' });
  await request('POST', actionPath, { action: 'start' });
  const finalPath = `/runtimes/${encodeURIComponent(runtimeId)}`;
  const finalRuntime = await request('GET', finalPath);
  const status = requireStringField(finalRuntime, 'status', 'GET', finalPath);

  console.log(JSON.stringify({
    note: 'Demo channel and runtime use ephemeral in-memory API state.',
    channelId,
    runtimeId,
    status,
  }, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Demo failed: ${concise(message)}`);
  process.exitCode = 1;
}
NODE
