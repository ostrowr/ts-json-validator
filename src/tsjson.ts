import { JsonValue } from "./json-spec";

const hiddenField = Symbol("SpecialTypeAnnotationFieldDoNotUse");

type TsjsonString<T> = string & {
  [hiddenField]: T extends JsonValue ? T : unknown;
};

export const TSJSON = {
  parse: <T>(input: TsjsonString<T>): T => JSON.parse(input),

  stringify: <T>(input: T): TsjsonString<T> =>
    JSON.stringify(input) as TsjsonString<T>
};
