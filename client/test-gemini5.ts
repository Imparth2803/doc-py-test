import { GoogleGenAI } from "@google/genai";
async function test() {
  const ai = new GoogleGenAI({ apiKey: "invalid_key" });
  try {
    await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        { text: "hello" },
        { inlineData: { mimeType: "application/pdf", data: "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAwAAAqTgaECmVuZHN0cmVhbQplbmRvYmoKCjMgMCBvYmoKNQplbmRvYmoKCjEgMCBvYmoKPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCAzIDNdL1Jlc291cmNlczw8L1Byb2NTZXRbL1BERl0+Pi9Db250ZW50cyAyIDAgUi9QYXJlbnQgNCAwIFI+PgplbmRvYmoKCjQgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzEgMCBSXS9Db3VudCAxPj4KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyA0IDAgUj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMSAwIFJdL0NvdW50IDE+PgplbmRvYmoKCjUgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSPj4KZW5kb2JqCgp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDUgMCBSPj4Kc3RhcnR4cmVmCjI5NQolJUVPRgo=" } }
      ]
    });
  } catch (e: any) {
    console.log(e.status, e.message);
  }
}
test();
