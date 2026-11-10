/** Any value that can appear in a JSON document. */
export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

/** One entry of the repair log returned when `logging: true`. */
export interface RepairLogEntry {
    /** What was repaired. */
    text: string;
    /** The characters around the position where it happened. */
    context: string;
}

export interface RepairOptions {
    /** `true` returns a JavaScript value, `false` (default) returns a JSON string. */
    returnObjects?: boolean;
    /** Skip the initial `JSON.parse` attempt and always run the repair parser. */
    skipJsonParse?: boolean;
    /** Return `[value, logs]` instead of just the result. */
    logging?: boolean;
    /** Escape non-ASCII characters as `\uXXXX` in the returned JSON string (default `true`). */
    ensureAscii?: boolean;
}

export type LoadsOptions = Omit<RepairOptions, "returnObjects">;

/**
 * Repairs a broken JSON string, e.g. one produced by an LLM.
 *
 * - With `logging: true` it returns `[value, logs]` (the value is a JavaScript value).
 * - With `returnObjects: true` it returns the parsed value.
 * - Otherwise it returns the repaired JSON as a string.
 */
export function repairJson(jsonStr: string, options: RepairOptions & { logging: true }): [JsonValue, RepairLogEntry[]];
export function repairJson(jsonStr: string, options: RepairOptions & { returnObjects: true }): JsonValue;
export function repairJson(jsonStr?: string, options?: RepairOptions): string;

/** Like `JSON.parse`, but repairs broken JSON instead of throwing. */
export function loads<T = any>(jsonStr: string, options: LoadsOptions & { logging: true }): [T, RepairLogEntry[]];
export function loads<T = any>(jsonStr: string, options?: LoadsOptions): T;

/** Reads a file (UTF-8) and repairs its JSON. */
export function fromFile<T = any>(filename: string, options: LoadsOptions & { logging: true }): [T, RepairLogEntry[]];
export function fromFile<T = any>(filename: string, options?: LoadsOptions): T;
