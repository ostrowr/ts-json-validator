// A loose Typescript interpretation of the JSON spec from
// http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf

export type JsonValue =
  | JsonObject
  | JsonArray
  | JsonNumber
  | JsonString
  | JsonTrue
  | JsonFalse
  | JsonNull;
type JsonObject = { [k: string]: JsonValue };
type JsonArray = JsonValue[];
type JsonNumber = number;
type JsonString = string;
type JsonTrue = true;
type JsonFalse = false;
type JsonNull = null;


export const Type = {
  Array: () =>
}
