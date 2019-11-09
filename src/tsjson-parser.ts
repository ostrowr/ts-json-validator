import Ajv from "ajv";

import { InternalTypeSymbol, JsonValue, SchemaLike } from "./json-schema";
const hiddenField = Symbol("SpecialTypeAnnotationFieldDoNotUse");

type TsjsonString<T> = string & {
  [hiddenField]: T extends JsonValue ? T : unknown;
};

export const TSJSON = {
  parse: <T>(input: TsjsonString<T>): T => JSON.parse(input),

  stringify: <T>(input: T): TsjsonString<T> =>
    JSON.stringify(input) as TsjsonString<T>
};

export type Validated<T extends SchemaLike> = T[typeof InternalTypeSymbol];

export class TsjsonParser<T extends SchemaLike> {
  public readonly schema: T;
  private readonly validator: Ajv.ValidateFunction;
  constructor(schema: T) {
    this.schema = schema;
    const ajv = new Ajv();
    this.validator = ajv.compile(schema);
  }

  // call this to get the errors from the most recent validation call.
  public getErrors = () => this.validator.errors;

  public validates(data: unknown): data is Validated<T> {
    const valid = this.validator(data);
    if (!valid) {
      return false;
    }
    return true;
  }

  public parse = (text: string, skipValidation = false): Validated<T> => {
    const data: unknown = JSON.parse(text);
    if (skipValidation) {
      return data;
    }
    if (this.validates(data)) {
      return data;
    }
    throw new Error(JSON.stringify(this.validator.errors));
  };
}
