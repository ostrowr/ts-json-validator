import Ajv from "ajv";

import { Schema } from "./json-schema";
import { TSJSON, TsjsonParser } from "./tsjson-parser";

const SAMPLE_STRING_1 =
  "Baseball is ninety percent mental and the other half is physical.";

const ajv = new Ajv();

describe("Sanity-checks:", () => {
  test("Parse and serialize with type", () => {
    const toSerialize = { something: 1, somethingElse: "2" };
    const serialized = TSJSON.stringify(toSerialize); // serialized: TsjsonString<typeof toSerialize>
    const parsed = TSJSON.parse(serialized); // parsed: typeof toSerialize
    expect(parsed.something).toBe(1);
    expect(parsed.somethingElse).toBe("2");
  });

  test("A string is a valid schema", () => {
    const parser = new TsjsonParser(Schema.String());
    const parsed = parser.parse(JSON.stringify(SAMPLE_STRING_1)); // typeof parsed === string
    expect(parsed).toBe(SAMPLE_STRING_1);
    expect(parser.schema).toMatchObject({ type: "string" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("Enums convert to union types", () => {
    const parser = new TsjsonParser(Schema.String({ enum: ["a", "b", "c"] }));
    expect(() => parser.parse(JSON.stringify(SAMPLE_STRING_1))).toThrow();
    const parsed = parser.parse(JSON.stringify("a")); // typeof parsed === "a" | "b" | "c"
    expect(parsed).toBe("a");
    expect(parser.schema).toMatchObject({
      type: "string",
      enum: ["a", "b", "c"]
    });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("A number is a valid schema", () => {
    const parser = new TsjsonParser(Schema.Number());
    const parsed = parser.parse(JSON.stringify(42)); // typeof parsed === number
    expect(parsed).toBe(42);
    expect(parser.schema).toMatchObject({ type: "number" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("An integer is a valid schema", () => {
    const parser = new TsjsonParser(Schema.Integer());
    const parsed = parser.parse(JSON.stringify(42)); // typeof parsed === number
    expect(parsed).toBe(42);
    expect(parser.schema).toMatchObject({ type: "integer" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("Null is a valid schema", () => {
    const parser = new TsjsonParser(Schema.Null());
    const parsed = parser.parse(JSON.stringify(null));
    expect(parsed).toBe(null);
    expect(parser.schema).toMatchObject({ type: "null" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("A boolean is a valid schema", () => {
    const parser = new TsjsonParser(Schema.Boolean());
    const parsed = parser.parse(JSON.stringify(true));
    expect(parsed).toBe(true);
    expect(parser.schema).toMatchObject({ type: "boolean" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("Validation that doesn't appear in types is still respected", () => {
    const parser = new TsjsonParser(Schema.Number({ minimum: 3 }));
    expect(() => parser.parse(JSON.stringify(2))).toThrow();
    const parsed = parser.parse(JSON.stringify(3));
    expect(parsed).toBe(3);
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("An empty array is a valid schema", () => {
    const parser = new TsjsonParser(Schema.Array());
    const parsed = parser.parse(JSON.stringify([])); // typeof parsed = unknown[]
    expect(parsed).toStrictEqual([]);
    expect(parser.schema).toMatchObject({
      type: "array"
    });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("An object is a valid schema", () => {
    const parser = new TsjsonParser(Schema.Object({ required: [] }));
    const parsed = parser.parse(JSON.stringify({})); // typeof parsed = {[x: string]: unknown}
    expect(parsed).toStrictEqual({});
    expect(parser.schema).toMatchObject({ type: "object" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("AnyOf works with simple schemas", () => {
    const parser = new TsjsonParser(
      Schema.AnyOf({
        anyOf: [Schema.String(), Schema.Number()]
      })
    );
    let parsed = parser.parse(JSON.stringify(SAMPLE_STRING_1)); // typeof parsed === string | number
    expect(parsed).toBe(SAMPLE_STRING_1);
    parsed = parser.parse(JSON.stringify(42));
    expect(parsed).toBe(42);
    expect(() => parser.parse(JSON.stringify({}))).toThrow();
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("AllOf works with simple schemas", () => {
    const parser = new TsjsonParser(
      Schema.AllOf({
        allOf: [
          Schema.Object({
            properties: {
              a: Schema.String(),
              b: Schema.Number()
            },
            required: []
          }),
          Schema.Object({
            properties: {
              a: Schema.String(),
              c: Schema.String()
            },
            required: ["a"]
          })
        ]
      })
    );
    const parsed = parser.parse(JSON.stringify({ a: "hello" })); // typeof parsed === {a: string, b?: string, c?: string}
    expect(parsed).toStrictEqual({ a: "hello" });
    expect(() => parser.parse(JSON.stringify({}))).toThrow();
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("Ensure validate is not called if skipValidation is true", () => {
    /* eslint-disable @typescript-eslint/unbound-method */
    const parser = new TsjsonParser(Schema.Null());
    parser.validate = jest.fn();
    const parsed = parser.parse(JSON.stringify(null));
    expect(parsed).toBe(null);
    expect(parser.validate).toBeCalledTimes(1);
    parser.parse(JSON.stringify(null), true);
    expect(parser.validate).toBeCalledTimes(1);
    expect(ajv.validateSchema(parser.schema)).toBe(true);
    /* eslint-enable @typescript-eslint/unbound-method */
  });

  test("SkipValidation is dangerous", () => {
    const parser = new TsjsonParser(Schema.Null());
    const parsed = parser.parse(JSON.stringify(SAMPLE_STRING_1), true); // typeof parsed === null, which is wrong!
    expect(parsed).toBe(SAMPLE_STRING_1);
    expect(() => parser.validate(parsed)).toThrow();
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("Invalid schema fails validation", () => {
    expect(ajv.validateSchema({ type: "invalid" })).toBe(false);
  });
});
