import { SchemaValidateFunction } from "ajv";

// A Typescript interpretation of the JSON spec from
// http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf

// ENFORCED indicates that the field is enforced by the type system, and it should be
// impossible for any type assignable to Validated<schema> to fail JSON validation because of constraints
// that this field introduces.
// For example, the `required` field on objects is ENFORCED because a type assignable to Validated<T>
// must have all fields marked `required`.

// PARTIALLY ENFORCED indicates that the field is partially enforced by the type system, but it may be possible
// to assign a type to Validated<schema> that does not validate.
// For example, arrays with the additionalItems parameter are PARTIALLY ENFORCED becuase (currently) every element
// in the validated type can be assigned to the additionalItems type, when only items after items.length should
// be validated against this schema.

// NOT ENFORCED indicates that the field is not enforced by the type system. This is either because it's impossible
// to do so efficiently given Typescript, or because I haven't figured out how yet. If the latter, hopefully I've
// included a comment.
// For example, the `pattern` constraint in a string type is NOT ENFORCED because there's no reasonable way to
// express a type that means "a string that matches this regex".

// NO ENFORCEMENT NEEDED means that this field does not add any constraints to a JSON schema so is essentially a comment.

// Symbol needed to compile a program that passes typechecking but still fails schema validation.
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
  title?: string; // NO ENFORCEMENT NEEDED
  description?: string; // NO ENFORCEMENT NEEDED
}

// The useful options assignable to a schema with {"type": "string"}
interface StringOptions<EnumType extends string | undefined = undefined>
  extends BaseJsonSchema {
  enum?: readonly EnumType[]; // ENFORCED
  format?: string; // NOT ENFORCED
  maxLength?: string; // NOT ENFORCED
  minLength?: string; // NOT ENFORCED
  pattern?: string; // NOT ENFORCED
}

/**
 * Create a schema that validates strings.
 *
 * If the `enum` property is specified, it will by typed as a union of these enum values.
 * @param options
 */
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
  multipleOf?: number; // NOT ENFORCED
  minimum?: number; // NOT ENFORCED
  exclusiveMinimum?: number; // NOT ENFORCED
  maximum?: number; // NOT ENFORCED
  exclusiveMaximum?: number; // NOT ENFORCED
  description?: string; // NO ENFORCEMENT NEEDED
}

/**
 * Create a schema that validates numbers.
 *
 * @param options
 */
const numberConstructor = (options: NumberOptions = {}) => {
  return {
    type: "number" as const,
    ...options,
    [InternalTypeSymbol]: {} as number
  };
};

/**
 * Create a schema that validates integers.
 *
 * @param options
 */
const integerConstructor = (options: NumberOptions = {}) => {
  return {
    type: "integer" as const,
    ...options,
    [InternalTypeSymbol]: {} as number
  };
};

interface ObjectOptions<
  Properties extends { [k: string]: JsonSchema },
  AdditionalProperties extends JsonSchema,
  RequiredProperties extends readonly (keyof Properties)[]
> extends BaseJsonSchema {
  properties?: Properties; // ENFORCED
  additionalProperties?: AdditionalProperties; // ENFORCED
  required: RequiredProperties; // ENFORCED; mandatory for now, since leaving it empty is making all properties required
  propertyNames?: JsonSchema; // NOT ENFORCED; could get to PARTIALLY ENFORCED if we support enums here, but no better.
  minProperties?: number; // NOT ENFORCED
  maxProperties?: number; // NOT ENFORCED
  // dependencies?: any; // not yet supported
  patternProperties?: { [k: string]: JsonSchema }; // NOT ENFORCED
}

/**
 * Create a schema that validates objects.
 *
 * The `properties` field defines the keys and schemas that these properties must conform to.
 * `requiredProperties` marks zero or more fields required.
 * `additionalProperties` marks the types of the fields not specified in properties.
 * @param options
 */
const objectConstructor = <
  Properties extends { [k: string]: JsonSchema },
  AdditionalProperties extends JsonSchema,
  RequiredProperties extends readonly (keyof Properties)[]
>(
  options: ObjectOptions<Properties, AdditionalProperties, RequiredProperties>
) => {
  type internalPropertyTypes = PartialRequire<
    Partial<
      // optional by default, unless explicitly in the required list
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
  Items extends JsonSchema | readonly JsonSchema[],
  AdditionalItems extends Items extends JsonSchema // additionalItems doesn't make sense unless Items is a list
    ? never
    : JsonSchema
> extends BaseJsonSchema {
  items?: Items; // PARTIALLY ENFORCED; ENFORCED if it's a single schema but only PARTIALLY ENFORCED if it's a list of schemas
  additionalItems?: AdditionalItems; // PARTIALLY ENFORCED; same reason as above
  minItems?: number; // NOT ENFORCED
  maxItems?: number; // NOT ENFORCED
  uniqueItems?: boolean; // NOT ENFORCED
}

/**
 * Create a schema that validates arrays.
 *
 * The type of the array is defined by the `items` parameter, which is either
 * a single JSON schema or a list of JSON schemas. If `items` is a single schema,
 * all members of the array must conform to that schema. If it's a list of schemas,
 * each member of the array must validate to its respective schema, and all remaining
 * members must validate to the schema in AdditionalItems.
 * @param options
 */
const arrayConstructor = <
  Items extends JsonSchema | readonly JsonSchema[],
  AdditionalItems extends Items extends JsonSchema ? never : JsonSchema
>(
  options: ArrayOptions<Items, AdditionalItems> = {}
) => {
  type internalType = Items extends readonly JsonSchema[]
    ? Array<
        | Items[number][typeof InternalTypeSymbol]
        | AdditionalItems[typeof InternalTypeSymbol]
      > // this isn't strict enough, but I'm not sure if it's possible to improve this at the moment. Would be nicer to somehow concatenate the types, as in [exploded Items, ...AdditionalItems]
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

/**
 * Create a schema that validates boolean values.
 *
 * @param options
 */
const booleanConstructor = (options: BooleanOptions = {}) => {
  return {
    type: "boolean" as const,
    ...options,
    [InternalTypeSymbol]: {} as boolean
  };
};

interface NullOptions extends BaseJsonSchema {}

/**
 * Create a schema that validates null values.
 *
 * @param options
 */
const nullConstructor = (options: NullOptions = {}) => {
  return {
    type: "null" as const,
    ...options,
    [InternalTypeSymbol]: ({} as unknown) as null
  };
};

interface AnyOfOptions<Schemas extends readonly JsonSchema[]>
  extends BaseJsonSchema {
  anyOf: Schemas; // ENFORCED
}

/**
 * Create a schema that validates if any schemas in its anyOf parameter validate.
 *
 * @param options
 */
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
  allOf: Schemas; // ENFORCED
}

/**
 * Create a schema that validates if all schemas in its allOf parameter validate.
 *
 * @param options
 */
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

type SimpleType =
  | "array"
  | "boolean"
  | "integer"
  | "null"
  | "number"
  | "object"
  | "string";

type ConstConstraint<
  Const extends JsonValue | undefined
> = Const extends JsonValue ? Const : unknown;

// type NotConstraint<Not extends JsonSchema | undefined> = Not extends JsonSchema ?

// Make it impossible to define an invalid schema, and also impossible to define a schema that just doesn't make sense
// (e.g. no reason to have a minimum constraint on a string.)
interface Schema<
  Type extends SimpleType | readonly SimpleType[] | undefined = undefined, // type can be either a single type or a list of types (TODO allow it to be a list of types)
  Properties extends { [k: string]: JsonSchema } | undefined = undefined,
  Items extends (JsonSchema | readonly JsonSchema[]) | undefined = undefined,
  AdditionalItems extends JsonSchema | undefined = undefined,
  AdditionalProperties extends JsonSchema | undefined = undefined,
  Required extends readonly (keyof Properties)[] | undefined = undefined,
  Const extends JsonValue | undefined = undefined, // TODO constrain to type
  Enum extends readonly JsonValue[] | undefined = undefined, // TODO constrain to type
  AllOf extends readonly JsonSchema[] | undefined = undefined,
  AnyOf extends readonly JsonSchema[] | undefined = undefined,
  OneOf extends readonly JsonSchema[] | undefined = undefined,
  Not extends JsonSchema | undefined = undefined,
  CalculatedType = unknown // where the magic happens
> {
  $id?: string; // adds no constraints, can be in any schema
  $schema?: "http://json-schema.org/draft-07/schema#"; // if you want to specify the schema, it's got to be draft-07 right now!
  // $ref?: string; // not yet supported
  $comment?: string; // adds no constraints, can be in any schema
  title?: string; // adds no constraints, can be in any schema
  description?: string; // adds no constraints, can be in any schema
  default?: CalculatedType;
  readOnly?: boolean;
  examples?: JsonValue[];
  multipleOf?: Type extends "number" | "integer" ? number : never; // only makes sense for number/integer types
  maximum?: Type extends "number" | "integer" ? number : never; // only makes sense for number/integer types
  exclusiveMaximum?: Type extends "number" | "integer" ? number : never; // only makes sense for number/integer types
  minimum?: Type extends "number" | "integer" ? number : never; // only makes sense for number/integer types
  exclusiveMinimum?: Type extends "number" | "integer" ? number : never; // only makes sense for number/integer types
  minLength?: Type extends "string" ? number : never; // only makes sense for string types
  maxLength?: Type extends "string" ? number : never; // only makes sense for string types
  pattern?: Type extends "string" ? string : never; // only makes sense for string types
  additionalItems?: Type extends "array" // only makes sense for array types
    ? Items extends JsonSchema // where the items field is not a single schema
      ? never
      : AdditionalItems
    : never;
  items?: Type extends "array" ? Items : never; // only makes sense for array types
  maxItems?: Type extends "array" ? number : never; // only makes sense for array types
  minItems?: Type extends "array" ? number : never; // only makes sense for array types
  uniqueItems?: Type extends "array" ? boolean : never; // only makes sense for array types
  contains?: Type extends "array" ? Schema : never; // only makes sense for array types
  maxProperties?: Type extends "object" ? number : never; // only makes sense for object types
  minProperties?: Type extends "object" ? number : never; // only makes sense for object types
  required?: Type extends "object" ? Required : never; // only makes sense for object types
  additionalProperties?: Type extends "object" ? AdditionalProperties : never; // only makes sense for object types
  // definitions?: TODO
  properties?: Type extends "object" ? Properties : never; // only makes sense for object types
  patternProperties?: Type extends "object" ? { [k: string]: Schema } : never; // only makes sense for object types
  // dependencies?: TODO
  propertyNames?: Type extends "object" ? Schema : never; // only makes sense for object types
  const?: Const;
  enum?: Enum;
  type?: Type;
  format?: Type extends "string" ? string : never; // only makes sense for string types
  contentMediaType?: Type extends "string" ? string : never;
  contentEncoding?: Type extends "string" ? string : never;
  // if?: Schema; // not yet supported
  // then?: Schema; // not yet supported
  // else?: Schema; // not yet supported
  allOf?: AllOf;
  anyOf?: AnyOf;
  oneOf?: OneOf;
  not?: Not;
  [InternalTypeSymbol]?: CalculatedType;
}

const createSchema = <
  Type extends SimpleType | undefined = undefined, // type can be either a single type or a list of types // TODO support type as SimpleType[]
  Properties extends
    | (Type extends "object" ? { [k: string]: JsonSchema } : never) // properties only makes sense if type is object
    | undefined = undefined,
  Items extends  // items only makes sense if type is "array"
    | (Type extends "array" ? JsonSchema | readonly JsonSchema[] : never)
    | undefined = undefined,
  AdditionalItems extends
    | (Type extends "array" // additionalItems only makes sense if type is array
        ? Items extends JsonSchema // and if Items is a list of schemas, not a single schema
          ? never
          : JsonSchema
        : never)
    | undefined = undefined,
  AdditionalProperties extends
    | (Type extends "object" ? JsonSchema : never) // additionalProperties only makes sense if type is object
    | undefined = undefined,
  Required extends
    | (Type extends "object" ? readonly (keyof Properties)[] : never) // required only makes sense if type is object
    | undefined = undefined,
  Const extends JsonValue | undefined = undefined, // TODO constrain to type
  Enum extends readonly JsonValue[] | undefined = undefined, // TODO constrain to type
  AllOf extends readonly JsonSchema[] | undefined = undefined,
  AnyOf extends readonly JsonSchema[] | undefined = undefined,
  OneOf extends readonly JsonSchema[] | undefined = undefined,
  Not extends JsonSchema | undefined = undefined
  // below here we just constrain to say "You shouldn't create a schema with a "
>(
  schema: Schema<
    Type,
    Properties,
    Items,
    AdditionalItems,
    AdditionalProperties,
    Required,
    Const,
    Enum,
    AllOf,
    AnyOf,
    OneOf,
    Not
  >
) => {
  type internalType = string;
  return {
    ...schema,
    [InternalTypeSymbol]: {} as internalType
  };
};
