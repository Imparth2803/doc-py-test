import { Type } from "@google/genai";

const schema = {
  type: Type.OBJECT,
  properties: {},
  additionalProperties: {
    type: Type.STRING
  }
};
console.log("Compiles:", !!schema);
