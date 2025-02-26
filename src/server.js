import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import FirecrawlApp from '@mendable/firecrawl-js';
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

// Create an MCP server
const server = new McpServer({
  name: "Firecrawl MCP Server",
  version: "1.0.0"
});

// Get the Firecrawl API token from environment variable
const firecrawlToken = process.env.FIRECRAWL_API_TOKEN;
if (!firecrawlToken) {
  console.error("Error: FIRECRAWL_API_TOKEN environment variable is required");
  process.exit(1);
}

// Initialize Firecrawl client
const firecrawl = new FirecrawlApp({apiKey: firecrawlToken});

// Helper function to create a Zod schema from a schema definition
function createDynamicSchema(schemaDefinition) {
  const schemaMap = {
    string: z.string(),
    boolean: z.boolean(),
    number: z.number(),
    array: (itemType) => z.array(createDynamicSchema(itemType)),
    object: (properties) => {
      const shape = {};
      for (const [key, type] of Object.entries(properties)) {
        shape[key] = createDynamicSchema(type);
      }
      return z.object(shape);
    }
  };

  if (typeof schemaDefinition === 'string') {
    return schemaMap[schemaDefinition];
  } else if (Array.isArray(schemaDefinition)) {
    return schemaMap.array(schemaDefinition[0]);
  } else if (typeof schemaDefinition === 'object') {
    return schemaMap.object(schemaDefinition);
  }
  
  throw new Error(`Unsupported schema type: ${typeof schemaDefinition}`);
}

// Tool 1: Basic website scraping
server.tool(
  "scrape-website",
  { 
    url: z.string().url(),
    formats: z.array(z.enum(['markdown', 'html', 'text'])).default(['markdown'])
  },
  async ({ url, formats }) => {
    return await Sentry.startSpan(
      { name: "scrape-website" },
      async () => {
        try {
          // Debug input
          console.error('DEBUG: Scraping URL:', url, 'with formats:', formats);

          // Add Sentry breadcrumb for debugging
          Sentry.addBreadcrumb({
            category: 'scrape-website',
            message: `Scraping URL: ${url}`,
            data: { formats },
            level: 'info'
          });

          // Scrape the website
          const scrapeResult = await firecrawl.scrapeUrl(url, { 
            formats: formats 
          });

          // Debug raw response
          console.error('DEBUG: Raw scrape result:', JSON.stringify(scrapeResult, null, 2));

          if (!scrapeResult.success) {
            // Capture error in Sentry
            Sentry.captureMessage(`Failed to scrape website: ${scrapeResult.error}`, 'error');
            return {
              content: [{ 
                type: "text", 
                text: `Failed to scrape website: ${scrapeResult.error}` 
              }],
              isError: true
            };
          }

          // Return the content directly
          return {
            content: [{ 
              type: "text", 
              text: scrapeResult.markdown || scrapeResult.content || 'No content available'
            }]
          };

        } catch (error) {
          console.error('DEBUG: Caught error:', error);
          // Capture exception in Sentry
          Sentry.captureException(error);
          return {
            content: [{ 
              type: "text", 
              text: `Error scraping website: ${error.message}` 
            }],
            isError: true
          };
        }
      }
    );
  }
);

// Tool 2: Structured data extraction
server.tool(
  "extract-data",
  { 
    urls: z.array(z.string().url()),
    prompt: z.string(),
    schema: z.record(z.union([
      z.literal('string'),
      z.literal('boolean'),
      z.literal('number'),
      z.array(z.any()),
      z.record(z.any())
    ]))
  },
  async ({ urls, prompt, schema }) => {
    return await Sentry.startSpan(
      { name: "extract-data" },
      async () => {
        try {
          // Add Sentry breadcrumb for debugging
          Sentry.addBreadcrumb({
            category: 'extract-data',
            message: `Extracting data from URLs`,
            data: { urlCount: urls.length, prompt },
            level: 'info'
          });

          // Create the Zod schema from the provided definition
          const zodSchema = createDynamicSchema(schema);

          // Extract data using Firecrawl
          const extractResponse = await firecrawl.extract(urls, {
            prompt: prompt,
            schema: zodSchema
          });

          if (!extractResponse.success) {
            // Capture error in Sentry
            Sentry.captureMessage(`Failed to extract data: ${extractResponse.error}`, 'error');
            return {
              content: [{ 
                type: "text", 
                text: `Failed to extract data: ${extractResponse.error}` 
              }],
              isError: true
            };
          }

          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify(extractResponse.data, null, 2)
            }]
          };
        } catch (error) {
          // Capture exception in Sentry
          Sentry.captureException(error);
          return {
            content: [{ 
              type: "text", 
              text: `Error extracting data: ${error.message}` 
            }],
            isError: true
          };
        }
      }
    );
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport); 