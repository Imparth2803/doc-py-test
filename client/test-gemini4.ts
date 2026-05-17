import { GoogleGenAI } from "@google/genai";
async function test() {
  const ai = new GoogleGenAI({ apiKey: "invalid_key" });
  try {
    await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "hello"
    });
  } catch (e: any) {
    console.log(e.status, e.message);
  }
}
test();
