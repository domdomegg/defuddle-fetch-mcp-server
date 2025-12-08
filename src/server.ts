import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import packageJson from '../package.json' with {type: 'json'};
import {registerAll} from './tools/index.js';

export function createServer(): McpServer {
	const server = new McpServer({
		name: 'defuddle-fetch-mcp-server',
		version: packageJson.version,
	});

	registerAll(server);

	return server;
}
