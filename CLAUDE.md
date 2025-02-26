# MCP Firecrawl Development Guide

## Commands
- Start server: `npm start` or `FIRECRAWL_API_TOKEN=your_token_here npm start`
- Tests: No tests available yet (use `npm test` to confirm)

## Code Style Guidelines

### Structure
- ES Modules format (`type: "module"` in package.json)
- Server implementation in `/src/server.js`

### Imports & Exports
- Use ES Module imports: `import { Name } from "package"`
- Order imports: external libs first, internal modules second

### Formatting
- Use 2-space indentation
- Use single quotes for strings except when nesting: `'example'`
- Include semicolons at end of statements
- Prefer explicit return statements in functions

### Types
- Type validation using Zod schemas for API inputs
- Define API parameters with appropriate Zod validators

### Error Handling
- Use try/catch blocks for async operations
- Return standardized error responses with `isError: true`
- Log errors to console with descriptive messages
- Include error messages in responses

### Logging
- Use `console.error` for debug information and errors