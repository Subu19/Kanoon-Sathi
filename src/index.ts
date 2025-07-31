import { startFlowServer, withContextProvider } from "@genkit-ai/express";
import dotenv from "dotenv";
import { type Document, z } from "genkit";
import { apiKey } from "genkit/context";
import {
  getConstitutionArticle,
  getConstitutionPart,
  getConstitutionTableOfContents,
} from "./tools/constitution";
import {
  civilCodeRetriever,
  criminalCodeRetriever,
  criminalProcedureRetriever,
  vectorDbRetriever,
} from "./tools/retriever";
import { ai, correctGrammar, detectDocumentType } from "./utils/ai";

dotenv.config();
interface ChatMessagePart {
  text: string;
}
export interface ChatInterface {
  role: "user" | "model" | "system";
  content: ChatMessagePart[];
}

const CHAT_HISTORY = new Map<string, Array<ChatInterface>>();

/**
 * Gets the appropriate document retriever based on AI detection of query type
 * @param query The user's query
 * @returns Promise resolving to the appropriate retriever
 */
async function getDocumentRetriever(query: string) {
  // Use AI to detect the document type based on the query
  const documentType = await detectDocumentType(query);

  console.log(`AI detected document type: ${documentType} for query: "${query}"`);

  // Return the appropriate retriever based on the detected document type
  switch (documentType) {
    case "criminal":
      return criminalCodeRetriever;
    case "civil":
      return civilCodeRetriever;
    case "criminal_procedure":
      return criminalProcedureRetriever;
    case "constitution":
      return vectorDbRetriever;
    default:
      return null; // Constitution retriever is the default
  }
}

async function main() {
  const systemPrompt = `You are Kanoon Sathi, an AI legal assistant specializing in Nepali law, including the Constitution of Nepal 2015, Criminal Code, Civil Code, and Criminal Procedure Code.

ROLE:
- Provide accurate, contextual, and up-to-date legal information regarding Nepal's legal frameworks.
- Support users by answering questions clearly, professionally, and compassionately.
- Act as a knowledgeable assistant—but not a licensed legal professional.
- Make sure you provide the references of the information you provide, including specific articles, clauses, sections, and page numbers. Always put these references at the bottom of your response.

CAPABILITIES:
- You have access to reliable legal information, including:
  * The complete Constitution of Nepal 2015
  * The National Penal (Code) Act, 2017 (Criminal Code)
  * The Civil Code Act, 2017
  * The Criminal Procedure Code, 2017
- You can automatically search and retrieve relevant information using integrated tools and retrievers.
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

      const refinedPrompt = await correctGrammar(prompt);
      console.log("Refined prompt after grammar correction:", refinedPrompt);
      // Use AI to select the appropriate retriever based on query content
      console.log("Detecting document type for query:", refinedPrompt);
      const selectedRetriever = await getDocumentRetriever(refinedPrompt);

      // Retrieve relevant documents using the selected retriever
      let docs: Document[] = [];
      if (selectedRetriever) {
        docs = await ai.retrieve({
          retriever: selectedRetriever,
          query: refinedPrompt,
          options: {
            k: 3,
          },
        });
      }

      // Update chat history
      CHAT_HISTORY.set(input.chatroomId, [
        ...(CHAT_HISTORY.get(input.chatroomId) || []),
        { role: "user", content: [{ text: prompt }] },
      ]);

      // Generate response using AI
      const response = await ai.generate({
        system: systemPrompt,
        prompt: refinedPrompt,
        docs: docs,
        tools: [getConstitutionTableOfContents, getConstitutionPart, getConstitutionArticle],
        messages: CHAT_HISTORY.get(input.chatroomId) || [],
      });

      // Update chat history with model response
      CHAT_HISTORY.set(input.chatroomId, [
        ...(CHAT_HISTORY.get(input.chatroomId) || []),
        { role: "model", content: [{ text: response.text || "" }] },
      ]);

      // console.log("Generated response:", JSON.stringify(response));
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

// Process code files (uncomment to process)
// processCriminalCodeCSV("./criminal_code_pages.csv")
//   .then((count) => console.log(`Imported and processed ${count} pages from criminal code CSV`))
//   .catch((err) => console.error("Failed to process criminal code CSV:", err));

// processCivilCodeCSV("./civil_code_pages.csv")
//   .then((count) => console.log(`Imported and processed ${count} pages from civil code CSV`))
//   .catch((err) => console.error("Failed to process civil code CSV:", err));

// processCriminalProcedureCSV("./criminal_procedure_pages.csv")
//   .then((count) => console.log(`Imported and processed ${count} pages from criminal procedure CSV`))
//   .catch((err) => console.error("Failed to process criminal procedure CSV:", err));

main();
