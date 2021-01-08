import Ajv from "ajv";

import { createSchema as S, JsonValue } from "./json-schema";
import { TSJSON, TsjsonParser, Validated } from "./tsjson-parser";

const SAMPLE_STRING_1 =
  "Baseball is ninety percent mental and the other half is physical.";

// Sanity-check to make sure the type compatible with what we expect.
// should eventually use something stricter like `tsd` but I'd probably have to roll my own to
// get it to work for this use case.
// eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
const expectType = <T>(_: T) => {};

const ajv = new Ajv();

describe("Sanity-checks:", () => {
  test("Parse and serialize with type", () => {
    const toSerialize = { something: 1, somethingElse: "2" };
    const serialized = TSJSON.stringify(toSerialize); // serialized: TsjsonString<typeof toSerialize>
    const parsed = TSJSON.parse(serialized); // parsed: typeof toSerialize
    expectType<typeof toSerialize>(parsed);
    expect(parsed.something).toBe(1);
    expect(parsed.somethingElse).toBe("2");
  });

  test("A string is a valid schema", () => {
    const parser = new TsjsonParser(S({ type: "string" }));
    const parsed = parser.parse(JSON.stringify(SAMPLE_STRING_1));
    expectType<string>(parsed);
    expect(parsed).toBe(SAMPLE_STRING_1);
    expect(parser.schema).toMatchObject({ type: "string" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("Enums convert to union types", () => {
    const parser = new TsjsonParser(
      S({ type: "string", enum: ["a", "b", "c"] as const })
    );
    expect(() => parser.parse(JSON.stringify(SAMPLE_STRING_1))).toThrow();
    const parsed = parser.parse(JSON.stringify("a"));
    expectType<"a" | "b" | "c">(parsed);
    expect(parsed).toBe("a");
    expect(parser.schema).toMatchObject({
      type: "string",
      enum: ["a", "b", "c"],
    });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("A number is a valid schema", () => {
    const parser = new TsjsonParser(S({ type: "number" }));
    const parsed = parser.parse(JSON.stringify(42));
    expectType<number>(parsed);
    expect(parsed).toBe(42);
    expect(parser.schema).toMatchObject({ type: "number" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("An integer is a valid schema", () => {
    const parser = new TsjsonParser(S({ type: "integer" }));
    const parsed = parser.parse(JSON.stringify(42));
    expectType<number>(parsed);
    expect(parsed).toBe(42);
    expect(parser.schema).toMatchObject({ type: "integer" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("Null is a valid schema", () => {
    const parser = new TsjsonParser(S({ type: "null" }));
    const parsed = parser.parse(JSON.stringify(null));
    expectType<null>(parsed);
    expect(parsed).toBe(null);
    expect(parser.schema).toMatchObject({ type: "null" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("A boolean is a valid schema", () => {
    const parser = new TsjsonParser(S({ type: "boolean" }));
    const parsed = parser.parse(JSON.stringify(true));
    expect(parsed).toBe(true);
    expectType<boolean>(parsed);
    expect(parser.schema).toMatchObject({ type: "boolean" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("Validation that doesn't appear in types is still respected", () => {
    const parser = new TsjsonParser(S({ type: "number", minimum: 3 }));
    expect(() => parser.parse(JSON.stringify(2))).toThrow();
    const parsed = parser.parse(JSON.stringify(3));
    expectType<number>(parsed);
    expect(parsed).toBe(3);
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("An empty array is a valid schema", () => {
    const parser = new TsjsonParser(S({ type: "array" }));
    const parsed = parser.parse(JSON.stringify([]));
    expect(parsed).toStrictEqual([]);
    expectType<unknown[]>(parsed);
    expect(parser.schema).toMatchObject({
      type: "array",
    });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("An object is a valid schema", () => {
    const parser = new TsjsonParser(S({ type: "object", required: [] }));
    const parsed = parser.parse(JSON.stringify({}));
    expect(parsed).toStrictEqual({});
    expectType<{ [x: string]: unknown }>(parsed);
    expect(parser.schema).toMatchObject({ type: "object" });
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("AnyOf works with simple schemas", () => {
    const parser = new TsjsonParser(
      S({
        anyOf: [S({ type: "string" }), S({ type: "number" })],
      })
    );
    let parsed = parser.parse(JSON.stringify(SAMPLE_STRING_1));
    expectType<string | number>(parsed);
    expect(parsed).toBe(SAMPLE_STRING_1);
    parsed = parser.parse(JSON.stringify(42));
    expect(parsed).toBe(42);
    expect(() => parser.parse(JSON.stringify({}))).toThrow();
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("AllOf works with simple schemas", () => {
    const parser = new TsjsonParser(
      S({
        allOf: [
          S({
            type: "object",
            properties: {
              a: S({ type: "string", enum: ["a", "b", "c"] as const }),
              b: S({ type: "number" }),
              d: S({ type: "number" }),
            },
            required: [],
          }),
          S({
            type: "object",
            properties: {
              a: S({ type: "string" }),
              c: S({ type: "string" }),
              d: S({ type: "string" }),
            },
            required: ["a"],
          }),
        ],
      })
    );
    const parsed = parser.parse(JSON.stringify({ a: "a" }));
    expectType<{ a: "a" | "b" | "c"; b?: number; c?: string; d?: never }>(
      parsed
    );
    expect(parsed).toStrictEqual({ a: "a" });
    expect(() => parser.parse(JSON.stringify({}))).toThrow();
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("Ensure validate is not called if skipValidation is true", () => {
    const parser = new TsjsonParser(S({ type: "null" }));
    const spy = jest.spyOn(parser, "validates");
    const parsed = parser.parse(JSON.stringify(null));
    expectType<null>(parsed);
    expect(parsed).toBe(null);
    expect(spy).toBeCalledTimes(1);
    parser.parse(JSON.stringify(null), true);
    expect(spy).toBeCalledTimes(1);
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("SkipValidation is dangerous", () => {
    const parser = new TsjsonParser(S({ type: "null" }));
    const parsed = parser.parse(JSON.stringify(SAMPLE_STRING_1), true);
    expectType<null>(parsed); // typeof parsed === null, which is wrong!
    expect(parsed).toBe(SAMPLE_STRING_1);
    expect(parser.validates(parsed)).toBe(false);
    expect(ajv.validateSchema(parser.schema)).toBe(true);
  });

  test("Invalid schema fails validation", () => {
    expect(ajv.validateSchema({ type: "invalid" })).toBe(false);
  });
});

describe("More involved tests with arrays", () => {
  test("Array of objects", () => {
    const parser = new TsjsonParser(
      S({
        type: "array",
        items: S({ type: "object", properties: { a: S({ type: "string" }) } }),
      })
    );

    const toParse = [{ a: "1" }, { a: "2" }, {}] as const;
    const parsed = parser.parse(JSON.stringify(toParse));
    expectType<{ a?: string }[]>(parsed);
    expect(parsed).toStrictEqual(toParse);
  });

  test("Array of required objects", () => {
    const parser = new TsjsonParser(
      S({
        type: "array",
        items: S({
          type: "object",
          properties: { a: S({ type: "string" }) },
          required: ["a"],
        }),
      })
    );

    const toParseInvalid = [{ a: "1" }, { a: "2" }, {}] as const;
    expect(() => parser.parse(JSON.stringify(toParseInvalid))).toThrow();
    const toParseValid = [{ a: "1" }, { a: "2" }] as const;
    const parsed = parser.parse(JSON.stringify(toParseValid));
    expectType<{ a: string }[]>(parsed);
    expect(parsed).toStrictEqual(toParseValid);
  });

  test("Arrays of arrays", () => {
    const parser = new TsjsonParser(
      S({
        type: "array",
        items: S({
          type: "array",
          items: S({ type: "array", items: S({ type: "number" }) }),
        }),
      })
    );

    const toParse = [[[0]], [], [[1]], [[1], [2], []]] as const;
    const parsed = parser.parse(JSON.stringify(toParse));
    expectType<Array<Array<Array<number>>>>(parsed);
    expect(parsed).toStrictEqual(toParse);

    const toFail = [[[0]], [], [[1]], [[1], [2], 0]] as const;
    expect(() => parser.parse(JSON.stringify(toFail))).toThrow();
  });

  test("Array with additionalItems", () => {
    const parser = new TsjsonParser(
      S({
        type: "array",
        items: [S({ type: "string" })],
        additionalItems: S({ type: "number" }),
      })
    );

    const toParse = ["1", 2, 3, 4] as const;
    const parsed = parser.parse(JSON.stringify(toParse));
    expectType<Array<string | number>>(parsed); // this type should really be [string, ...number]
    expect(parsed).toStrictEqual(toParse);

    const toFail = [1, "2"] as const; // this will pass typechecking even though it will fail validation!
    expect(() => parser.parse(JSON.stringify(toFail))).toThrow();
  });
});

describe("More involved tests with objects", () => {
  test("Object with various fields", () => {
    const parser = new TsjsonParser(
      S({
        type: "object",
        properties: {
          a: S({ type: "array" }),
          b: S({ type: "array" }),
          c: S({ type: "object" }),
          d: S({ type: "object" }),
          e: S({ type: "string" }),
          f: S({ type: "number" }),
        },
        additionalProperties: S({ type: "number" }),
        required: ["a", "c", "e"] as const,
      })
    );

    const toParse = {
      a: [],
      b: [1, "a", 4],
      c: { hello: 123 },
      e: "thisisastring",
    } as const;

    const parsed = parser.parse(JSON.stringify(toParse));
    expectType<
      | { [k: string]: number }
      | {
          a: unknown[];
          b?: unknown[];
          c: { [k: string]: unknown };
          d?: { [k: string]: unknown };
          e: string;
          f?: number;
        }
    >(parsed);
    expect(parsed).toStrictEqual(toParse);

    expectType<unknown[]>(parsed.a);
    expectType<{ [k: string]: unknown } | undefined>(parsed.d);
    expectType<number>(parsed.anotherProp);

    const toFail = {};
    expect(() => parser.parse(JSON.stringify(toFail))).toThrow();
  });
});

describe("additionalProperties", () => {
  describe("false", () => {
    test("no properties", () => {
      const schema = S({
        type: "object",
        additionalProperties: S(false),
      });

      const parser = new TsjsonParser(schema, {
        removeAdditional: true,
      });

      const parsed = parser.parse(
        JSON.stringify({
          someAdditionalProperty: "some value",
        })
      );
      expectType<Record<string, unknown>>(parsed);
      expectType<never>(parsed.someAdditionalProperty);
      expect(parsed).toStrictEqual({});

      expectType<Validated<typeof schema>>({});
    });

    test("one optional property", () => {
      const schema = S({
        type: "object",
        properties: {
          optionalProperty: S({ type: "string" }),
        },
        additionalProperties: S(false),
      });

      const parser = new TsjsonParser(schema, {
        removeAdditional: true,
      });

      const parsedWithOptionalProperty = parser.parse(
        JSON.stringify({
          optionalProperty: "some value",
          someAdditionalProperty: "some value",
        })
      );
      expectType<string | undefined>(
        parsedWithOptionalProperty.optionalProperty
      );
      expectType<never>(parsedWithOptionalProperty.someAdditionalProperty);
      expect(parsedWithOptionalProperty).toEqual({
        optionalProperty: "some value",
      });

      const parsedWithNoProperties = parser.parse(JSON.stringify({}));
      expectType<Record<string, never>>(parsedWithNoProperties);
      expectType<never>(parsedWithNoProperties.someAdditionalProperty);
      expect(parsedWithNoProperties).toEqual({});

      expectType<Validated<typeof schema>>({});

      // TODO(microsoft/TypeScript#17867) these would be ideal, but they're blocked by a Typescript limitation
      // expectType<Validated<typeof schema>>({
      //   optionalProperty: "string"
      // });
    });

    test("one required property", () => {
      const schema = S({
        type: "object",
        properties: {
          requiredProperty: S({ type: "string" }),
        },
        additionalProperties: S(false),
        required: ["requiredProperty"],
      });

      const parser = new TsjsonParser(schema, {
        removeAdditional: true,
      });

      const parsedWithOptionalProperty = parser.parse(
        JSON.stringify({
          requiredProperty: "some value",
          someAdditionalProperty: "some value",
        })
      );
      expectType<string>(parsedWithOptionalProperty.requiredProperty);
      expectType<never>(parsedWithOptionalProperty.someAdditionalProperty);
      expect(parsedWithOptionalProperty).toEqual({
        requiredProperty: "some value",
      });

      expect(() => {
        parser.parse(JSON.stringify({}));
      }).toThrowError();

      // TODO(microsoft/TypeScript#17867) these would be ideal, but they're blocked by a Typescript limitation
      // expectType<Validated<typeof schema>>({
      //   requiredProperty: "some value"
      // });
    });
  });

  describe("true", () => {
    test("no properties", () => {
      const schema = S({
        type: "object",
        additionalProperties: S(true),
      });

      const parser = new TsjsonParser(schema, {
        removeAdditional: true,
      });

      const parsed = parser.parse(
        JSON.stringify({
          someAdditionalProperty: "some value",
        })
      );
      expect(parsed).toStrictEqual({
        someAdditionalProperty: "some value",
      });

      expectType<Validated<typeof schema>>({});
      expectType<Validated<typeof schema>>({
        someAdditionalProperty: "some string",
        anotherAdditionalProperty: 1,
      });
    });

    test("one optional property", () => {
      const schema = S({
        type: "object",
        properties: {
          optionalProperty: S({ type: "string" }),
        },
        additionalProperties: S(true),
      });

      const parser = new TsjsonParser(schema, {
        removeAdditional: true,
      });

      const parsedWithOptionalProperty = parser.parse(
        JSON.stringify({
          optionalProperty: "some value",
          someAdditionalProperty: "some value",
        })
      );
      expectType<string | undefined>(
        parsedWithOptionalProperty.optionalProperty
      );
      expect(parsedWithOptionalProperty).toEqual({
        optionalProperty: "some value",
        someAdditionalProperty: "some value",
      });

      const parsedWithNoProperties = parser.parse(JSON.stringify({}));
      expectType<Record<string, unknown>>(parsedWithNoProperties);
      expectType<string | undefined>(parsedWithNoProperties.optionalProperty);
      expect(parsedWithNoProperties).toEqual({});

      expectType<Validated<typeof schema>>({});
      expectType<Validated<typeof schema>>({
        optionalProperty: "string",
      });
      expectType<Validated<typeof schema>>({
        optionalProperty: "string",
        someAdditionalProperty: "some string",
        anotherAdditionalProperty: 1,
      });
      expectType<Validated<typeof schema>>({
        someAdditionalProperty: "some string",
        anotherAdditionalProperty: 1,
      });
    });

    test("one required property", () => {
      const schema = S({
        type: "object",
        properties: {
          requiredProperty: S({ type: "string" }),
        },
        additionalProperties: S(true),
        required: ["requiredProperty"],
      });

      const parser = new TsjsonParser(schema, {
        removeAdditional: true,
      });

      const parsedWithOptionalProperty = parser.parse(
        JSON.stringify({
          requiredProperty: "some value",
          someAdditionalProperty: "some value",
        })
      );
      expectType<string>(parsedWithOptionalProperty.requiredProperty);
      expect(parsedWithOptionalProperty).toEqual({
        requiredProperty: "some value",
        someAdditionalProperty: "some value",
      });

      expect(() => {
        parser.parse(JSON.stringify({}));
      }).toThrowError();

      expectType<Validated<typeof schema>>({
        requiredProperty: "some value",
      });
      expectType<Validated<typeof schema>>({
        requiredProperty: "string",
        someAdditionalProperty: "some string",
        anotherAdditionalProperty: 1,
      });
    });
  });

  describe("some schema", () => {
    test("no properties", () => {
      const schema = S({
        type: "object",
        additionalProperties: S({ type: "number" }),
      });

      const parser = new TsjsonParser(schema, {
        removeAdditional: true,
      });

      const parsed = parser.parse(
        JSON.stringify({
          someAdditionalProperty: 10,
        })
      );
      expectType<number>(parsed.someAdditionalProperty);
      expect(parsed).toStrictEqual({
        someAdditionalProperty: 10,
      });

      expectType<Validated<typeof schema>>({});
      expectType<Validated<typeof schema>>({
        someAdditionalProperty: 10,
        anotherAdditionalProperty: 42,
      });
    });

    test("one optional property", () => {
      const schema = S({
        type: "object",
        properties: {
          optionalProperty: S({ type: "string" }),
        },
        additionalProperties: S({ type: "number" }),
      });

      const parser = new TsjsonParser(schema, {
        removeAdditional: true,
      });

      const parsedWithOptionalProperty = parser.parse(
        JSON.stringify({
          optionalProperty: "some value",
          someAdditionalProperty: 10,
        })
      );
      expectType<string | undefined>(
        parsedWithOptionalProperty.optionalProperty
      );
      expectType<number>(parsedWithOptionalProperty.someAdditionalProperty);
      expect(parsedWithOptionalProperty).toEqual({
        optionalProperty: "some value",
        someAdditionalProperty: 10,
      });

      const parsedWithNoProperties = parser.parse(JSON.stringify({}));
      expectType<Record<string, unknown>>(parsedWithNoProperties);
      expectType<string | undefined>(parsedWithNoProperties.optionalProperty);
      expectType<number>(parsedWithNoProperties.someAdditionalProperty);
      expect(parsedWithNoProperties).toEqual({});

      expectType<Validated<typeof schema>>({});
      expectType<Validated<typeof schema>>({
        someAdditionalProperty: 10,
        anotherAdditionalProperty: 42,
      });

      // TODO(microsoft/TypeScript#17867) these would be ideal, but they're blocked by a Typescript limitation
      // expectType<Validated<typeof schema>>({
      //   optionalProperty: "string"
      // });
      // expectType<Validated<typeof schema>>({
      //   optionalProperty: "string"
      //   someAdditionalProperty: 10,
      //   anotherAdditionalProperty: 42
      // });
    });

    test("one required property", () => {
      const schema = S({
        type: "object",
        properties: {
          requiredProperty: S({ type: "string" }),
        },
        additionalProperties: S({ type: "number" }),
        required: ["requiredProperty"],
      });

      const parser = new TsjsonParser(schema, {
        removeAdditional: true,
      });

      const parsedWithOptionalProperty = parser.parse(
        JSON.stringify({
          requiredProperty: "some value",
          someAdditionalProperty: 10,
        })
      );
      expectType<string>(parsedWithOptionalProperty.requiredProperty);
      expectType<number>(parsedWithOptionalProperty.someAdditionalProperty);
      expect(parsedWithOptionalProperty).toEqual({
        requiredProperty: "some value",
        someAdditionalProperty: 10,
      });

      expect(() => {
        parser.parse(JSON.stringify({}));
      }).toThrowError();

      // TODO(microsoft/TypeScript#17867) these would be ideal, but they're blocked by a Typescript limitation
      // expectType<Validated<typeof schema>>({
      //   requiredProperty: "some value"
      // });
      // expectType<Validated<typeof schema>>({
      //   requiredProperty: "string",
      //   someAdditionalProperty: 10,
      //   anotherAdditionalProperty: 42
      // });
    });
  });
});

describe("Odd combinations of things", () => {
  test("Enum without type", () => {
    const parser = new TsjsonParser(S({ enum: [1, "2", { x: "y" }] as const }));
    const toParse = { x: "y" };
    const parsed = parser.parse(JSON.stringify(toParse));
    expectType<1 | "2" | { x: "y" }>(parsed);
    expect(parsed).toStrictEqual(toParse);
  });

  test("Const object", () => {
    const parser = new TsjsonParser(S({ const: { a: 3 } as const }));
    const toParse = { a: 3 };
    const parsed = parser.parse(JSON.stringify(toParse));
    expectType<{ a: 3 }>(parsed);
    expect(parsed).toStrictEqual(toParse);
    const toFail = { a: 4 };
    expect(() => parser.parse(JSON.stringify(toFail))).toThrow();
  });

  test("Const array", () => {
    const parser = new TsjsonParser(S({ const: ["a", 1] as const }));
    const toParse = ["a", 1];
    const parsed = parser.parse(JSON.stringify(toParse));
    expectType<readonly ["a", 1]>(parsed);
    expect(parsed).toStrictEqual(toParse);
    const toFail = ["a"];
    expect(() => parser.parse(JSON.stringify(toFail))).toThrow();
  });

  test("AllOf and anyOf", () => {
    const parser = new TsjsonParser(
      S({
        anyOf: [
          S({ type: "string", enum: ["a", "b", "c"] as const }),
          S({ type: "string", enum: ["a", "b", "d"] as const }),
        ],

        // allOf: [S({ type: "string", enum: ["a", "d"] as const })] // is currently deriving a never type, which is wrong
        allOf: [S({ type: "string" })],
      })
    );
    const parsed = parser.parse(JSON.stringify("a"));

    expectType<"a" | "b" | "c" | "d">(parsed);
    expect(parsed).toBe("a");
  });

  test("Subschemas without type inherit type", () => {
    const parser = new TsjsonParser(
      S({
        type: "string",
        anyOf: [
          S({ enum: ["a"] as const }),
          S({ description: "unconstrained" }),
        ],
      })
    );

    const parsed = parser.parse(JSON.stringify("z"));
    expectType<string>(parsed);

    expect(parsed).toBe("z");
  });
});

describe("Schema with if/then/else", () => {
  const parser = new TsjsonParser(
    S({
      type: "object",
      properties: {
        country: S({ type: "string", enum: ["US", "CA"] as const }),
      },
      required: ["country"],
      if: S({
        type: "object",
        properties: {
          country: S({ const: "US" }),
        },
      }),
      then: S({
        type: "object",
        properties: {
          zipcode: S({ type: "number" }),
        },
        required: ["zipcode"],
      }),
      else: S({
        type: "object",
        properties: {
          postal_code: S({ type: "string" }),
        },
        required: ["postal_code"],
      }),
    })
  );

  test("if then", () => {
    const toParse = { country: "US", zipcode: 90210 };
    const parsed = parser.parse(JSON.stringify(toParse));
    expectType<{
      country: "US" | "CA";
      zipcode?: number;
      postal_code?: string;
    }>(parsed);
    expect(parsed).toStrictEqual(toParse);
    expect(() => parser.parse(JSON.stringify({ country: "US" }))).toThrow();
    expect(() =>
      parser.parse(JSON.stringify({ country: "US", zipcode: "90210" }))
    ).toThrow();
  });

  test("if else", () => {
    const toParse = { country: "CA", postal_code: "E0J 1V0" };
    const parsed = parser.parse(JSON.stringify(toParse));
    expectType<{
      country: "US" | "CA";
      zipcode?: number;
      postal_code?: string;
    }>(parsed);
    expect(parsed).toStrictEqual(toParse);
    expect(() => parser.parse(JSON.stringify({ country: "CA" }))).toThrow();
    expect(() =>
      parser.parse(JSON.stringify({ country: "CA", postal_code: 12345 }))
    ).toThrow();
  });
});

describe("Ref tests", () => {
  // Hope to be able to delete this test soon, and also maybe enforce that every ref
  // points to a depencency (but TBD whether this is actually desired, since refs can be valid outside of the schema)
  // Example taken from https://json-schema.org/understanding-json-schema/structuring.html
  test("Any ref is unknown :( ", () => {
    const parser = new TsjsonParser(
      S({
        $schema: "http://json-schema.org/draft-07/schema#",

        definitions: {
          person: S({
            type: "object",
            properties: {
              name: S({ type: "string" }),
              children: S({
                type: "array",
                items: S({ $ref: "#/definitions/person" }),
                default: [],
              }),
            },
          }),
        },

        type: "object",

        properties: {
          person: S({ $ref: "#/definitions/person" }),
        },
      })
    );
    const toParse = {
      person: {
        name: "Elizabeth",
        children: [
          {
            name: "Charles",
            children: [
              {
                name: "William",
                children: [{ name: "George" }, { name: "Charlotte" }],
              },
              {
                name: "Harry",
              },
            ],
          },
        ],
      },
    };

    const parsed = parser.parse(JSON.stringify(toParse));
    expectType<{ [k: string]: unknown } & { person?: unknown }>(parsed);
    expect(parsed).toStrictEqual(toParse);
  });
});

describe("true/false schemas", () => {
  test("true schema can parse anything", () => {
    const parser = new TsjsonParser(S(true));
    const parsed = parser.parse(JSON.stringify("z"));
    expectType<JsonValue>(parsed);
    expect(parsed).toBe("z");
  });

  test("false schema always fails", () => {
    const parser = new TsjsonParser(S(false));
    expect(() => parser.parse(JSON.stringify("z"))).toThrow();
  });
});

describe("Get errors", () => {
  test("Parser can get null errors", () => {
    const parser = new TsjsonParser(S(false));
    expect(parser.getErrors()).toBeNull();
  });

  test("Parser can get legitimate errors", () => {
    const parser = new TsjsonParser(S(false));
    expect(() => parser.parse(JSON.stringify("z"))).toThrow();
    expect(parser.getErrors()).toHaveLength(1);
  });
});

// checking that we can export schemas and parsers without warnings
export const schemaToExport = S({
  type: "string",
  enum: ["askjdh", "askjdh2"] as const,
});

export const parserToExport = new TsjsonParser(schemaToExport);
