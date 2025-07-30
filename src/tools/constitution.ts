import { z } from "genkit";
import { ai } from "../utils/ai";
import DB from "../utils/db";

/**
 * Interface representing a part of the Nepali constitution
 */
interface ConstitutionPart {
  partNumber: string;
  title: string;
  description?: string;
}

/**
 * Fallback structure of the Nepali Constitution's table of contents
 * This will be used if database access fails
 */
const FALLBACK_TOC: ConstitutionPart[] = [
  {
    partNumber: "Part-1",
    title: "Preliminary",
    description: "Basic provisions defining Nepal, its sovereignty, and state symbols",
  },
  {
    partNumber: "Part-2",
    title: "Citizenship",
    description: "Provisions regarding acquisition and termination of citizenship",
  },
  {
    partNumber: "Part-3",
    title: "Fundamental Rights and Duties",
    description: "Rights guaranteed to citizens and their fundamental duties",
  },
  {
    partNumber: "Part-4",
    title: "Directive Principles, Policies and Obligations of the State",
    description: "Guiding principles for state governance and policy",
  },
  {
    partNumber: "Part-5",
    title: "Structure of State and Distribution of State Power",
    description: "Federal structure and distribution of power",
  },
  {
    partNumber: "Part-6",
    title: "President and Vice-President",
    description: "Roles, responsibilities and election of President and Vice-President",
  },
  {
    partNumber: "Part-7",
    title: "Federal Executive",
    description: "Structure and functions of the federal executive branch",
  },
  {
    partNumber: "Part-8",
    title: "Federal Legislature",
    description: "Composition and functions of federal legislative bodies",
  },
  {
    partNumber: "Part-9",
    title: "Federal Legislative Procedures",
    description: "Procedures for lawmaking at the federal level",
  },
  {
    partNumber: "Part-10",
    title: "Federal Financial Procedures",
    description: "Budget, revenue allocation and financial management",
  },
  {
    partNumber: "Part-11",
    title: "Judiciary",
    description: "Structure, jurisdiction and independence of courts",
  },
  {
    partNumber: "Part-12",
    title: "Attorney General",
    description: "Appointment, powers and functions of the Attorney General",
  },
  {
    partNumber: "Part-13",
    title: "State Executive",
    description: "Structure and functions of state executive bodies",
  },
  {
    partNumber: "Part-14",
    title: "State Legislature",
    description: "Composition and functions of state legislative bodies",
  },
  {
    partNumber: "Part-15",
    title: "State Legislative Procedures",
    description: "Procedures for lawmaking at the state level",
  },
  {
    partNumber: "Part-16",
    title: "State Financial Procedures",
    description: "Budget and financial management at the state level",
  },
  {
    partNumber: "Part-17",
    title: "Local Executive",
    description: "Structure and functions of local executive bodies",
  },
  {
    partNumber: "Part-18",
    title: "Local Legislature",
    description: "Composition and functions of local legislative bodies",
  },
  {
    partNumber: "Part-19",
    title: "Local Financial Procedures",
    description: "Budget and financial management at the local level",
  },
  {
    partNumber: "Part-20",
    title: "Interrelations between Federation, State and Local level",
    description: "Coordination and relations between different levels of government",
  },
  {
    partNumber: "Part-21",
    title: "Commission for the Investigation of Abuse of Authority",
    description: "Powers and functions of anti-corruption body",
  },
  {
    partNumber: "Part-22",
    title: "Auditor General",
    description: "Appointment, powers and functions of the Auditor General",
  },
  {
    partNumber: "Part-23",
    title: "Public Service Commission",
    description: "Structure and functions of the civil service commission",
  },
  {
    partNumber: "Part-24",
    title: "Election Commission",
    description: "Powers and functions of the electoral management body",
  },
  {
    partNumber: "Part-25",
    title: "National Human Rights Commission",
    description: "Structure and mandate of the human rights watchdog",
  },
  {
    partNumber: "Part-26",
    title: "National Natural Resources and Fiscal Commission",
    description: "Management and distribution of natural resources",
  },
  {
    partNumber: "Part-27",
    title: "Other Commissions",
    description: "Various commissions for marginalized communities and special interests",
  },
  {
    partNumber: "Part-28",
    title: "Provision Relating National Security",
    description: "Structure and mandate of security forces",
  },
  {
    partNumber: "Part-29",
    title: "Provision relating to Political Parties",
    description: "Registration and regulation of political parties",
  },
  {
    partNumber: "Part-30",
    title: "Emergency Power",
    description: "Declaration and management of state emergencies",
  },
  {
    partNumber: "Part-31",
    title: "Amendment to the Constitution",
    description: "Procedures for constitutional amendments",
  },
  {
    partNumber: "Part-32",
    title: "Miscellaneous",
    description: "Various provisions not covered elsewhere",
  },
  {
    partNumber: "Part-33",
    title: "Transitional Provisions",
    description: "Temporary arrangements during constitutional transition",
  },
  {
    partNumber: "Part-34",
    title: "Definitions and Interpretation",
    description: "Definitions of terms used in the constitution",
  },
  {
    partNumber: "Part-35",
    title: "Short Title, Commencement and Repeal",
    description: "Effective date and repeal of previous constitutions",
  },
];

/**
 * Retrieves unique part titles from the database
 *
 * @returns Promise<ConstitutionPart[]> Array of parts in the constitution
 */
async function getPartsFromDatabase(): Promise<ConstitutionPart[]> {
  try {
    const result = await DB.query(`
      SELECT DISTINCT part_title, 
        SUBSTRING(part_title, 1, POSITION(' ' IN part_title)) AS part_number,
        SUBSTRING(part_title, POSITION(' ' IN part_title) + 1) AS title
      FROM clauses 
      ORDER BY 
        CAST(SUBSTRING(SUBSTRING(part_title, 1, POSITION(' ' IN part_title)), 6) AS INTEGER)
    `);

    if (!result.rows || result.rows.length === 0) {
      console.warn("No parts found in database, using fallback data");
      return FALLBACK_TOC;
    }

    return result.rows.map((row) => ({
      partNumber: row.part_number.trim(),
      title: row.title,
      description: getPartDescription(row.part_title),
    }));
  } catch (error) {
    console.error("Error fetching parts from database:", error);
    return FALLBACK_TOC;
  }
}

/**
 * Get a description for a constitutional part
 */
function getPartDescription(partTitle: string): string {
  // Find the matching fallback part to get its description
  const fallbackPart = FALLBACK_TOC.find((part) =>
    partTitle.toLowerCase().includes(part.title.toLowerCase()),
  );
  return (
    fallbackPart?.description ||
    `Constitutional provisions related to ${partTitle.split(" ").slice(1).join(" ")}`
  );
}

/**
 * Tool to get the table of contents of the Nepali Constitution
 */
export const getConstitutionTableOfContents = ai.defineTool(
  {
    name: "getConstitutionTableOfContents",
    description: "Retrieves the table of contents of the Constitution of Nepal 2015",
    inputSchema: z.object({
      format: z
        .enum(["full", "summary", "structured"])
        .optional()
        .describe(
          "Format of the response: 'full' for detailed TOC with descriptions, 'summary' for just part numbers and titles, 'structured' for hierarchical JSON format",
        ),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      const format = input.format || "full";
      const parts = await getPartsFromDatabase();

      switch (format) {
        case "summary":
          // Return just part numbers and titles
          return parts.map((part) => `${part.partNumber}: ${part.title}`).join("\n");

        case "structured":
          // Return the full structured data
          return parts;

        case "full":
        default:
          // Return detailed format with descriptions
          return {
            title: "Constitution of Nepal 2015 - Table of Contents",
            description:
              "The Constitution of Nepal was promulgated on 20 September 2015 and is the fundamental law of Nepal. It defines Nepal as a federal democratic republic with three main levels of government: federal, provincial, and local.",
            structure: parts.map((part) => ({
              part: part.partNumber,
              title: part.title,
              description: part.description || "No description available",
            })),
            totalParts: parts.length,
            metadata: {
              promulgationDate: "20 September 2015",
              officialLanguage: "Nepali",
              source: "Constitution of Nepal 2015",
              dataSource: "Database of constitutional clauses",
            },
          };
      }
    } catch (error) {
      console.error("Error retrieving constitution table of contents:", error);
      return {
        error: "Failed to retrieve the constitution table of contents",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);

/**
 * Tool to get specific part details from the Nepali Constitution
 */
export const getConstitutionPart = ai.defineTool(
  {
    name: "getConstitutionPart",
    description: "Retrieves details about a specific part of the Constitution of Nepal 2015",
    inputSchema: z.object({
      partNumber: z
        .string()
        .describe("Part number or name (e.g., 'Part-3' or 'Fundamental Rights')"),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      const partQuery = input.partNumber.trim();

      // Query the database for the specific part
      const result = await DB.query(
        `
        SELECT DISTINCT part_title,
          SUBSTRING(part_title, 1, POSITION(' ' IN part_title)) AS part_number,
          SUBSTRING(part_title, POSITION(' ' IN part_title) + 1) AS title
        FROM clauses 
        WHERE part_title ILIKE $1 OR 
              part_title ILIKE $2
        LIMIT 1
      `,
        [`${partQuery}%`, `%${partQuery}%`],
      );

      if (!result.rows || result.rows.length === 0) {
        // Try the fallback data if not found in database
        const allParts = await getPartsFromDatabase();
        const part = allParts.find(
          (p) =>
            p.partNumber.toLowerCase().includes(partQuery.toLowerCase()) ||
            p.title.toLowerCase().includes(partQuery.toLowerCase()),
        );

        if (!part) {
          return {
            error: "Part not found",
            message: `Could not find part "${partQuery}" in the Constitution of Nepal 2015`,
            availableParts: allParts.map((p) => `${p.partNumber}: ${p.title}`),
          };
        }

        return {
          part: part.partNumber,
          title: part.title,
          description: part.description || "No detailed description available",
          fullTitle: `${part.partNumber}: ${part.title}`,
          context: `This part falls within the Constitution of Nepal 2015, which is the current governing document of Nepal's legal and political framework.`,
        };
      }

      const partInfo = result.rows[0];

      // Get articles in this part
      const articlesResult = await DB.query(
        `
        SELECT DISTINCT article_number, article_title
        FROM clauses
        WHERE part_title = $1
        ORDER BY article_number
      `,
        [partInfo.part_title],
      );

      return {
        part: partInfo.part_number.trim(),
        title: partInfo.title,
        fullTitle: partInfo.part_title,
        description: getPartDescription(partInfo.part_title),
        articles: articlesResult.rows.map((article) => ({
          number: article.article_number,
          title: article.article_title,
        })),
        articleCount: articlesResult.rows.length,
        context: `This part falls within the Constitution of Nepal 2015, which is the current governing document of Nepal's legal and political framework.`,
      };
    } catch (error) {
      console.error("Error retrieving constitution part:", error);
      return {
        error: "Failed to retrieve the constitution part",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);

/**
 * Tool to get specific article details from the Nepali Constitution
 */
export const getConstitutionArticle = ai.defineTool(
  {
    name: "getConstitutionArticle",
    description: "Retrieves details about a specific article of the Constitution of Nepal 2015",
    inputSchema: z.object({
      articleNumber: z.number().describe("Article number (e.g., 17 for Article 17)"),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      const articleNumber = input.articleNumber;

      // Get article information
      const articleResult = await DB.query(
        `
        SELECT DISTINCT article_number, article_title, part_title
        FROM clauses
        WHERE article_number = $1
        LIMIT 1
      `,
        [articleNumber],
      );

      if (!articleResult.rows || articleResult.rows.length === 0) {
        return {
          error: "Article not found",
          message: `Could not find Article ${articleNumber} in the Constitution of Nepal 2015`,
        };
      }

      const articleInfo = articleResult.rows[0];

      // Get all clauses for this article
      const clausesResult = await DB.query(
        `
        SELECT clause_number, content, source_reference
        FROM clauses
        WHERE article_number = $1
        ORDER BY clause_number
      `,
        [articleNumber],
      );

      return {
        articleNumber: articleInfo.article_number,
        title: articleInfo.article_title,
        partTitle: articleInfo.part_title,
        clauses: clausesResult.rows.map((clause) => ({
          number: clause.clause_number,
          content: clause.content,
          reference: clause.source_reference,
        })),
        clauseCount: clausesResult.rows.length,
        fullText: clausesResult.rows
          .map((clause) => `(${clause.clause_number}) ${clause.content}`)
          .join("\n\n"),
        source: articleInfo.source_reference || "Constitution of Nepal 2015",
      };
    } catch (error) {
      console.error("Error retrieving constitution article:", error);
      return {
        error: "Failed to retrieve the constitution article",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);

/**
 * Tool to search the constitution for specific keywords or phrases
 */
export const searchConstitution = ai.defineTool(
  {
    name: "searchConstitution",
    description: "Searches the Constitution of Nepal 2015 for specific keywords or phrases",
    inputSchema: z.object({
      query: z.string().describe("Keywords or phrases to search for in the constitution"),
      limit: z.number().optional().describe("Maximum number of results to return (default: 10)"),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      const searchQuery = input.query.trim();
      const limit = input.limit || 10;

      // Search clauses for the query
      const searchResult = await DB.query(
        `
        SELECT 
          c.clause_id,
          c.part_title, 
          c.article_number, 
          c.article_title, 
          c.clause_number, 
          c.content,
          c.source_reference
        FROM clauses c
        WHERE 
          c.content ILIKE $1 OR
          c.article_title ILIKE $1 OR
          c.part_title ILIKE $1 OR
          c.tags ILIKE $1
        ORDER BY c.article_number, c.clause_number
        LIMIT $2
      `,
        [`%${searchQuery}%`, limit],
      );

      if (!searchResult.rows || searchResult.rows.length === 0) {
        return {
          message: `No results found for "${searchQuery}" in the Constitution of Nepal 2015`,
          suggestions: [
            "Try using different keywords",
            "Use more general terms",
            "Check spelling of specialized legal terms",
            "Search for broader concepts",
          ],
        };
      }

      return {
        query: searchQuery,
        totalResults: searchResult.rows.length,
        results: searchResult.rows.map((row) => ({
          id: row.clause_id,
          partTitle: row.part_title,
          articleNumber: row.article_number,
          articleTitle: row.article_title,
          clauseNumber: row.clause_number,
          content: row.content,
          reference: row.source_reference,
          location: `Article ${row.article_number}, Clause ${row.clause_number}`,
        })),
        summary: `Found ${searchResult.rows.length} relevant provisions in the Constitution of Nepal 2015 related to "${searchQuery}"`,
      };
    } catch (error) {
      console.error("Error searching constitution:", error);
      return {
        error: "Failed to search the constitution",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);
