export class TSJSONParser<JsonSchemaType> {
  private readonly schema: JsonSchemaType;
  constructor(schema: JsonSchemaType) {
    this.schema = schema;
  }

  public printSchema = () => {
    console.log(this.schema);
  };
}
