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

/**
 * Interface for criminal code page records
 */
interface CriminalCodePage {
  id: number;
  page_number: number;
  content: string;
  metadata: {
    source: string;
    title: string;
    pageNumber: number;
  };
}

/**
 * Interface for civil code page records
 */
interface CivilCodePage {
  id: number;
  page_number: number;
  content: string;
  metadata: {
    source: string;
    title: string;
    pageNumber: number;
  };
}

/**
 * Interface for criminal procedure page records
 */
interface CriminalProcedurePage {
  id: number;
  page_number: number;
  content: string;
  metadata: {
    source: string;
    title: string;
    pageNumber: number;
  };
}

/**
 * Process and embed criminal code pages that have been imported to the database
 *
 * @returns Number of pages successfully embedded
 */
export async function embedCriminalCodePages(): Promise<number> {
  try {
    console.log("Starting to embed criminal code pages...");

    // First, ensure DB is initialized (will do nothing if already initialized)
    await DB.initialize();

    // Get all criminal code pages without embeddings
    const result = await DB.query(`
      SELECT id, page_number, content, metadata
      FROM criminal_code
      WHERE embedding IS NULL
      ORDER BY page_number
    `);

    const pages = result.rows as CriminalCodePage[];
    console.log(`Found ${pages.length} criminal code pages to embed.`);

    if (pages.length === 0) {
      console.log("No pages to process. All pages might already have embeddings.");
      return 0;
    }

    let successCount = 0;

    // Process each page
    for (const page of pages) {
      try {
        // Generate embedding vector
        const embedding = await ai.embed({
          embedder: textEmbeddingGecko001,
          content: page.content,
        });

        // Process embedding array to string format for DB storage
        const embeddingArray = embedding[0].embedding;
        const vectorString = `[${embeddingArray.join(",")}]`;

        // Update the record with embedding
        await DB.query(
          `UPDATE criminal_code 
           SET embedding = $1
           WHERE id = $2`,
          [vectorString, page.id],
        );

        successCount++;

        // Log progress every 10 pages
        if (successCount % 10 === 0) {
          console.log(`Embedded ${successCount}/${pages.length} pages...`);
        }
      } catch (error) {
        console.error(`Failed to embed page ${page.page_number}:`, error);
      }
    }

    console.log(`Successfully embedded ${successCount}/${pages.length} criminal code pages.`);
    return successCount;
  } catch (error) {
    console.error("Failed to embed criminal code pages:", error);
    throw new Error(
      `Criminal code embedding failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Process and embed civil code pages that have been imported to the database
 *
 * @returns Number of pages successfully embedded
 */
export async function embedCivilCodePages(): Promise<number> {
  try {
    console.log("Starting to embed civil code pages...");

    // First, ensure DB is initialized (will do nothing if already initialized)
    await DB.initialize();

    // Get all civil code pages without embeddings
    const result = await DB.query(`
      SELECT id, page_number, content, metadata
      FROM civil_code
      WHERE embedding IS NULL
      ORDER BY page_number
    `);

    const pages = result.rows as CivilCodePage[];
    console.log(`Found ${pages.length} civil code pages to embed.`);

    if (pages.length === 0) {
      console.log("No pages to process. All pages might already have embeddings.");
      return 0;
    }

    let successCount = 0;

    // Process each page
    for (const page of pages) {
      try {
        // Generate embedding vector
        const embedding = await ai.embed({
          embedder: textEmbeddingGecko001,
          content: page.content,
        });

        // Process embedding array to string format for DB storage
        const embeddingArray = embedding[0].embedding;
        const vectorString = `[${embeddingArray.join(",")}]`;

        // Update the record with embedding
        await DB.query(
          `UPDATE civil_code 
           SET embedding = $1
           WHERE id = $2`,
          [vectorString, page.id],
        );

        successCount++;

        // Log progress every 10 pages
        if (successCount % 10 === 0) {
          console.log(`Embedded ${successCount}/${pages.length} pages...`);
        }
      } catch (error) {
        console.error(`Failed to embed page ${page.page_number}:`, error);
      }
    }

    console.log(`Successfully embedded ${successCount}/${pages.length} civil code pages.`);
    return successCount;
  } catch (error) {
    console.error("Failed to embed civil code pages:", error);
    throw new Error(
      `Civil code embedding failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Process and embed criminal procedure pages that have been imported to the database
 *
 * @returns Number of pages successfully embedded
 */
export async function embedCriminalProcedurePages(): Promise<number> {
  try {
    console.log("Starting to embed criminal procedure pages...");

    // First, ensure DB is initialized (will do nothing if already initialized)
    await DB.initialize();

    // Get all criminal procedure pages without embeddings
    const result = await DB.query(`
      SELECT id, page_number, content, metadata
      FROM criminal_procedure
      WHERE embedding IS NULL
      ORDER BY page_number
    `);

    const pages = result.rows as CriminalProcedurePage[];
    console.log(`Found ${pages.length} criminal procedure pages to embed.`);

    if (pages.length === 0) {
      console.log("No pages to process. All pages might already have embeddings.");
      return 0;
    }

    let successCount = 0;

    // Process each page
    for (const page of pages) {
      try {
        // Generate embedding vector
        const embedding = await ai.embed({
          embedder: textEmbeddingGecko001,
          content: page.content,
        });

        // Process embedding array to string format for DB storage
        const embeddingArray = embedding[0].embedding;
        const vectorString = `[${embeddingArray.join(",")}]`;

        // Update the record with embedding
        await DB.query(
          `UPDATE criminal_procedure 
           SET embedding = $1
           WHERE id = $2`,
          [vectorString, page.id],
        );

        successCount++;

        // Log progress every 10 pages
        if (successCount % 10 === 0) {
          console.log(`Embedded ${successCount}/${pages.length} pages...`);
        }
      } catch (error) {
        console.error(`Failed to embed page ${page.page_number}:`, error);
      }
    }

    console.log(`Successfully embedded ${successCount}/${pages.length} criminal procedure pages.`);
    return successCount;
  } catch (error) {
    console.error("Failed to embed criminal procedure pages:", error);
    throw new Error(
      `Criminal procedure embedding failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Complete process for embedding criminal code CSV file
 * Imports the CSV and then generates embeddings for all pages
 *
 * @param csvFilePath - Path to the criminal code CSV file
 * @returns Number of pages successfully processed and embedded
 */
export async function processCriminalCodeCSV(csvFilePath: string): Promise<number> {
  try {
    console.log(`Processing criminal code CSV file: ${csvFilePath}`);

    // First import the CSV data into the database
    const importedCount = await DB.importCriminalCodeFromCsv(csvFilePath);
    console.log(`Imported ${importedCount} pages from the CSV file.`);

    if (importedCount === 0) {
      console.log("No pages were imported, stopping the process.");
      return 0;
    }

    // Generate embeddings for all pages
    const embeddedCount = await embedCriminalCodePages();

    console.log(`Completed processing ${embeddedCount} criminal code pages with embeddings.`);
    return embeddedCount;
  } catch (error) {
    console.error("Failed to process criminal code CSV:", error);
    throw new Error(
      `Criminal code CSV processing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Complete process for embedding civil code CSV file
 * Imports the CSV and then generates embeddings for all pages
 *
 * @param csvFilePath - Path to the civil code CSV file
 * @returns Number of pages successfully processed and embedded
 */
export async function processCivilCodeCSV(csvFilePath: string): Promise<number> {
  try {
    console.log(`Processing civil code CSV file: ${csvFilePath}`);

    // First import the CSV data into the database
    const importedCount = await DB.importCivilCodeFromCsv(csvFilePath);
    console.log(`Imported ${importedCount} pages from the CSV file.`);

    if (importedCount === 0) {
      console.log("No pages were imported, stopping the process.");
      return 0;
    }

    // Generate embeddings for all pages
    const embeddedCount = await embedCivilCodePages();

    console.log(`Completed processing ${embeddedCount} civil code pages with embeddings.`);
    return embeddedCount;
  } catch (error) {
    console.error("Failed to process civil code CSV:", error);
    throw new Error(
      `Civil code CSV processing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Complete process for embedding criminal procedure CSV file
 * Imports the CSV and then generates embeddings for all pages
 *
 * @param csvFilePath - Path to the criminal procedure CSV file
 * @returns Number of pages successfully processed and embedded
 */
export async function processCriminalProcedureCSV(csvFilePath: string): Promise<number> {
  try {
    console.log(`Processing criminal procedure CSV file: ${csvFilePath}`);

    // First import the CSV data into the database
    const importedCount = await DB.importCriminalProcedureFromCsv(csvFilePath);
    console.log(`Imported ${importedCount} pages from the CSV file.`);

    if (importedCount === 0) {
      console.log("No pages were imported, stopping the process.");
      return 0;
    }

    // Generate embeddings for all pages
    const embeddedCount = await embedCriminalProcedurePages();

    console.log(`Completed processing ${embeddedCount} criminal procedure pages with embeddings.`);
    return embeddedCount;
  } catch (error) {
    console.error("Failed to process criminal procedure CSV:", error);
    throw new Error(
      `Criminal procedure CSV processing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
