import { textEmbeddingGecko001 } from "@genkit-ai/googleai";
import { Document, z } from "genkit";
import { CommonRetrieverOptionsSchema } from "genkit/retriever";
import { ai } from "../utils/ai";
import DB from "../utils/db";

// Define the common retriever options schema with all possible options
const allRetrieversOptionsSchema = CommonRetrieverOptionsSchema.extend({
  similarityThreshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Minimum similarity score (0-1) for results"),
  metadataFilter: z.record(z.any()).optional().describe("Metadata key-value pairs to filter by"),
  pageFilter: z.number().optional().describe("Filter by specific page number"),
});

// Each retriever uses the same schema for compatibility
const vectorDbRetrieverOptionsSchema = allRetrieversOptionsSchema;

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

// Define the criminal code retriever options schema using the common schema
const criminalCodeRetrieverOptionsSchema = allRetrieversOptionsSchema;

// Create the criminal code retriever implementation
export const criminalCodeRetriever = ai.defineRetriever(
  {
    name: "custom/criminalCodeRetriever",
    configSchema: criminalCodeRetrieverOptionsSchema,
  },
  async (query, options) => {
    // Get the raw results from the criminal code vector DB
    const results = await searchCriminalCodeDb(query.content[0].text ?? "", options?.k || 5);

    // Convert to Genkit Documents
    const documents = results.map((row) => {
      return Document.fromText(row.content, {
        metadata: {
          ...row.metadata,
          pageNumber: row.page_number,
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

    // Apply page filter if specified
    if (options?.pageFilter) {
      filteredDocs = filteredDocs.filter((doc) => {
        return doc.metadata?.pageNumber === options.pageFilter;
      });
    }

    return {
      documents: filteredDocs,
    };
  },
);

export async function searchCriminalCodeDb(query: string, limit = 5) {
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
      page_number,
      metadata,
      1 - (embedding <=> $1) AS similarity_score
    FROM criminal_code
    ORDER BY embedding <=> $1
    LIMIT $2
    `,
    [vectorString, limit],
  );

  return res.rows;
}

// Define the civil code retriever options schema using the common schema
const civilCodeRetrieverOptionsSchema = allRetrieversOptionsSchema;

// Create the civil code retriever implementation
export const civilCodeRetriever = ai.defineRetriever(
  {
    name: "custom/civilCodeRetriever",
    configSchema: civilCodeRetrieverOptionsSchema,
  },
  async (query, options) => {
    // Get the raw results from the civil code vector DB
    const results = await searchCivilCodeDb(query.content[0].text ?? "", options?.k || 5);

    // Convert to Genkit Documents
    const documents = results.map((row) => {
      return Document.fromText(row.content, {
        metadata: {
          ...row.metadata,
          pageNumber: row.page_number,
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

    // Apply page filter if specified
    if (options?.pageFilter) {
      filteredDocs = filteredDocs.filter((doc) => {
        return doc.metadata?.pageNumber === options.pageFilter;
      });
    }

    return {
      documents: filteredDocs,
    };
  },
);

export async function searchCivilCodeDb(query: string, limit = 5) {
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
      page_number,
      metadata,
      1 - (embedding <=> $1) AS similarity_score
    FROM civil_code
    ORDER BY embedding <=> $1
    LIMIT $2
    `,
    [vectorString, limit],
  );

  return res.rows;
}

// Define the criminal procedure retriever options schema using the common schema
const criminalProcedureRetrieverOptionsSchema = allRetrieversOptionsSchema;

// Create the criminal procedure retriever implementation
export const criminalProcedureRetriever = ai.defineRetriever(
  {
    name: "custom/criminalProcedureRetriever",
    configSchema: criminalProcedureRetrieverOptionsSchema,
  },
  async (query, options) => {
    // Get the raw results from the criminal procedure vector DB
    const results = await searchCriminalProcedureDb(query.content[0].text ?? "", options?.k || 5);

    // Convert to Genkit Documents
    const documents = results.map((row) => {
      return Document.fromText(row.content, {
        metadata: {
          ...row.metadata,
          pageNumber: row.page_number,
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

    // Apply page filter if specified
    if (options?.pageFilter) {
      filteredDocs = filteredDocs.filter((doc) => {
        return doc.metadata?.pageNumber === options.pageFilter;
      });
    }

    return {
      documents: filteredDocs,
    };
  },
);

export async function searchCriminalProcedureDb(query: string, limit = 5) {
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
      page_number,
      metadata,
      1 - (embedding <=> $1) AS similarity_score
    FROM criminal_procedure
    ORDER BY embedding <=> $1
    LIMIT $2
    `,
    [vectorString, limit],
  );

  return res.rows;
}
