const hiddenField = Symbol("SpecialTypeAnnotationFieldDoNotUse");

export class TSJSON<T> {
  // constructor() {}

  public parse = (input: string): T =>
    JSON.parse(input) as T & { [hiddenField]: "adj" };
}
