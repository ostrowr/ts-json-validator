import { TSJSONParser } from "./tsjson-parser";

test("TODO", () => {
  const parser = new TSJSONParser("{a: 4}");
  parser.printSchema();
});
