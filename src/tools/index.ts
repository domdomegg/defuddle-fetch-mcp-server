import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {registerFetch} from './fetch.js';

export function registerAll(server: McpServer): void {
	registerFetch(server);
}
