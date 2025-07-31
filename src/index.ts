import { startFlowServer, withContextProvider } from "@genkit-ai/express";
import dotenv from "dotenv";
import { z } from "genkit";
import { apiKey } from "genkit/context";
import {
  getConstitutionArticle,
  getConstitutionPart,
  getConstitutionTableOfContents,
} from "./tools/constitution";
import { vectorDbRetriever } from "./tools/retriever";
import { ai } from "./utils/ai";

dotenv.config();
interface ChatMessagePart {
  text: string;
}
export interface ChatInterface {
  role: "user" | "model" | "system";
  content: ChatMessagePart[];
}

const CHAT_HISTORY = new Map<string, Array<ChatInterface>>();

async function main() {
  const systemPrompt = `You are Kanoon Sathi, an AI legal assistant specializing in Nepali law and the Constitution of Nepal 2015.

ROLE:
- Provide accurate, contextual, and up-to-date legal information regarding Nepal's constitutional provisions and frameworks.
- Support users by answering questions clearly, professionally, and compassionately.
- Act as a knowledgeable assistant—but not a licensed legal professional.
- Make sure you provide the references of the information you provide, including specific articles and clauses. Always put these references at the bottom of your response.

CAPABILITIES:
- You have access to reliable constitutional information, including the complete Constitution of Nepal 2015.
- You can automatically search and retrieve relevant parts, articles, or clauses using integrated tools and retrievers.
- You never ask users to invoke tools manually or provide unnecessary technical instructions.

BEHAVIOR GUIDELINES:
- Always respond as if the retrieved information is part of your own knowledge.
- Do not mention tools or say things like “based on what you’ve provided” or “you can use X tool.”
- Seamlessly incorporate fetched or retrieved data into your answer.
- Clearly cite specific articles and clauses where relevant.
- If an answer cannot be determined, explain it clearly and suggest contacting a qualified legal professional.
- Always respond in Markdown format with structured formatting (e.g., lists, headings, quotes) to enhance readability.

LANGUAGE & TONE:
- Use accessible, respectful, and neutral Nepali-English (or user’s preferred language) while maintaining legal accuracy.
- Prioritize clarity and empathy over complexity.`;

  const autonomousAIFlow = ai.defineFlow(
    {
      name: "autonomousAIFlow",
      inputSchema: z.object({
        text: z.string(),
        chatroomId: z.string(),
      }),
    },
    async (input) => {
      // Debug log to check what's coming in
      console.log("Received input:", JSON.stringify(input));
      const prompt = input.text;

      //Retrieve relevant documents
      const docs = await ai.retrieve({
        retriever: vectorDbRetriever,
        query: input.text,
        options: {
          k: 2,
        },
      });

      // Update chat history
      CHAT_HISTORY.set(input.chatroomId, [
        ...(CHAT_HISTORY.get(input.chatroomId) || []),
        { role: "user", content: [{ text: prompt }] },
      ]);

      // Generate response using AI
      const response = await ai.generate({
        system: systemPrompt,
        prompt: prompt,
        docs: docs,
        tools: [getConstitutionTableOfContents, getConstitutionPart, getConstitutionArticle],
        messages: CHAT_HISTORY.get(input.chatroomId) || [],
      });

      // Update chat history with model response
      CHAT_HISTORY.set(input.chatroomId, [
        ...(CHAT_HISTORY.get(input.chatroomId) || []),
        { role: "model", content: [{ text: response.text || "" }] },
      ]);

      console.log("Generated response:", JSON.stringify(response));
      // Return the response text
      return response.text || "No response generated.";
    },
  );

  // Define flows for retrieving chat history and conversation list
  const getChatHistory = ai.defineFlow(
    {
      name: "getChatHistory",
      inputSchema: z.object({
        chatroomId: z.string(),
      }),
    },
    async (input) => {
      const chatHistory = CHAT_HISTORY.get(input.chatroomId) || [];

      return chatHistory.map((msg) => ({
        role: msg.role,
        content: msg.content.map((part) => part.text).join(" "),
      }));
    },
  );

  // Flow to get the list of conversations
  const getConversationList = ai.defineFlow(
    {
      name: "getConversationList",
    },
    async () => {
      return Array.from(CHAT_HISTORY.keys()).map((chatroomId) => {
        const lastMessage = CHAT_HISTORY.get(chatroomId)?.slice(-1)[0];
        return {
          chatroomId,
          lastMessage: lastMessage
            ? {
                role: lastMessage.role,
                content: lastMessage.content.map((part) => part.text).join(" "),
              }
            : {
                role: "user",
                content: "",
              },
        };
      });
    },
  );

  startFlowServer({
    flows: [
      withContextProvider(autonomousAIFlow, apiKey("1234567890")),
      withContextProvider(getChatHistory, apiKey("1234567890")),
      withContextProvider(getConversationList, apiKey("1234567890")),
    ],
    port: 7777,
  });

  console.log("Server running on port: 7777");
}

// Import constitution data from CSV if needed
// DB.importConstitutionFromCsv("./constitution_dataset.csv")
//   .then((count) => console.log(`Imported ${count} constitutional clauses`))
//   .catch((err) => console.error("Failed to import constitution data:", err));

main();
