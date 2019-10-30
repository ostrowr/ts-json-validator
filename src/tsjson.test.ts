import { Type } from "./json-spec";
import { TSJSON, TsjsonParser } from "./tsjson";

const SAMPLE_STRING_1 =
  "Baseball is ninety percent mental and the other half is physical.";

test("Parse and serialize with type", () => {
  const toSerialize = { something: 1, somethingElse: "2" };
  const serialized = TSJSON.stringify(toSerialize); // serialized: TsjsonString<typeof toSerialize>
  const parsed = TSJSON.parse(serialized); // parsed: typeof toSerialize
  expect(parsed.something).toBe(1);
  expect(parsed.somethingElse).toBe("2");
});

test("A string is a valid schema", () => {
  const parser = new TsjsonParser(Type.String());
  const parsed = parser.parse(JSON.stringify(SAMPLE_STRING_1)); // typeof parsed === string
  expect(parsed).toBe(SAMPLE_STRING_1);
  expect(parser.schema).toMatchObject({ type: "string" });
});

test("Enums convert to union types", () => {
  const parser = new TsjsonParser(Type.String({ enum: ["a", "b", "c"] }));
  expect(() => parser.parse(JSON.stringify(SAMPLE_STRING_1))).toThrow();
  const parsed = parser.parse(JSON.stringify("a")); // typeof parsed === "a" | "b" | "c"
  expect(parsed).toBe("a");
  expect(parser.schema).toMatchObject({
    type: "string",
    enum: ["a", "b", "c"]
  });
});

test("A number is a valid schema", () => {
  const parser = new TsjsonParser(Type.Number());
  const parsed = parser.parse(JSON.stringify(42)); // typeof parsed === number
  expect(parsed).toBe(42);
  expect(parser.schema).toMatchObject({ type: "number" });
});

test("An integer is a valid schema", () => {
  const parser = new TsjsonParser(Type.Integer());
  const parsed = parser.parse(JSON.stringify(42)); // typeof parsed === number
  expect(parsed).toBe(42);
  expect(parser.schema).toMatchObject({ type: "integer" });
});

test("Null is a valid schema", () => {
  const parser = new TsjsonParser(Type.Null());
  const parsed = parser.parse(JSON.stringify(null));
  expect(parsed).toBe(null);
  expect(parser.schema).toMatchObject({ type: "null" });
});

test("A boolean is a valid schema", () => {
  const parser = new TsjsonParser(Type.Boolean());
  const parsed = parser.parse(JSON.stringify(true));
  expect(parsed).toBe(true);
  expect(parser.schema).toMatchObject({ type: "boolean" });
});

test("Validation that doesn't appear in types is still respected", () => {
  const parser = new TsjsonParser(Type.Number({ minimum: 3 }));
  expect(() => parser.parse(JSON.stringify(2))).toThrow();
  const parsed = parser.parse(JSON.stringify(3));
  expect(parsed).toBe(3);
});

// test("Array is valid schema", () => {
//   const parser = new TsjsonParser(Type.Array());
//   const parsed = parser.parse(JSON.stringify([]));
//   expect(parsed).toStrictEqual([]);
//   expect(parser.schema).toMatchObject({type: "array"})
// });

// test("Object is valid schema", () => {
//   const parser = new TsjsonParser(Type.Object());
//   const parsed = parser.parse(JSON.stringify({}));
//   expect(parsed).toStrictEqual({});
//   expect(parser.schema).toMatchObject({type: "object"})
// });

test("Ensure validate is not called if skipValidation is true", () => {
  /* eslint-disable @typescript-eslint/unbound-method */
  const parser = new TsjsonParser(Type.Null());
  parser.validate = jest.fn();
  const parsed = parser.parse(JSON.stringify(null));
  expect(parsed).toBe(null);
  expect(parser.validate).toBeCalledTimes(1);
  parser.parse(JSON.stringify(null), true);
  expect(parser.validate).toBeCalledTimes(1);
  /* eslint-enable @typescript-eslint/unbound-method */
});

test("skipValidation is dangerous", () => {
  const parser = new TsjsonParser(Type.Null());
  const parsed = parser.parse(JSON.stringify(SAMPLE_STRING_1), true); // typeof parsed === null, which is wrong!
  expect(parsed).toBe(SAMPLE_STRING_1);
  expect(() => parser.validate(parsed)).toThrow();
});
