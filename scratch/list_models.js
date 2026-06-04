import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/VITE_GEMINI_API_KEY="?([^"\n\r]+)"?/);
const API_KEY = match ? match[1] : "";

console.log("Using API KEY:", API_KEY.substring(0, 5) + "...");

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const data = await response.json();
    if (data.models) {
      console.log("Available Models:");
      data.models.forEach(m => console.log(m.name));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error("Failed to list models:", e);
  }
}

listModels();
