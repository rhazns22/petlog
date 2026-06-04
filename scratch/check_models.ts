import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY || "";

async function listModels() {
  const genAI = new GoogleGenerativeAI(API_KEY);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.models) {
      console.log("Model Names:", data.models.map((m: any) => m.name).join(", "));
    } else {
      console.log("No models found:", JSON.stringify(data));
    }
  } catch (e) {
    console.error("Error listing models:", e);
  }
}

listModels();
