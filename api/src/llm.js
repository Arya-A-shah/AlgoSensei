// Thin Gemini wrapper returning parsed JSON. Swappable for tests via setLlm().
import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";

async function geminiJson({ apiKey, prompt, schema }) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      ...(schema ? { responseSchema: schema } : {}),
      temperature: 0.2,
    },
  });
  const text = response.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    // Some models wrap JSON in fences despite the mime type.
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("LLM did not return JSON");
  }
}

let impl = geminiJson;

export function setLlm(fn) {
  impl = fn ?? geminiJson;
}

export function resolveKey(userKey) {
  return userKey || config.geminiKey || "";
}

export async function llmJson(args) {
  if (!args.apiKey) throw new Error("No Gemini API key available");
  return impl(args);
}
