import { GoogleGenerativeAI } from "@google/generative-ai";
import { DATABASE_CONFIG } from "./databaseConfig";

export const processDirectAI = async (prompt: string, systemInstruction?: string) => {
  const apiKey = DATABASE_CONFIG.AI_STUDIO.apiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY tidak ditemukan di lingkungan AI Studio.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: DATABASE_CONFIG.AI_STUDIO.model,
    systemInstruction: systemInstruction || "Anda adalah asisten AI medis SiMANTAP Bedah RSUD dr. R. Soedjono Selong.",
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
    }
  });

  const response = await result.response;
  return response.text();
};
