/**
 * BigInt/Decimal → number serialization helpers.
 *
 * Context: Prisma 7 with the `@prisma/adapter-pg` driver adapter can return
 * `BIGINT` and `NUMERIC` columns as `BigInt` and `Prisma.Decimal` JS types
 * respectively. Both fail `JSON.stringify`:
 *
 *   > TypeError: Do not know how to serialize a BigInt
 *   > TypeError: Converting circular structure to JSON
 *
 * `JSON.stringify(..., (_, v) => typeof v === 'bigint' ? v.toString() : v)`
 * is the standard workaround but emits **strings** on the wire, which the
 * Angular client then has to re-parse. The DTOs in this module are typed
 * with `number`, so we coerce eagerly to JS `number` instead.
 *
 * Centralizing the conversion in one place keeps the SQL→service→wire
 * path uniform: every method in `AnalyticsService` /
 * `AnalyticsQueryService` calls `serializeKpiRows` (or
 * `serializeDecimalField`) before returning, so a single audit point
 * covers all 12 endpoints.
 */

/**
 * Type guard for Prisma's Decimal. We accept any object exposing the
 * `toString()` contract Prisma.Decimal implements AND whose
 * `toString()` returns a numeric-looking string. The second check
 * prevents plain POJOs (e.g. a row object like
 * `{ toString: () => '49.97', precio: {…} }`) from being misclassified
 * as Decimal — without it, the entire row would be replaced with
 * `Number(row.toString())` = `NaN` and the row would surface as `null`.
 *
 * Avoids importing the Prisma.Decimal class directly to keep this
 * helper dependency-free.
 */
function isDecimalLike(value: unknown): value is { toString(): string } {
  if (typeof value !== 'object' || value === null) return false;
  const t = (value as { toString?: unknown }).toString;
  if (typeof t !== 'function') return false;
  // Sample the toString output. Prisma.Decimal returns "49.97",
  // "1234567890.123", "-1.5", etc. — a numeric string with an optional
  // sign + decimal point. We accept anything parseable as a finite
  // Number; reject dates ("2026-06-30T..." → NaN), arrays
  // ("1,2,3" → NaN), and the default Object.prototype.toString
  // ("[object Object]" → NaN).
  try {
    const sample = (value as { toString(): string }).toString();
    const n = Number(sample);
    return Number.isFinite(n);
  } catch {
    return false;
  }
}

/**
 * Convert a single value into its JSON-safe form:
 *   - BigInt → Number (assumed safe; analytics counts fit <2^53).
 *   - Decimal-like → Number via toString().
 *   - Date → ISO string (Prisma emits DateTime as Date objects in some
 *     code paths; JSON.stringify handles Date by default but doing it
 *     here keeps the contract explicit).
 *   - Arrays/objects → recurse.
 *   - everything else → passthrough.
 */
export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') {
    // Counts in the DW are <2^53 for any realistic source; the cast is
    // safe and matches the DTO contract (`type: Number`).
    return Number(value);
  }
  if (
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (isDecimalLike(value)) {
    // Prisma.Decimal.toString() returns the canonical numeric form,
    // e.g. "49.97". `Number(...)` then yields 49.97 — exactly the wire
    // shape the DTO declares (`type: Number`).
    const n = Number(value.toString());
    return Number.isFinite(n) ? n : null;
  }
  if (Array.isArray(value)) {
    const arr: unknown[] = value as unknown[];
    const out: unknown[] = [];
    for (const v of arr) {
      out.push(serializeValue(v));
    }
    return out;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value);
    for (const [k, v] of entries) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return value;
}

/**
 * Map over a `prisma.$queryRawUnsafe` result array, coercing every
 * BigInt/Decimal to a JS number. Returns a NEW array; the original
 * rows are untouched (callers can still log them if needed).
 *
 * Use this for every `$queryRawUnsafe` result that flows through the
 * analytics controllers so the JSON.stringify on the HTTP layer never
 * sees an unserializable value.
 *
 * The generic is bound by the caller — services typically do
 * `serializeKpiRows<PreguntaPrincipalRowDto>(rows)` so the return type
 * is correctly narrowed. Internally we walk each row through
 * `serializeValue` and rely on the cast back to `T` (the structural
 * shape of the row is preserved; we only swap BigInt→Number and
 * Decimal→Number inside the values).
 *
 * Accepts `readonly unknown[]` so the call site can pass either
 * `Record<string, unknown>[]` (typed Prisma raw results) or a typed DTO
 * array without a redundant cast.
 */
export function serializeKpiRows<T>(rows: readonly unknown[]): T[] {
  const out: T[] = [];
  for (const row of rows) {
    if (row === null || row === undefined) {
      out.push(row as T);
      continue;
    }
    out.push(serializeValue(row) as T);
  }
  return out;
}

/**
 * Serialize a single object (e.g. the one-row result of the snapshot
 * banner or the summary envelope). Same rules as `serializeKpiRows`.
 */
export function serializeKpiRow<T>(row: unknown): T {
  if (row === null || row === undefined) return row as T;
  return serializeValue(row) as T;
}
