#!/usr/bin/env node

import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import {initServer, setupSignalHandlers, handleStartupError} from './transports/shared.js';

const transport = process.env.MCP_TRANSPORT || 'stdio';

async function main(): Promise<void> {
	const server = initServer();

	if (transport === 'stdio') {
		const stdioTransport = new StdioServerTransport();
		setupSignalHandlers(async () => {
			await server.close();
		});
		await server.connect(stdioTransport);
	} else if (transport === 'http') {
		const port = parseInt(process.env.PORT || '3000', 10);
		const app = express();

		const httpTransport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		app.post('/mcp', async (req, res) => {
			await httpTransport.handleRequest(req, res);
		});

		app.get('/mcp', async (req, res) => {
			await httpTransport.handleRequest(req, res);
		});

		app.delete('/mcp', async (req, res) => {
			await httpTransport.handleRequest(req, res);
		});

		await server.connect(httpTransport);

		const httpServer = app.listen(port, () => {
			console.log(`HTTP server listening on port ${port}`);
		});

		setupSignalHandlers(async () => {
			await server.close();
			httpServer.close();
		});
	} else {
		throw new Error(`Unknown transport: ${transport}. Use 'stdio' or 'http'.`);
	}
}

main().catch(handleStartupError);
