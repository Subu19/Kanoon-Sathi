import { textEmbeddingGecko001 } from "@genkit-ai/googleai";
import { parse } from "csv-parse/sync";
import fs from "fs/promises";
import { ai } from "./ai";
import DB from "./db";

/**
 * Interface for legal document records from the CSV file
 */
interface LegalDocumentRecord {
  id: string;
  part_title: string;
  article_number: string;
  article_title: string;
  clause_number: string;
  content: string;
  source_reference: string;
  tags: string;
  language: string;
}

/**
 * Type for the metadata stored alongside the embedding
 */
interface DocumentMetadata {
  id: string;
  partTitle: string;
  articleNumber: string;
  articleTitle: string;
  clauseNumber: string;
  sourceReference: string;
  tags: string[];
  language: string;
}

/**
 * Processes and embeds legal documents into the vector database
 *
 * @param documents - Array of legal document records to process and embed
 * @returns Number of documents successfully embedded
 */
export async function embedLegalDocuments(documents: LegalDocumentRecord[]): Promise<number> {
  let successCount = 0;

  for (const document of documents) {
    try {
      // Create a rich text representation for embedding
      const textToEmbed = createEmbeddingText(document);

      // Generate embedding vector
      const embedding = await ai.embed({
        embedder: textEmbeddingGecko001,
        content: textToEmbed,
      });

      // Process embedding array to string format for DB storage
      const embeddingArray = embedding[0].embedding;
      const vectorString = `[${embeddingArray.join(",")}]`;

      // Prepare metadata for storage
      const metadata: DocumentMetadata = {
        id: document.id,
        partTitle: document.part_title,
        articleNumber: document.article_number,
        articleTitle: document.article_title,
        clauseNumber: document.clause_number,
        sourceReference: document.source_reference,
        tags: document.tags.split(",").map((tag) => tag.trim()),
        language: document.language,
      };

      // Store in database
      await DB.query("INSERT INTO documents (content, metadata, embedding) VALUES ($1, $2, $3)", [
        document.content,
        metadata,
        vectorString,
      ]);

      successCount++;
    } catch (error) {
      console.error(`Failed to embed document ID ${document.id}:`, error);
    }
  }

  console.log(
    `Successfully embedded ${successCount}/${documents.length} documents into the database.`,
  );
  return successCount;
}

/**
 * Creates a rich text representation for embedding
 *
 * @param document - The legal document record
 * @returns A text string optimized for embedding
 */
function createEmbeddingText(document: LegalDocumentRecord): string {
  return [
    `Article: ${document.article_number}`,
    `Title: ${document.article_title}`,
    document.part_title ? `Part: ${document.part_title}` : "",
    document.clause_number ? `Clause: ${document.clause_number}` : "",
    `Content: ${document.content}`,
    document.tags ? `Tags: ${document.tags}` : "",
  ]
    .filter((line) => line.trim() !== "")
    .join("\n");
}

/**
 * Reads a CSV file and processes its legal document records
 *
 * @param filePath - Path to the CSV file
 * @returns Array of processed legal document records
 */
export async function processLegalDocumentsFromCSV(
  filePath: string,
): Promise<LegalDocumentRecord[]> {
  try {
    // Read and parse CSV file
    const fileContent = await fs.readFile(filePath, "utf-8");
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as LegalDocumentRecord[];

    // Validate records
    const validRecords = records.filter((record) => {
      if (!record.id || !record.content) {
        console.warn(`Skipping record with missing ID or content:`, record.id || "unknown ID");
        return false;
      }
      return true;
    });

    console.log(`Read ${validRecords.length} valid records from CSV file.`);

    // Process the records for embedding
    await embedLegalDocuments(validRecords);

    return validRecords;
  } catch (error) {
    console.error("Failed to process CSV file:", error);
    throw new Error(
      `CSV processing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
