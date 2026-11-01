/** JSON-shaped domain data. Call assertJsonValue before passing untrusted or constructed values to serialization. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Throws when a value cannot be represented faithfully as JSON. */
export function assertJsonValue(value: unknown): asserts value is JsonValue {
  const active = new WeakSet<object>();

  function ownDataValue(object: object, key: string, path: string): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor === undefined) throw new TypeError(`Unexpected missing property ${key} at ${path}`);
    if (!descriptor.enumerable) throw new TypeError(`Unexpected non-enumerable property ${key} at ${path}`);
    if (!Object.hasOwn(descriptor, 'value')) throw new TypeError(`Unexpected accessor property ${key} at ${path}`);
    return descriptor.value as unknown;
  }

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
        for (const key of Object.getOwnPropertyNames(current)) {
          if (key === 'length') continue;
          const index = Number(key);
          const isCanonicalArrayIndex = /^(0|[1-9]\d*)$/.test(key)
            && Number.isInteger(index)
            && index < 0xffff_ffff
            && String(index) === key;
          if (!isCanonicalArrayIndex) throw new TypeError(`Unexpected array property ${key} at ${path}`);
          ownDataValue(current, key, path);
        }
        for (let index = 0; index < current.length; index += 1) {
          const key = String(index);
          if (!Object.hasOwn(current, key)) throw new TypeError(`Unexpected array hole at ${path}[${index}]`);
          visit(ownDataValue(current, key, path), `${path}[${index}]`);
        }
        return;
      }

      const prototype = Object.getPrototypeOf(object);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`Expected a plain object at ${path}`);
      }
      for (const key of Object.getOwnPropertyNames(current)) {
        visit(ownDataValue(current, key, path), `${path}.${key}`);
      }
    } finally {
      active.delete(object);
    }
  }

  visit(value, '$');
}
