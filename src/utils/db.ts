import path from "path";
import { Client } from "pg";
import { env } from "./env_validator";

// Global database client instance
class Database {
  private static instance: Client;
  private static isInitialized = false;

  // Private constructor to prevent direct instantiation
  private constructor() {}

  // Initialize the database connection
  public static async initialize() {
    if (Database.isInitialized) return;

    Database.instance = new Client({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    });

    try {
      await Database.instance.connect();
      await Database.setupDatabase();
      Database.isInitialized = true;
      console.log("Database connected and initialized");
    } catch (error) {
      console.error("Database initialization failed:", error);
      throw error;
    }
  }

  // Setup database schema
  private static async setupDatabase() {
    await Database.instance.query("CREATE EXTENSION IF NOT EXISTS vector");
    await Database.instance.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        content TEXT,
        metadata JSONB,
        embedding vector(768),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Add indexes for better performance
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN (metadata)
    `);

    // Create criminal code table
    await Database.instance.query(`
      CREATE TABLE IF NOT EXISTS criminal_code (
        id SERIAL PRIMARY KEY,
        page_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector(768),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Add index for criminal code table
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_criminal_code_page ON criminal_code (page_number)
    `);

    // Create civil code table
    await Database.instance.query(`
      CREATE TABLE IF NOT EXISTS civil_code (
        id SERIAL PRIMARY KEY,
        page_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector(768),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Add index for civil code table
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_civil_code_page ON civil_code (page_number)
    `);

    // Create criminal procedure table
    await Database.instance.query(`
      CREATE TABLE IF NOT EXISTS criminal_procedure (
        id SERIAL PRIMARY KEY,
        page_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector(768),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Add index for criminal procedure table
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_criminal_procedure_page ON criminal_procedure (page_number)
    `);

    // Create clauses table for constitution data
    await Database.instance.query(`
      CREATE TABLE IF NOT EXISTS clauses (
        id SERIAL PRIMARY KEY,
        clause_id VARCHAR(50) NOT NULL,
        part_title TEXT NOT NULL,
        article_number INTEGER NOT NULL,
        article_title TEXT NOT NULL,
        clause_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        source_reference TEXT,
        tags TEXT,
        language VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for clauses table
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_clauses_clause_id ON clauses (clause_id)
    `);
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_clauses_article_number ON clauses (article_number)
    `);
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_clauses_part_title ON clauses (part_title)
    `);

    // Create users table
    await Database.instance.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);

    // Create chats table
    await Database.instance.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create messages table
    await Database.instance.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'model', 'system')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for new tables
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)
    `);
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)
    `);
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats (user_id)
    `);
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats (updated_at DESC)
    `);
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages (chat_id)
    `);
    await Database.instance.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC)
    `);
  }

  // Get the database instance
  public static get client() {
    if (!Database.isInitialized) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return Database.instance;
  }

  // Execute a query
  public static async query(text: string, params?: unknown[]) {
    try {
      return await Database.client.query(text, params);
    } catch (error) {
      console.error("Database query error:", error);
      throw error;
    }
  }

  // Close the connection
  public static async close() {
    if (Database.instance) {
      await Database.instance.end();
      Database.isInitialized = false;
    }
  }

  /**
   * Imports constitution data from a CSV file into the clauses table
   *
   * @param csvFilePath - Path to the CSV file containing constitution data
   * @returns Number of records successfully imported
   */
  public static async importConstitutionFromCsv(csvFilePath: string): Promise<number> {
    try {
      const fs = require("fs").promises;
      const { parse } = require("csv-parse/sync");

      // Make sure database is initialized
      if (!Database.isInitialized) {
        await Database.initialize();
      }

      // Read the CSV file
      const fileContent = await fs.readFile(csvFilePath, "utf-8");
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      console.log(`Read ${records.length} records from CSV file.`);

      // Clear existing data if needed
      await Database.client.query("BEGIN");
      try {
        // First check if table has data
        const countResult = await Database.client.query("SELECT COUNT(*) FROM clauses");
        const rowCount = parseInt(countResult.rows[0].count, 10);

        if (rowCount > 0) {
          console.log(
            `Found ${rowCount} existing records in clauses table. Clearing table before import.`,
          );
          await Database.client.query("DELETE FROM clauses");
        }

        // Insert the records
        let successCount = 0;
        for (const record of records) {
          // Validate record has required fields
          if (
            !record.id ||
            !record.part_title ||
            !record.article_number ||
            !record.article_title ||
            !record.clause_number ||
            !record.content ||
            !record.language
          ) {
            console.warn(`Skipping incomplete record: ${record.id || "unknown ID"}`);
            continue;
          }

          // Insert the record
          await Database.client.query(
            `INSERT INTO clauses 
            (clause_id, part_title, article_number, article_title, clause_number, content, source_reference, tags, language) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              record.id, // Using the CSV's id field as our clause_id
              record.part_title,
              parseInt(record.article_number, 10),
              record.article_title,
              parseInt(record.clause_number, 10),
              record.content,
              record.source_reference || null,
              record.tags || null,
              record.language,
            ],
          );
          successCount++;
        }

        await Database.client.query("COMMIT");
        console.log(
          `Successfully imported ${successCount} constitution clauses into the database.`,
        );
        return successCount;
      } catch (error) {
        await Database.client.query("ROLLBACK");
        console.error("Error during constitution import transaction:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to import constitution data:", error);
      throw new Error(
        `Constitution import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Imports criminal code data from a CSV file into the criminal_code table
   * CSV format expected: Page Number, Text
   *
   * @param csvFilePath - Path to the CSV file containing criminal code pages
   * @returns Number of records successfully imported
   */
  public static async importCriminalCodeFromCsv(csvFilePath: string): Promise<number> {
    try {
      const fs = require("fs").promises;
      const { parse } = require("csv-parse/sync");

      // Make sure database is initialized
      if (!Database.isInitialized) {
        await Database.initialize();
      }

      // Read the CSV file
      const fileContent = await fs.readFile(csvFilePath, "utf-8");
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      console.log(`Read ${records.length} records from criminal code CSV file.`);

      // Clear existing data if needed
      await Database.client.query("BEGIN");
      try {
        // First check if table has data
        const countResult = await Database.client.query("SELECT COUNT(*) FROM criminal_code");
        const rowCount = parseInt(countResult.rows[0].count, 10);

        if (rowCount > 0) {
          console.log(
            `Found ${rowCount} existing records in criminal_code table. Clearing table before import.`,
          );
          await Database.client.query("DELETE FROM criminal_code");
        }

        // Insert the records
        let successCount = 0;
        for (const record of records) {
          // Validate record has required fields
          if (!record["Page Number"] || !record.Text) {
            console.warn(
              `Skipping incomplete record for page: ${record["Page Number"] || "unknown"}`,
            );
            continue;
          }

          // Create metadata
          const metadata = {
            source: path.basename(csvFilePath),
            title: "The National Penal (Code) Act, 2017",
            pageNumber: parseInt(record["Page Number"], 10),
          };

          // Insert the record without embedding (embeddings will be added in a separate step)
          await Database.client.query(
            `INSERT INTO criminal_code 
            (page_number, content, metadata) 
            VALUES ($1, $2, $3)`,
            [parseInt(record["Page Number"], 10), record.Text, metadata],
          );
          successCount++;
        }

        await Database.client.query("COMMIT");
        console.log(`Successfully imported ${successCount} criminal code pages into the database.`);
        return successCount;
      } catch (error) {
        await Database.client.query("ROLLBACK");
        console.error("Error during criminal code import transaction:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to import criminal code data:", error);
      throw new Error(
        `Criminal code import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Imports civil code data from a CSV file into the civil_code table
   * CSV format expected: Page Number, Text
   *
   * @param csvFilePath - Path to the CSV file containing civil code pages
   * @returns Number of records successfully imported
   */
  public static async importCivilCodeFromCsv(csvFilePath: string): Promise<number> {
    try {
      const fs = require("fs").promises;
      const { parse } = require("csv-parse/sync");

      // Make sure database is initialized
      if (!Database.isInitialized) {
        await Database.initialize();
      }

      // Read the CSV file
      const fileContent = await fs.readFile(csvFilePath, "utf-8");
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      console.log(`Read ${records.length} records from civil code CSV file.`);

      // Clear existing data if needed
      await Database.client.query("BEGIN");
      try {
        // First check if table has data
        const countResult = await Database.client.query("SELECT COUNT(*) FROM civil_code");
        const rowCount = parseInt(countResult.rows[0].count, 10);

        if (rowCount > 0) {
          console.log(
            `Found ${rowCount} existing records in civil_code table. Clearing table before import.`,
          );
          await Database.client.query("DELETE FROM civil_code");
        }

        // Insert the records
        let successCount = 0;
        for (const record of records) {
          // Validate record has required fields
          if (!record["Page Number"] || !record.Text) {
            console.warn(
              `Skipping incomplete record for page: ${record["Page Number"] || "unknown"}`,
            );
            continue;
          }

          // Create metadata
          const metadata = {
            source: path.basename(csvFilePath),
            title: "The Civil Code Act, 2017",
            pageNumber: parseInt(record["Page Number"], 10),
          };

          // Insert the record without embedding (embeddings will be added in a separate step)
          await Database.client.query(
            `INSERT INTO civil_code 
            (page_number, content, metadata) 
            VALUES ($1, $2, $3)`,
            [parseInt(record["Page Number"], 10), record.Text, metadata],
          );
          successCount++;
        }

        await Database.client.query("COMMIT");
        console.log(`Successfully imported ${successCount} civil code pages into the database.`);
        return successCount;
      } catch (error) {
        await Database.client.query("ROLLBACK");
        console.error("Error during civil code import transaction:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to import civil code data:", error);
      throw new Error(
        `Civil code import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Imports criminal procedure data from a CSV file into the criminal_procedure table
   * CSV format expected: Page Number, Text
   *
   * @param csvFilePath - Path to the CSV file containing criminal procedure pages
   * @returns Number of records successfully imported
   */
  public static async importCriminalProcedureFromCsv(csvFilePath: string): Promise<number> {
    try {
      const fs = require("fs").promises;
      const { parse } = require("csv-parse/sync");

      // Make sure database is initialized
      if (!Database.isInitialized) {
        await Database.initialize();
      }

      // Read the CSV file
      const fileContent = await fs.readFile(csvFilePath, "utf-8");
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      console.log(`Read ${records.length} records from criminal procedure CSV file.`);

      // Clear existing data if needed
      await Database.client.query("BEGIN");
      try {
        // First check if table has data
        const countResult = await Database.client.query("SELECT COUNT(*) FROM criminal_procedure");
        const rowCount = parseInt(countResult.rows[0].count, 10);

        if (rowCount > 0) {
          console.log(
            `Found ${rowCount} existing records in criminal_procedure table. Clearing table before import.`,
          );
          await Database.client.query("DELETE FROM criminal_procedure");
        }

        // Insert the records
        let successCount = 0;
        for (const record of records) {
          // Validate record has required fields
          if (!record["Page Number"] || !record.Text) {
            console.warn(
              `Skipping incomplete record for page: ${record["Page Number"] || "unknown"}`,
            );
            continue;
          }

          // Create metadata
          const metadata = {
            source: path.basename(csvFilePath),
            title: "The Criminal Procedure Code, 2017",
            pageNumber: parseInt(record["Page Number"], 10),
          };

          // Insert the record without embedding (embeddings will be added in a separate step)
          await Database.client.query(
            `INSERT INTO criminal_procedure 
            (page_number, content, metadata) 
            VALUES ($1, $2, $3)`,
            [parseInt(record["Page Number"], 10), record.Text, metadata],
          );
          successCount++;
        }

        await Database.client.query("COMMIT");
        console.log(
          `Successfully imported ${successCount} criminal procedure pages into the database.`,
        );
        return successCount;
      } catch (error) {
        await Database.client.query("ROLLBACK");
        console.error("Error during criminal procedure import transaction:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to import criminal procedure data:", error);
      throw new Error(
        `Criminal procedure import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
// Initialize the database when imported
Database.initialize().catch(console.error);

// Export for use throughout the application
export default Database;
