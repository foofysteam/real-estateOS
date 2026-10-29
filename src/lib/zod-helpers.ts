import { z } from "zod";

/** "" or whitespace-only → undefined, so blank optional form fields count as absent. Other values pass through. */
export function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

/** An optional field where a blank string means "not given". */
export function blankAsAbsent<T extends z.ZodType>(schema: T) {
  return z.preprocess(emptyToUndefined, schema.optional());
}
