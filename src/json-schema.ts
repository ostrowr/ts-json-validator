// A loose Typescript interpretation of the JSON spec from
// http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf

export const InternalTypeSymbol = Symbol("InternalType");

export type JsonValue =
  | { [property: string]: JsonValue }
  | boolean
  | JsonValue[]
  | null
  | number
  | string;

// Given types T and U, return T transformed such that the fields in U are made required
type PartialRequire<T, U extends keyof T> = T & Required<Pick<T, U>>;

// Given a union type U, return the intersection of all its component types.
// For example, if U = A | B | C, then UnionToIntersection<U> = A & B & C.
// UnionToIntersection magic taken from https://stackoverflow.com/a/50375286/2407869
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnionToIntersection<U> = (U extends any
? (k: U) => void
: never) extends (k: infer I) => void
  ? I
  : never;

interface BaseJsonSchema {
  title?: string;
  description?: string;
}

interface StringOptions<EnumType extends string | undefined = undefined>
  extends BaseJsonSchema {
  enum?: readonly EnumType[];
  format?: string;
  maxLength?: string;
  minLength?: string;
  pattern?: string;
}

const stringConstructor = <T extends string>(
  options: StringOptions<T> = {}
) => {
  type internalType = typeof options.enum extends undefined ? string : T;
  return {
    type: "string" as const,
    ...options,
    [InternalTypeSymbol]: {} as internalType
  };
};

interface NumberOptions extends BaseJsonSchema {
  multipleOf?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  description?: string;
}

const numberConstructor = (options: NumberOptions = {}) => {
  return {
    type: "number" as const,
    ...options,
    [InternalTypeSymbol]: {} as number
  };
};

const integerConstructor = (options: NumberOptions = {}) => {
  return {
    type: "integer" as const,
    ...options,
    [InternalTypeSymbol]: {} as number
  };
};

interface ObjectOptions<
  Properties extends { [k: string]: JsonSchema },
  AdditionalProperties extends JsonSchema, // TODO support boolean
  RequiredProperties extends readonly (keyof Properties)[]
> extends BaseJsonSchema {
  properties?: Properties;
  additionalProperties?: AdditionalProperties;
  required: RequiredProperties; // mandatory for now, since leaving it empty is making all properties required
  propertyNames?: JsonSchema;
  minProperties?: number;
  maxProperties?: number;
  // dependencies?: any; // not yet supported
  patternProperties?: { [k: string]: JsonSchema };
}

const objectConstructor = <
  Properties extends { [k: string]: JsonSchema },
  AdditionalProperties extends JsonSchema, // TODO support boolean
  RequiredProperties extends readonly (keyof Properties)[]
>(
  options: ObjectOptions<Properties, AdditionalProperties, RequiredProperties>
) => {
  type internalPropertyTypes = PartialRequire<
    Partial<
      // optional by default
      { [P in keyof Properties]: Properties[P][typeof InternalTypeSymbol] }
    >,
    RequiredProperties[number]
  >;
  type additionalPropertyTypes = { [k: string]: AdditionalProperties };
  return {
    type: "object" as const,
    ...options,
    [InternalTypeSymbol]: {} as internalPropertyTypes & additionalPropertyTypes
  };
};

interface ArrayOptions<
  Items, // extends JsonSchema | readonly JsonSchema[],
  AdditionalItems extends Items extends JsonSchema // additionalItems doesn't make sense unless Items is a list
    ? never
    : JsonSchema // TOOD support boolean
> extends BaseJsonSchema {
  items?: Items;
  additionalItems?: AdditionalItems;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

const arrayConstructor = <
  Items extends JsonSchema | readonly JsonSchema[],
  AdditionalItems extends Items extends JsonSchema // additionalItems doesn't make sense unless Items is a list
    ? never
    : JsonSchema
>(
  options: ArrayOptions<Items, AdditionalItems> = {}
) => {
  type internalType = Items extends readonly JsonSchema[]
    ? Array<
        | Items[number][typeof InternalTypeSymbol]
        | AdditionalItems[typeof InternalTypeSymbol]
      > // this isn't strict enough, but I'm not sure if it's possible to improve this at the moment. // would be nicer to somehow concatenate the types, as in [exploded Items, ...AdditionalItems]
    : Items extends JsonSchema // not sure why this isn't inferred
    ? Items[typeof InternalTypeSymbol][]
    : never;
  return {
    type: "array" as const,
    ...options,
    [InternalTypeSymbol]: {} as internalType
  };
};

interface BooleanOptions extends BaseJsonSchema {}

const booleanConstructor = (options: BooleanOptions = {}) => {
  return {
    type: "boolean" as const,
    ...options,
    [InternalTypeSymbol]: {} as boolean
  };
};

interface NullOptions extends BaseJsonSchema {}

const nullConstructor = (options: NullOptions = {}) => {
  return {
    type: "null" as const,
    ...options,
    [InternalTypeSymbol]: ({} as unknown) as null
  };
};

interface AnyOfOptions<Schemas extends readonly JsonSchema[]>
  extends BaseJsonSchema {
  anyOf: Schemas;
}

// TODO: union of enum types not working for anyof/allof.
// I want
// typeof allOfConstructor({
//   allOf: [
//     Type.String({ enum: ["a", "b"] }),
//     Type.String({ enum: ["a", "b", "c"] })
//   ]
// })[InternalTypeSymbol];
// to be "a" | "b", but right now it's just string

const anyOfConstructor = <Schemas extends readonly JsonSchema[]>(
  options: AnyOfOptions<Schemas>
) => {
  return {
    ...options,
    [InternalTypeSymbol]: {} as typeof options.anyOf[number][typeof InternalTypeSymbol]
  };
};

interface AllOfOptions<Schemas extends readonly JsonSchema[]>
  extends BaseJsonSchema {
  allOf: Schemas;
}

const allOfConstructor = <Schemas extends readonly JsonSchema[]>(
  options: AllOfOptions<Schemas>
) => {
  return {
    ...options,
    [InternalTypeSymbol]: {} as UnionToIntersection<
      typeof options.allOf[number][typeof InternalTypeSymbol]
    >
  };
};

// TODO support oneOf
export interface InterfaceWithHiddenType {
  [InternalTypeSymbol]: unknown;
}

export interface JsonSchema extends InterfaceWithHiddenType {}

export const Schema = {
  String: stringConstructor,
  Number: numberConstructor,
  Integer: integerConstructor,
  Object: objectConstructor,
  Array: arrayConstructor,
  Boolean: booleanConstructor,
  Null: nullConstructor,
  AnyOf: anyOfConstructor,
  AllOf: allOfConstructor
};
