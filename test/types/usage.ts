import { repairJson, loads, fromFile, JsonValue, RepairLogEntry } from "../../src";

// repairJson: string by default, value with returnObjects, tuple with logging
const asString: string = repairJson("{a: 1}");
const asStringExplicit: string = repairJson("{a: 1}", { returnObjects: false, ensureAscii: false });
const asValue: JsonValue = repairJson("{a: 1}", { returnObjects: true });
const [value, logs]: [JsonValue, RepairLogEntry[]] = repairJson("{a: 1}", { logging: true });
logs.forEach((entry) => entry.text.toUpperCase() + entry.context);

// loads: any by default, generic when asked
const anything = loads("{a: 1}");
anything.whatever.you.like;
const typed = loads<{ a: number }>("{a: 1}");
const n: number = typed.a;
const [tv, tl] = loads<{ a: number }>("{a: 1}", { logging: true });
tv.a + tl.length;

const fromDisk = fromFile<string[]>("x.json", { skipJsonParse: true });
fromDisk.map((s) => s.length);

// These must NOT compile
// @ts-expect-error returnObjects is not an option of loads
loads("{}", { returnObjects: false });
// @ts-expect-error string required
repairJson(123);
// @ts-expect-error a plain string is not a value
const bad: string = repairJson("{}", { returnObjects: true });

export { asString, asStringExplicit, asValue, value, n, bad };
