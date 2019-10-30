import Ajv from "ajv";

import { InternalTypeSymbol, JsonSchema, JsonValue } from "./json-spec";
const hiddenField = Symbol("SpecialTypeAnnotationFieldDoNotUse");

type TsjsonString<T> = string & {
  [hiddenField]: T extends JsonValue ? T : unknown;
};

export const TSJSON = {
  parse: <T>(input: TsjsonString<T>): T => JSON.parse(input),

  stringify: <T>(input: T): TsjsonString<T> =>
    JSON.stringify(input) as TsjsonString<T>
};

export type Validated<T extends JsonSchema> = T[typeof InternalTypeSymbol];

export class TsjsonParser<T extends JsonSchema> {
  public readonly schema: T;
  private readonly validator: Ajv.ValidateFunction;
  constructor(schema: T) {
    this.schema = schema;
    const ajv = new Ajv();
    this.validator = ajv.compile(schema);
  }

  public validate(data: unknown): asserts data is Validated<T> {
    const valid = this.validator(data);
    if (!valid) {
      throw new Error(JSON.stringify(this.validator.errors));
    }
  }

  public parse = (text: string, skipValidation = false): Validated<T> => {
    const data = JSON.parse(text);
    if (skipValidation) {
      return data;
    }
    this.validate(data);
    return data;
  };
}
