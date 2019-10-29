import { TSJSON } from "./tsjson";

// test("Parsing without schema constraints", () => {
//   const parsed = TSJSON.parse("{}");
//   expect(parsed).toStrictEqual({});
// });

// test("Throw on invalid JSON", () => {
//   expect(() => TSJSON.parse("")).toThrow();
// });

test("Parse and serialize with type", () => {
  const toSerialize = { something: 1, somethingElse: "2" };
  const serialized = TSJSON.stringify(toSerialize); // serialized: TsjsonString<typeof toSerialize>
  const parsed = TSJSON.parse(serialized); // parsed: typeof toSerialize
  expect(parsed.something).toBe(1);
  expect(parsed.somethingElse).toBe("2");
});
