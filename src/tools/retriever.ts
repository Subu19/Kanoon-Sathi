import { textEmbeddingGecko001 } from "@genkit-ai/googleai";
import { Document, z } from "genkit";
import { CommonRetrieverOptionsSchema } from "genkit/retriever";
import { ai } from "../utils/ai";
import DB from "../utils/db";

// Define the retriever options schema (extending common options)
const vectorDbRetrieverOptionsSchema = CommonRetrieverOptionsSchema.extend({
  similarityThreshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Minimum similarity score (0-1) for results"),
  metadataFilter: z.record(z.any()).optional().describe("Metadata key-value pairs to filter by"),
});

// Create the retriever implementation
export const vectorDbRetriever = ai.defineRetriever(
  {
    name: "custom/vectorDbRetriever",
    configSchema: vectorDbRetrieverOptionsSchema,
  },
  async (query, options) => {
    // Get the raw results from your vector DB
    const results = await searchVectorDb(query.content[0].text ?? "", options?.k || 5);

    // Convert to Genkit Documents
    const documents = results.map((row) => {
      return Document.fromText(row.content, {
        metadata: {
          ...row.metadata,
          similarityScore: row.similarity_score,
        },
      });
    });

    // Apply similarity threshold if specified
    let filteredDocs = documents;
    if (options.similarityThreshold) {
      filteredDocs = documents.filter(
        (doc) => doc.metadata?.similarityScore >= (options.similarityThreshold ?? 0),
      );
    }

    // Apply metadata filter if specified
    if (options?.metadataFilter) {
      filteredDocs = filteredDocs.filter((doc) => {
        return Object.entries(options.metadataFilter!).every(([key, value]) => {
          return doc.metadata?.[key] === value;
        });
      });
    }

    return {
      documents: filteredDocs,
    };
  },
);

export async function searchVectorDb(query: string, limit = 5) {
  const embedding = await ai.embed({
    embedder: textEmbeddingGecko001,
    content: query,
  });

  const embeddingArray = embedding[0].embedding;
  const vectorString = `[${embeddingArray.join(",")}]`;

  const res = await DB.query(
    `
    SELECT 
      content, 
      metadata,
      1 - (embedding <=> $1) AS similarity_score
    FROM documents
    ORDER BY embedding <=> $1
    LIMIT $2
    `,
    [vectorString, limit],
  );

  return res.rows;
}
