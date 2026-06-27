import { expect, test } from "vitest";
import { addKey, removeKey } from "@/lib/widgets/placement";

test("addKey appends once (idempotent), preserving order", () => {
  expect(addKey([], "a")).toEqual(["a"]);
  expect(addKey(["a"], "b")).toEqual(["a", "b"]);
  expect(addKey(["a", "b"], "a")).toEqual(["a", "b"]); // already present → unchanged
});

test("removeKey drops the key, no-op when absent", () => {
  expect(removeKey(["a", "b"], "a")).toEqual(["b"]);
  expect(removeKey(["a"], "z")).toEqual(["a"]);
});
