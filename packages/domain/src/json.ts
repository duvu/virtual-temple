/** JSON-shaped domain data. Call assertJsonValue before passing untrusted or constructed values to serialization. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Throws when a value cannot be represented faithfully as JSON. */
export function assertJsonValue(value: unknown): asserts value is JsonValue {
  const active = new WeakSet<object>();

  function visit(current: unknown, path: string): void {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new TypeError(`Expected a finite number at ${path}`);
      return;
    }
    if (typeof current === 'undefined') throw new TypeError(`Unexpected undefined at ${path}`);
    if (typeof current === 'function') throw new TypeError(`Unexpected function at ${path}`);
    if (typeof current === 'symbol') throw new TypeError(`Unexpected symbol at ${path}`);
    if (typeof current === 'bigint') throw new TypeError(`Unexpected bigint at ${path}`);

    const object = current as object;
    if (active.has(object)) throw new TypeError(`Unexpected cycle at ${path}`);
    if (Object.getOwnPropertySymbols(object).length > 0) {
      throw new TypeError(`Unexpected symbol-keyed property at ${path}`);
    }

    active.add(object);
    try {
      if (Array.isArray(current)) {
        for (let index = 0; index < current.length; index += 1) {
          if (!(index in current)) throw new TypeError(`Unexpected array hole at ${path}[${index}]`);
          visit(current[index], `${path}[${index}]`);
        }
        return;
      }

      const prototype = Object.getPrototypeOf(object);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`Expected a plain object at ${path}`);
      }
      for (const key of Object.keys(current)) visit((current as Record<string, unknown>)[key], `${path}.${key}`);
    } finally {
      active.delete(object);
    }
  }

  visit(value, '$');
}
