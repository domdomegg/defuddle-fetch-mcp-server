# defuddle-fetch-mcp-server

A Model Context Protocol server that provides web content fetching capabilities using the [Defuddle](https://github.com/kepano/defuddle) library. This server enables LLMs to retrieve and process content from web pages, automatically cleaning up the HTML and converting it to clean, readable markdown.

This is a drop-in replacement for the [default fetch MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/fetch) that uses [Readability](https://github.com/mozilla/readability). This generally provides better results for most modern webpages.

## Features

- **Better Content Extraction**: Uses Defuddle to remove webpage clutter and extract main content
- **Flexible Output**: Supports both markdown and raw HTML output
- **Chunked Reading**: Supports pagination with `start_index` and `max_length` parameters
- **Rich Metadata**: Extracts title, author, publication date, word count, and more

## Installation

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "defuddle-fetch": {
      "command": "npx",
      "args": [
        "-y",
        "defuddle-fetch-mcp-server"
      ]
    }
  }
}
```

## Components

### Tools

- **fetch**
  - Fetches a URL from the internet and extracts its contents as clean, markdown text using Defuddle
  - Input parameters:
    - `url` (string, required): URL to fetch
    - `max_length` (number, optional): Maximum number of characters to return. Defaults to 5000.
    - `start_index` (number, optional): Start content from this character index. Defaults to 0.
    - `raw` (boolean, optional): Get raw content without markdown conversion. Defaults to false.
  - Returns cleaned content with metadata including title, author, publication date, word count, domain, and processing time

### Prompts

- **fetch**
  - Fetch a URL and extract its contents as clean, markdown text
  - Arguments:
    - `url` (string, required): URL to fetch

## Contributing

Pull requests are welcomed on GitHub! To get started:

1. Install Git and Node.js
2. Clone the repository
3. Install dependencies with `npm install`
4. Run `npm run test` to run tests
5. Build with `npm run build`

To add it to Claude Desktop, run `npm run build` then add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "defuddle-fetch": {
      "command": "node",
      "args": [
        "/path/to/clone/defuddle-fetch-mcp-server/dist/index.js"
      ]
    }
  }
}
```

## Releases

Versions follow the [semantic versioning spec](https://semver.org/).

To release:

1. Use `npm version <major | minor | patch>` to bump the version
2. Run `git push --follow-tags` to push with tags
3. Wait for GitHub Actions to publish to the NPM registry.
