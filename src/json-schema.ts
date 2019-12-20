// A Typescript interpretation of the JSON spec from
// http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf

// ENFORCED (💪) indicates that the field is enforced by the type system, and it should be impossible for any type
// assignable to T to fail JSON validation because of constraints that this field introduces.
// For example, the required field on objects is ENFORCED because a type assignable to T is guaranteed to contain all
// fields marked required.

// PARTIALLY ENFORCED (🔓) indicates that the field is partially enforced by the type system, but it may be possible
// to assign a type to T that fails validation against s.
// For example, arrays with the additionalItems parameter are PARTIALLY ENFORCED becuase (currently) every element in
// the validated type can be assigned to the additionalItems type, when only items after items.length should be
// validated against this schema.

// NOT ENFORCED (⚠️) indicates that the field is not enforced by the type system. This is either because it's
// impossible to do so efficiently given Typescript, or because I haven't figured out how yet.
// If the latter, hopefully I've included a comment.

// For example, the pattern constraint in a string type is NOT ENFORCED because there's no reasonable way to express a
// type that means "a string that matches this regex".

// NO ENFORCEMENT NEEDED (🤷) (means that this field does not add any constraints to a JSON schema so is essentially a
// comment.

// NOT SUPPORTED (❌) means you can't currently define a TsjsonSchema that includes this validation keyword :(

// Symbol needed to compile a program that passes typechecking but still fails schema validation.
// This would be much nicer as a unique symbol but we run into issues exporting schemas
// when we do that. Ideas welcome!
export const InternalTypeSymbol = "#__internaltype__#";

export type JsonValue =
  | { [property: string]: JsonValue }
  | boolean
  | readonly JsonValue[]
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

export interface SchemaLike {
  [InternalTypeSymbol]: unknown;
}

type SimpleType =
  | "array"
  | "boolean"
  | "integer"
  | "null"
  | "number"
  | "object"
  | "string";

// If a const field is specified, then the value must be exactly that type.
// Otherwise, it can be any valid JSON value.
type ConstConstraint<
  Const extends JsonValue | undefined
> = Const extends JsonValue ? Const : unknown; // Could possibly replace all these unknows with JsonValues, but it makes the derived types annoying.

type SimpleTypeConstraint<
  Type extends SimpleType | undefined
> = Type extends "array"
  ? Array<JsonValue>
  : Type extends "boolean"
  ? boolean
  : Type extends "integer" | "number"
  ? number
  : Type extends "null"
  ? null
  : Type extends "object"
  ? { [k: string]: unknown }
  : Type extends "string"
  ? string
  : unknown;

type EnumConstraint<
  Enum extends readonly JsonValue[] | undefined
> = Enum extends readonly JsonValue[] ? Enum[number] : unknown;

// optional by default, unless explicitly in the required list
type PropertiesConstraint<
  Properties extends { [k: string]: SchemaLike } | undefined,
  Required extends readonly (keyof Properties)[] | undefined
> = Properties extends { [k: string]: SchemaLike }
  ? Required extends readonly (keyof Properties)[]
    ? PartialRequire<
        Partial<
          { [P in keyof Properties]: Properties[P][typeof InternalTypeSymbol] }
        >,
        Required[number]
      >
    : Partial<
        // optional by default, unless explicitly in the required list
        { [P in keyof Properties]: Properties[P][typeof InternalTypeSymbol] }
      >
  : unknown;

type AdditionalPropertiesConstraint<
  AdditionalProperties extends SchemaLike | undefined
> = AdditionalProperties extends SchemaLike
  ? { [k: string]: AdditionalProperties[typeof InternalTypeSymbol] }
  : unknown;

// if items is a schema, then every element conforms to it.
// If items is a list, then either additionalItems is supplied, in which case every element is either one of items[number] or additionalItems
// or additionalItems is not supplied, in which case we just get the union of all item types.
// These isn't strict enough; instead of Items[number], it would be better to have [...Items, *AdditionalItems]
// since when items are specified in a list, ordering is important.
type ItemsConstraint<
  Items extends (SchemaLike | readonly SchemaLike[]) | undefined,
  AdditionalItems extends SchemaLike | undefined
> = Items extends SchemaLike
  ? Array<Items[typeof InternalTypeSymbol]>
  : Items extends readonly SchemaLike[]
  ? AdditionalItems extends SchemaLike //
    ? Array<
        | Items[number][typeof InternalTypeSymbol]
        | AdditionalItems[typeof InternalTypeSymbol]
      >
    : Array<Items[number][typeof InternalTypeSymbol]>
  : unknown;

type AllOfConstraint<
  AllOf extends readonly SchemaLike[] | undefined
> = AllOf extends readonly SchemaLike[]
  ? UnionToIntersection<AllOf[number][typeof InternalTypeSymbol]>
  : unknown;

type AnyOfConstraint<
  AnyOf extends readonly SchemaLike[] | undefined
> = AnyOf extends readonly SchemaLike[]
  ? AnyOf[number][typeof InternalTypeSymbol]
  : unknown;

// This isn't strict enough; should be XOR instead of Or
type OneOfConstraint<
  OneOf extends readonly SchemaLike[] | undefined
> = AnyOfConstraint<OneOf>;

// If both `then` and `else` are specified, then we know that the type must be either Then or Else.
// If only one or 0 are specified, we don't know which one the `if` matched, so we don't add any constraints.
type IfThenElseConstraint<
  Then extends SchemaLike | undefined,
  Else extends SchemaLike | undefined
> = Then extends SchemaLike
  ? Else extends SchemaLike
    ? Then[typeof InternalTypeSymbol] | Else[typeof InternalTypeSymbol]
    : unknown
  : unknown;

// Make it impossible to define an invalid schema, and also impossible to define a schema that just doesn't make sense
// (e.g. no reason to have a minimum constraint on a string.)
interface Schema<
  Type extends SimpleType | undefined = undefined, // type can be either a single type or a list of types (TODO allow it to be a list of types) (| readonly SimpleType[])
  Properties extends { [k: string]: SchemaLike } | undefined = undefined,
  Items extends (SchemaLike | readonly SchemaLike[]) | undefined = undefined,
  AdditionalItems extends SchemaLike | undefined = undefined,
  AdditionalProperties extends SchemaLike | undefined = undefined,
  Required extends readonly (keyof Properties)[] | undefined = undefined,
  Const extends JsonValue | undefined = undefined,
  Enum extends readonly JsonValue[] | undefined = undefined,
  AllOf extends readonly SchemaLike[] | undefined = undefined,
  AnyOf extends readonly SchemaLike[] | undefined = undefined,
  OneOf extends readonly SchemaLike[] | undefined = undefined,
  Not extends SchemaLike | undefined = undefined, // not yet enforced
  If extends SchemaLike | undefined = undefined,
  Then extends SchemaLike | undefined = undefined,
  Else extends SchemaLike | undefined = undefined,
  Definitions extends { [k: string]: SchemaLike } | undefined = undefined, // not yet enforced via refs
  Ref extends string | undefined = undefined, // ref just gives unknown types for now. TODO: connect with definitions and get proper recursive types here.
  Dependencies extends
    | { [k in keyof Properties]: SchemaLike | keyof Properties[] }
    | undefined = undefined,
  CalculatedType = ConstConstraint<Const> &
    SimpleTypeConstraint<Type> &
    EnumConstraint<Enum> &
    PropertiesConstraint<Properties, Required> &
    AdditionalPropertiesConstraint<AdditionalProperties> &
    ItemsConstraint<Items, AdditionalItems> &
    AllOfConstraint<AllOf> &
    AnyOfConstraint<AnyOf> &
    OneOfConstraint<OneOf> &
    IfThenElseConstraint<Then, Else>
> {
  $id?: string; // 🤷 adds no constraints, can be in any schema.
  $schema?: "http://json-schema.org/draft-07/schema#"; // 🤷 if you want to specify the schema, it's got to be draft-07 right now!
  $ref?: Ref; // ⚠️ not yet enforced. Going to have to try to figure out how to do this without breaking semantics.
  $comment?: string; // 🤷 adds no constraints, can be in any schema
  title?: string; // 🤷 adds no constraints, can be in any schema
  description?: string; // 🤷 adds no constraints, can be in any schema
  default?: CalculatedType; // 💪 Can only be assigned types that the rest of the schema validates
  readOnly?: boolean; // 🤷
  examples?: JsonValue[]; // 🤷
  multipleOf?: Type extends "number" | "integer" ? number : never; // ⚠️ only makes sense for number/integer types
  maximum?: Type extends "number" | "integer" ? number : never; // ⚠️ only makes sense for number/integer types
  exclusiveMaximum?: Type extends "number" | "integer" ? number : never; // ⚠️ only makes sense for number/integer types
  minimum?: Type extends "number" | "integer" ? number : never; // ⚠️ only makes sense for number/integer types
  exclusiveMinimum?: Type extends "number" | "integer" ? number : never; // ⚠️ only makes sense for number/integer types
  minLength?: Type extends "string" ? number : never; // ⚠️ only makes sense for string types
  maxLength?: Type extends "string" ? number : never; // ⚠️ only makes sense for string types
  pattern?: Type extends "string" ? string : never; // ⚠️ only makes sense for string types
  additionalItems?: Type extends "array" // 🔓 only makes sense for array types
    ? Items extends SchemaLike // where the items field is not a single schema
      ? never
      : AdditionalItems
    : never;
  items?: Type extends "array" ? Items : never; // 🔓 only makes sense for array types
  maxItems?: Type extends "array" ? number : never; // ⚠️ only makes sense for array types
  minItems?: Type extends "array" ? number : never; // ⚠️ only makes sense for array types
  uniqueItems?: Type extends "array" ? boolean : never; // ⚠️ only makes sense for array types
  contains?: Type extends "array" ? SchemaLike : never; // ⚠️ only makes sense for array types
  maxProperties?: Type extends "object" ? number : never; // ⚠️ only makes sense for object types
  minProperties?: Type extends "object" ? number : never; // ⚠️ only makes sense for object types
  required?: Type extends "object" ? Required : never; // 💪 only makes sense for object types
  additionalProperties?: Type extends "object" ? AdditionalProperties : never; // 💪 only makes sense for object types
  definitions?: Definitions; // ⚠️ not yet enforced
  properties?: Type extends "object" ? Properties : never; // 💪 only makes sense for object types
  patternProperties?: Type extends "object"
    ? { [k: string]: SchemaLike }
    : never; // ⚠️ only makes sense for object types
  dependencies?: Type extends "object" ? Dependencies : never; // ⚠️ not yet enforced
  propertyNames?: Type extends "object" ? SchemaLike : never; // ⚠️ only makes sense for object types
  const?: Const; // 💪
  enum?: Enum; // 💪
  type?: Type; // 💪
  format?: Type extends "string" ? string : never; // ⚠️ only makes sense for string types
  contentMediaType?: Type extends "string" ? string : never; // 🤷
  contentEncoding?: Type extends "string" ? string : never; // 🤷
  if?: Then extends SchemaLike // 🤷
    ? SchemaLike
    : Else extends SchemaLike
    ? SchemaLike
    : never; // If `if` is specified, then at least one of `then` or `else` should be specified.
  then?: If extends SchemaLike ? SchemaLike : never; // 💪 Only matters if `if` is supplied
  else?: If extends SchemaLike ? SchemaLike : never; // 💪 Only matters if `if` is supplied
  allOf?: AllOf; // 💪
  anyOf?: AnyOf; // 💪
  oneOf?: OneOf; // 🔓
  not?: Not; // ⚠️
  [InternalTypeSymbol]?: CalculatedType;
}

export const createSchema = <
  Type extends SimpleType | undefined = undefined,
  Properties extends { [k: string]: SchemaLike } | undefined = undefined,
  Items extends (SchemaLike | readonly SchemaLike[]) | undefined = undefined,
  AdditionalItems extends SchemaLike | undefined = undefined,
  AdditionalProperties extends SchemaLike | undefined = undefined,
  Required extends readonly (keyof Properties)[] | undefined = undefined,
  Const extends JsonValue | undefined = undefined,
  Enum extends readonly JsonValue[] | undefined = undefined,
  AllOf extends readonly SchemaLike[] | undefined = undefined,
  AnyOf extends readonly SchemaLike[] | undefined = undefined,
  OneOf extends readonly SchemaLike[] | undefined = undefined,
  Not extends SchemaLike | undefined = undefined,
  If extends SchemaLike | undefined = undefined,
  Then extends SchemaLike | undefined = undefined,
  Else extends SchemaLike | undefined = undefined,
  Definitions extends { [k: string]: SchemaLike } | undefined = undefined,
  Ref extends string | undefined = undefined,
  Dependencies extends
    | { [k in keyof Properties]: SchemaLike | keyof Properties[] }
    | undefined = undefined
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
    Not,
    If,
    Then,
    Else,
    Definitions,
    Ref,
    Dependencies
  >
) =>
  // require the InternalTypeSymbol here so we can't pass illegitimate schemas into
  // the tsjsonParser class.
  {
    return {
      ...schema,
      "#__internaltype__#": {} as NonNullable<
        typeof schema[typeof InternalTypeSymbol]
      >
    };
  };
