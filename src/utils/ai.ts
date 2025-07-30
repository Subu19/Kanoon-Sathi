import { gemini20Flash, googleAI } from "@genkit-ai/googleai";
import { genkit } from "genkit/beta";
import { env } from "../utils/env_validator";

export const ai = genkit({
  plugins: [googleAI({ apiKey: env.GEMINI_API_KEY })],
  model: gemini20Flash, // set default model
});
